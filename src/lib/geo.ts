export type Coordinates = {
  lat: number;
  lng: number;
};

export type LiveGeoPoint = Coordinates & {
  altitude: number | null;
  accuracy: number | null;
  altitudeAccuracy: number | null;
  heading: number | null;
  speed: number | null;
  timestamp: number;
  source: 'gps' | 'network' | 'manual' | 'ip';
};

export type LocationCapturePurpose = 'customer' | 'restaurant' | 'driver' | 'wilaya';

export type LocationCaptureResult = {
  point: LiveGeoPoint;
  accepted: boolean;
  timedOut: boolean;
};

export type AddressParts = {
  displayName: string;
  street?: string;
  neighborhood?: string;
  commune?: string;
  city?: string;
  province?: string;
  postalCode?: string;
  country?: string;
  placeId?: string;
  provider: 'google' | 'osm' | 'manual';
};

export type GeoSearchResult = Coordinates & {
  label: string;
  placeId?: string;
  provider: 'google' | 'osm';
};

const NOMINATIM_MIN_DELAY_MS = 1100;
export const GEOLOCATION_DEFAULT_OPTIONS: PositionOptions = {
  enableHighAccuracy: true,
  maximumAge: 0,
  timeout: 30000,
};

export const LOCATION_ACCURACY_METERS = {
  restaurantStrict: 50,
  customerGood: 80,
  customerUsable: 250,
  driverSuspicious: 250,
};

const BEST_READING_WAIT_MS = 8000;
let lastNominatimRequestAt = 0;

export const ALGERIA_GEO_BOUNDS = {
  minLat: 18.5,
  maxLat: 37.6,
  minLng: -9.0,
  maxLng: 12.2,
};

export function isCoordinateInAlgeria(lat: number, lng: number): boolean {
  return (
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= ALGERIA_GEO_BOUNDS.minLat &&
    lat <= ALGERIA_GEO_BOUNDS.maxLat &&
    lng >= ALGERIA_GEO_BOUNDS.minLng &&
    lng <= ALGERIA_GEO_BOUNDS.maxLng
  );
}

export function isUsableAccuracy(accuracy: number | null | undefined, purpose: LocationCapturePurpose): boolean {
  if (accuracy == null) return purpose !== 'restaurant';
  if (purpose === 'restaurant') return accuracy <= LOCATION_ACCURACY_METERS.restaurantStrict;
  if (purpose === 'driver') return accuracy <= LOCATION_ACCURACY_METERS.customerGood;
  if (purpose === 'wilaya') return accuracy <= 5000;
  return accuracy <= LOCATION_ACCURACY_METERS.customerGood;
}

function toLiveGeoPoint(pos: GeolocationPosition): LiveGeoPoint {
  return {
    lat: pos.coords.latitude,
    lng: pos.coords.longitude,
    altitude: pos.coords.altitude,
    accuracy: pos.coords.accuracy,
    altitudeAccuracy: pos.coords.altitudeAccuracy,
    heading: pos.coords.heading,
    speed: pos.coords.speed,
    timestamp: pos.timestamp,
    source: pos.coords.accuracy && pos.coords.accuracy <= LOCATION_ACCURACY_METERS.customerGood ? 'gps' : 'network',
  };
}

function isBetterPoint(next: LiveGeoPoint, current: LiveGeoPoint | null): boolean {
  if (!current) return true;
  if (next.accuracy == null) return false;
  if (current.accuracy == null) return true;
  return next.accuracy < current.accuracy;
}

export function haversineKm(a: Coordinates, b: Coordinates): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
}

export function estimateDeliveryEtaMinutes(params: {
  distanceKm: number;
  preparationMinutes?: number;
  handoffMinutes?: number;
  averageSpeedKmh?: number;
}): number {
  const prep = params.preparationMinutes ?? 18;
  const handoff = params.handoffMinutes ?? 5;
  const speed = Math.max(params.averageSpeedKmh ?? 22, 8);
  const travel = (params.distanceKm / speed) * 60;
  return Math.max(8, Math.round(prep + handoff + travel));
}

export function formatDistanceKm(distanceKm: number): string {
  if (distanceKm < 1) return `${Math.round(distanceKm * 1000)} m`;
  return `${distanceKm.toFixed(1)} km`;
}

export function coordinatesToGeohash(lat: number, lng: number, precision = 8): string {
  const base32 = '0123456789bcdefghjkmnpqrstuvwxyz';
  let idx = 0;
  let bit = 0;
  let evenBit = true;
  let geohash = '';
  let latMin = -90;
  let latMax = 90;
  let lngMin = -180;
  let lngMax = 180;

  while (geohash.length < precision) {
    if (evenBit) {
      const mid = (lngMin + lngMax) / 2;
      if (lng >= mid) {
        idx = idx * 2 + 1;
        lngMin = mid;
      } else {
        idx *= 2;
        lngMax = mid;
      }
    } else {
      const mid = (latMin + latMax) / 2;
      if (lat >= mid) {
        idx = idx * 2 + 1;
        latMin = mid;
      } else {
        idx *= 2;
        latMax = mid;
      }
    }
    evenBit = !evenBit;

    if (++bit === 5) {
      geohash += base32.charAt(idx);
      bit = 0;
      idx = 0;
    }
  }

  return geohash;
}

