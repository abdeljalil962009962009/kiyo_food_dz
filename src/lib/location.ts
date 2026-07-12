import type { AddressParts, LiveGeoPoint } from './geo';

export type AddressQuality = 'precise' | 'approximate' | 'manual';
export type LocationSource = LiveGeoPoint['source'] | 'search' | 'manual';

export type DeliveryDetails = {
  landmark: string;
  instructions: string;
};

export type DeliveryLocation = {
  lat: number;
  lng: number;
  address: string;
  accuracy: number | null;
  source: LocationSource;
  confirmed: boolean;
  placeId: string | null;
  addressQuality: AddressQuality;
  addressParts: AddressParts | null;
  requiresManualAdjustment: boolean;
  details?: DeliveryDetails;
  confirmedAt?: string;
};

export const EMPTY_DELIVERY_DETAILS: DeliveryDetails = {
  landmark: '',
  instructions: '',
};

export function sanitizeDeliveryDetails(value: unknown): DeliveryDetails {
  if (!value || typeof value !== 'object') return { ...EMPTY_DELIVERY_DETAILS };
  const details = value as { landmark?: unknown; instructions?: unknown };
  return {
    landmark: typeof details.landmark === 'string' ? details.landmark : '',
    instructions: typeof details.instructions === 'string' ? details.instructions : '',
  };
}

export const DELIVERY_LOCATION_STORAGE_KEY = 'kiyo-confirmed-delivery-location-v2';
export const LAST_MAP_STATE_STORAGE_KEY = 'kiyo-last-map-state-v1';
const MAX_STORED_LOCATION_AGE_MS = 90 * 24 * 60 * 60 * 1000;
const MAX_MAP_STATE_AGE_MS = 30 * 24 * 60 * 60 * 1000;

export function isFiniteCoordinate(lat: unknown, lng: unknown): lat is number {
  return typeof lat === 'number'
    && typeof lng === 'number'
    && Number.isFinite(lat)
    && Number.isFinite(lng)
    && lat >= -90
    && lat <= 90
    && lng >= -180
    && lng <= 180;
}

export function isConfirmedDeliveryLocation(value: unknown): value is DeliveryLocation {
  if (!value || typeof value !== 'object') return false;
  const location = value as Partial<DeliveryLocation>;
  const lat = location.lat;
  const lng = location.lng;
  return isFiniteCoordinate(lat, lng)
    && (lat as number) >= 18.5
    && (lat as number) <= 37.6
    && (lng as number) >= -9
    && (lng as number) <= 12.2
    && location.confirmed === true
    && typeof location.address === 'string'
    && location.address.trim().length >= 3
    && location.requiresManualAdjustment === false;
}

export function restoreDeliveryLocation(raw: string | null): DeliveryLocation | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as DeliveryLocation;
    if (!isConfirmedDeliveryLocation(parsed)) return null;
    if (parsed.confirmedAt) {
      const confirmedAt = Date.parse(parsed.confirmedAt);
      if (!Number.isFinite(confirmedAt) || Date.now() - confirmedAt > MAX_STORED_LOCATION_AGE_MS) return null;
    }
    return {
      ...parsed,
      details: sanitizeDeliveryDetails(parsed.details),
    };
  } catch {
    return null;
  }
}

export function saveLastMapState(location: DeliveryLocation): void {
  if (typeof window === 'undefined' || !isLocationInsideAlgeria(location)) return;
  try {
    localStorage.setItem(LAST_MAP_STATE_STORAGE_KEY, JSON.stringify({
      ...location,
      confirmed: false,
      requiresManualAdjustment: true,
      cachedAt: new Date().toISOString(),
    }));
  } catch {
    // Storage can be unavailable in private browsing; the live flow still works.
  }
}

export function restoreLastMapState(raw: string | null): DeliveryLocation | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as DeliveryLocation & { cachedAt?: string };
    if (!isLocationInsideAlgeria(parsed) || typeof parsed.address !== 'string' || parsed.address.trim().length < 3) return null;
    const cachedAt = parsed.cachedAt ? Date.parse(parsed.cachedAt) : Number.NaN;
    if (!Number.isFinite(cachedAt) || Date.now() - cachedAt > MAX_MAP_STATE_AGE_MS) return null;
    return {
      ...parsed,
      confirmed: false,
      requiresManualAdjustment: true,
      details: sanitizeDeliveryDetails(parsed.details),
    };
  } catch {
    return null;
  }
}

function isLocationInsideAlgeria(location: Partial<DeliveryLocation>): boolean {
  return isFiniteCoordinate(location.lat, location.lng)
    && (location.lat as number) >= 18.5
    && (location.lat as number) <= 37.6
    && (location.lng as number) >= -9
    && (location.lng as number) <= 12.2;
}

export function locationPrimaryLine(location: DeliveryLocation | null): string {
  if (!location) return '';
  return location.addressParts?.street
    || location.addressParts?.neighborhood
    || location.addressParts?.commune
    || location.address.split(',')[0]?.trim()
    || location.address;
}

export function locationSecondaryLine(location: DeliveryLocation | null): string {
  if (!location) return '';
  const values = [
    location.addressParts?.commune || location.addressParts?.city,
    location.addressParts?.province,
  ].filter((value, index, array): value is string => Boolean(value) && array.indexOf(value) === index);
  return values.join(', ');
}
