import { createClient } from '@supabase/supabase-js';

declare const process: { env: Record<string, string | undefined> };

export const config = { maxDuration: 15 };

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

function bearerToken(headers: RequestLike['headers']) {
  const value = headers.authorization;
  const header = Array.isArray(value) ? value[0] : value;
  return header?.startsWith('Bearer ') ? header.slice(7).trim() : null;
}

export default async function handler(request: RequestLike, response: ResponseLike) {
  response.setHeader('Cache-Control', 'private, max-age=30');
  response.setHeader('Content-Type', 'application/json; charset=utf-8');
  if (request.method !== 'POST') {
    response.status(405).json({ code: 'method_not_allowed', message: 'Use POST.' });
    return;
  }

  const body = request.body && typeof request.body === 'object'
    ? request.body as Record<string, unknown>
    : {};
  const latitude = Number(body.latitude);
  const longitude = Number(body.longitude);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)
    || latitude < 18 || latitude > 38 || longitude < -9 || longitude > 13) {
    response.status(400).json({ code: 'invalid_coordinates', message: 'Choose a valid location in Algeria.' });
    return;
  }

  const supabaseUrl = process.env.VITE_SUPABASE_URL?.replace(/\/+$/, '');
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    response.status(503).json({ code: 'server_not_configured', message: 'Location availability is temporarily unavailable.' });
    return;
  }

  let actorId: string | null = null;
  const token = bearerToken(request.headers);
  if (token) {
    const authClient = createClient(supabaseUrl, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data } = await authClient.auth.getUser(token);
    actorId = data.user?.id ?? null;
  }

  const serviceClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await serviceClient.rpc('execute_location_insights', {
    p_actor_id: actorId,
    p_lat: latitude,
    p_lng: longitude,
  });
  if (error) {
    response.status(422).json({ code: error.code ?? 'location_insights_failed', message: error.message });
    return;
  }
  response.status(200).json({ data });
}