async function waitForNominatimSlot() {
  const elapsed = Date.now() - lastNominatimRequestAt;
  if (elapsed < NOMINATIM_MIN_DELAY_MS) {
    await new Promise((resolve) => setTimeout(resolve, NOMINATIM_MIN_DELAY_MS - elapsed));
  }
  lastNominatimRequestAt = Date.now();
}

function normalizeOsmAddress(data: {
  display_name?: string;
  place_id?: number | string;
  address?: Record<string, string | undefined>;
}): AddressParts {
  const a = data.address ?? {};
  return {
    displayName: data.display_name ?? 'Selected location',
    street: [a.house_number, a.road].filter(Boolean).join(' ') || a.pedestrian || a.footway,
    neighborhood: a.neighbourhood || a.suburb || a.quarter,
    commune: a.municipality || a.town || a.village || a.city_district,
    city: a.city || a.town || a.village || a.county,
    province: a.state || a.region,
    postalCode: a.postcode,
    country: a.country,
    placeId: data.place_id ? String(data.place_id) : undefined,
    provider: 'osm',
  };
}

export async function reverseGeocode(lat: number, lng: number, language = 'fr'): Promise<AddressParts> {
  if (!isCoordinateInAlgeria(lat, lng)) {
    return {
      displayName: `${lat.toFixed(5)}, ${lng.toFixed(5)}`,
      country: 'Algeria',
      provider: 'manual',
    };
  }

  await waitForNominatimSlot();
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`,
      { headers: { 'Accept-Language': language } },
    );
    if (!res.ok) throw new Error('Reverse geocode failed');
    return normalizeOsmAddress(await res.json());
  } catch {
    return {
      displayName: `${lat.toFixed(5)}, ${lng.toFixed(5)}`,
      provider: 'manual',
    };
  }
}

export async function searchAddresses(query: string, language = 'fr', limit = 5): Promise<GeoSearchResult[]> {
  const trimmed = query.trim();
  if (trimmed.length < 2) return [];
  await waitForNominatimSlot();
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&countrycodes=dz&limit=${limit}&q=${encodeURIComponent(trimmed)}`,
      { headers: { 'Accept-Language': language } },
    );
    if (!res.ok) return [];
    const items = await res.json();
    if (!Array.isArray(items)) return [];
    return items
      .map((item) => ({
        lat: Number.parseFloat(item.lat),
        lng: Number.parseFloat(item.lon),
        label: item.display_name as string,
        placeId: item.place_id ? String(item.place_id) : undefined,
        provider: 'osm' as const,
      }))
      .filter((item) => isCoordinateInAlgeria(item.lat, item.lng));
  } catch {
    return [];
  }
}

export function watchCurrentPosition(
  onPoint: (point: LiveGeoPoint) => void,
  onError: (error: GeolocationPositionError | Error) => void,
  options: PositionOptions = GEOLOCATION_DEFAULT_OPTIONS,
): () => void {
  if (!('geolocation' in navigator)) {
    onError(new Error('Geolocation is not supported on this device'));
    return () => {};
  }

  const watchId = navigator.geolocation.watchPosition(
    (pos) => {
      if (!isCoordinateInAlgeria(pos.coords.latitude, pos.coords.longitude)) {
        onError(new Error('Detected location is outside Algeria. Please search or pick your address manually.'));
        return;
      }

      onPoint(toLiveGeoPoint(pos));
    },
    onError,
    options,
  );

  return () => navigator.geolocation.clearWatch(watchId);
}

export function requestBestCurrentPosition(params: {
  purpose: LocationCapturePurpose;
  onCandidate?: (point: LiveGeoPoint) => void;
  onResult: (result: LocationCaptureResult) => void;
  onError: (error: GeolocationPositionError | Error) => void;
  waitMs?: number;
  options?: PositionOptions;
}): () => void {
  let best: LiveGeoPoint | null = null;
  let completed = false;
  let stopWatching: (() => void) | null = null;

  const finish = (timedOut: boolean) => {
    if (completed || !best) return;
    completed = true;
    stopWatching?.();
    params.onResult({
      point: best,
      accepted: isUsableAccuracy(best.accuracy, params.purpose),
      timedOut,
    });
  };

  const timer = window.setTimeout(() => finish(true), params.waitMs ?? BEST_READING_WAIT_MS);

  stopWatching = watchCurrentPosition(
    (point) => {
      if (!isBetterPoint(point, best)) return;
      best = point;
      params.onCandidate?.(point);
      if (isUsableAccuracy(point.accuracy, params.purpose)) {
        window.clearTimeout(timer);
        finish(false);
      }
    },
    (error) => {
      if (best) {
        finish(true);
        return;
      }
      window.clearTimeout(timer);
      completed = true;
      params.onError(error);
    },
    params.options ?? GEOLOCATION_DEFAULT_OPTIONS,
  );

  return () => {
    completed = true;
    window.clearTimeout(timer);
    stopWatching?.();
  };
}
