import { createClient } from '@supabase/supabase-js';

declare const process: { env: Record<string, string | undefined> };

export const config = { maxDuration: 30 };

type RequestLike = {
  method?: string;
  headers: Record<string, string | string[] | undefined>;
  body?: unknown;
};

type ResponseLike = {
  status(code: number): ResponseLike;
  json(body: unknown): void;
  setHeader(name: string, value: string): void;
};

type RouteRequest = {
  restaurantId?: unknown;
  destination?: { latitude?: unknown; longitude?: unknown };
};

const ALGERIA_BOUNDS = {
  minLat: 18.9,
  maxLat: 37.2,
  minLng: -8.8,
  maxLng: 12.1,
};

function isAlgerianCoordinate(latitude: number, longitude: number) {
  return Number.isFinite(latitude)
    && Number.isFinite(longitude)
    && latitude >= ALGERIA_BOUNDS.minLat
    && latitude <= ALGERIA_BOUNDS.maxLat
    && longitude >= ALGERIA_BOUNDS.minLng
    && longitude <= ALGERIA_BOUNDS.maxLng;
}

function bearerToken(headers: RequestLike['headers']) {
  const value = headers.authorization;
  const header = Array.isArray(value) ? value[0] : value;
  return header?.startsWith('Bearer ') ? header.slice(7).trim() : null;
}

function durationSeconds(value: unknown) {
  if (typeof value !== 'string' || !/^\d+(?:\.\d+)?s$/.test(value)) return null;
  return Math.ceil(Number(value.slice(0, -1)));
}

export default async function handler(request: RequestLike, response: ResponseLike) {
  response.setHeader('Cache-Control', 'no-store');
  if (request.method !== 'POST') {
    response.status(405).json({ code: 'method_not_allowed', message: 'Use POST.' });
    return;
  }

  const supabaseUrl = process.env.VITE_SUPABASE_URL?.replace(/\/+$/, '');
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const routesKey = process.env.GOOGLE_ROUTES_API_KEY;
  if (!supabaseUrl || !anonKey || !serviceRoleKey || !routesKey) {
    response.status(503).json({
      code: 'routing_not_configured',
      message: 'Road-route delivery pricing is temporarily unavailable.',
    });
    return;
  }

  const token = bearerToken(request.headers);
  if (!token) {
    response.status(401).json({ code: 'authentication_required', message: 'Sign in to calculate delivery.' });
    return;
  }

  const authClient = createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: authData, error: authError } = await authClient.auth.getUser(token);
  if (authError || !authData.user) {
    response.status(401).json({ code: 'invalid_session', message: 'Your session expired. Sign in again.' });
    return;
  }

  const body = (request.body ?? {}) as RouteRequest;
  const restaurantId = typeof body.restaurantId === 'string' ? body.restaurantId : '';
  const latitude = Number(body.destination?.latitude);
  const longitude = Number(body.destination?.longitude);
  if (!/^[0-9a-f-]{36}$/i.test(restaurantId) || !isAlgerianCoordinate(latitude, longitude)) {
    response.status(400).json({ code: 'invalid_route_request', message: 'Choose a valid delivery location in Algeria.' });
    return;
  }

  const serviceClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: restaurant, error: restaurantError } = await serviceClient
    .from('restaurants')
    .select('id,latitude,longitude,status')
    .eq('id', restaurantId)
    .maybeSingle();
  if (
    restaurantError
    || !restaurant
    || restaurant.status !== 'published'
    || !isAlgerianCoordinate(Number(restaurant.latitude), Number(restaurant.longitude))
  ) {
    response.status(409).json({
      code: 'restaurant_unavailable',
      message: 'This restaurant is not ready to calculate delivery.',
    });
    return;
  }

  const routeResponse = await fetch('https://routes.googleapis.com/directions/v2:computeRoutes', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': routesKey,
      'X-Goog-FieldMask': 'routes.distanceMeters,routes.duration',
    },
    body: JSON.stringify({
      origin: {
        location: {
          latLng: {
            latitude: Number(restaurant.latitude),
            longitude: Number(restaurant.longitude),
          },
        },
      },
      destination: { location: { latLng: { latitude, longitude } } },
      travelMode: 'DRIVE',
      routingPreference: 'TRAFFIC_AWARE',
      computeAlternativeRoutes: false,
      languageCode: 'fr',
      units: 'METRIC',
    }),
    signal: AbortSignal.timeout(20_000),
  }).catch(() => null);

  if (!routeResponse) {
    response.status(504).json({
      code: 'routing_timeout',
      message: 'The road route took too long to calculate. Please try again.',
    });
    return;
  }
  if (!routeResponse.ok) {
    const retryable = routeResponse.status === 429 || routeResponse.status >= 500;
    response.status(retryable ? 503 : 422).json({
      code: retryable ? 'routing_temporarily_unavailable' : 'route_not_found',
      message: retryable
        ? 'Road-route pricing is temporarily unavailable. Please try again.'
        : 'No drivable delivery route was found for this address.',
    });
    return;
  }

  const routePayload = await routeResponse.json() as {
    routes?: Array<{ distanceMeters?: number; duration?: string }>;
  };
  const route = routePayload.routes?.[0];
  const distanceMeters = Number(route?.distanceMeters);
  const routeDurationSeconds = durationSeconds(route?.duration);
  if (!Number.isInteger(distanceMeters) || distanceMeters <= 0 || !routeDurationSeconds) {
    response.status(422).json({
      code: 'invalid_route_result',
      message: 'Google Routes did not return a usable road route.',
    });
    return;
  }

  const requestIdValue = routeResponse.headers.get('x-request-id')
    ?? routeResponse.headers.get('x-goog-request-id');
  const { data: recorded, error: recordError } = await serviceClient.rpc('record_trusted_delivery_route', {
    p_customer_id: authData.user.id,
    p_restaurant_id: restaurantId,
    p_destination_latitude: latitude,
    p_destination_longitude: longitude,
    p_distance_meters: distanceMeters,
    p_duration_seconds: routeDurationSeconds,
    p_provider_request_id: requestIdValue,
  });
  if (recordError || !recorded) {
    response.status(409).json({
      code: 'route_rejected',
      message: recordError?.message ?? 'The delivery route could not be validated.',
    });
    return;
  }

  const quote = Array.isArray(recorded) ? recorded[0] : recorded;
  response.status(200).json({
    routeQuoteId: quote.id,
    distanceMeters: quote.distance_meters,
    durationSeconds: quote.duration_seconds,
    expiresAt: quote.expires_at,
  });
}
