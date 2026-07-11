import type { AddressParts } from './geo';

export const GOOGLE_MAPS_API_KEY = (
  import.meta.env.VITE_GOOGLE_MAPS_API_KEY
  || import.meta.env.VITE_GOOGLE_MAPS_PLATFORM_KEY
  || process.env.GOOGLE_MAPS_PLATFORM_KEY
  || ''
).trim();

export const GOOGLE_MAPS_MAP_ID = (
  import.meta.env.VITE_GOOGLE_MAPS_MAP_ID
  || 'DEMO_MAP_ID'
).trim();

export const GOOGLE_MAPS_REGION = 'DZ';

export const ALGERIA_MAP_CENTER: google.maps.LatLngLiteral = {
  lat: 28.0339,
  lng: 1.6596,
};

export const ALGERIA_MAP_BOUNDS: google.maps.LatLngBoundsLiteral = {
  north: 37.6,
  south: 18.5,
  east: 12.2,
  west: -9,
};

export const ALGIERS_MAP_CENTER: google.maps.LatLngLiteral = {
  lat: 36.7538,
  lng: 3.0588,
};

export const CONSTANTINE_MAP_CENTER: google.maps.LatLngLiteral = {
  lat: 36.365,
  lng: 6.6147,
};

export function hasGoogleMapsKey(): boolean {
  return GOOGLE_MAPS_API_KEY.length > 10 && GOOGLE_MAPS_API_KEY !== 'YOUR_API_KEY';
}

export function isValidMapCoordinate(lat: number | null | undefined, lng: number | null | undefined): boolean {
  return Number.isFinite(lat) && Number.isFinite(lng) && lat !== 0 && lng !== 0;
}

export function mapLanguage(locale: 'en' | 'fr' | 'ar'): string {
  return locale === 'ar' ? 'ar' : locale === 'en' ? 'en' : 'fr';
}

type GoogleAddressComponentLike = {
  types: string[];
  long_name?: string | null;
  longText?: string | null;
};

export function parseGoogleAddressComponents(params: {
  components: GoogleAddressComponentLike[];
  displayName: string;
  placeId?: string | null;
}): AddressParts {
  const component = (type: string) => {
    const match = params.components.find((item) => item.types.includes(type));
    return match?.longText || match?.long_name;
  };
  return {
    displayName: params.displayName,
    street: [component('street_number'), component('route')].filter(Boolean).join(' ') || undefined,
    neighborhood: component('neighborhood') || component('sublocality') || component('sublocality_level_1') || undefined,
    commune: component('locality') || component('administrative_area_level_2') || undefined,
    city: component('locality') || component('administrative_area_level_2') || undefined,
    province: component('administrative_area_level_1') || undefined,
    postalCode: component('postal_code') || undefined,
    country: component('country') || 'Algeria',
    placeId: params.placeId || undefined,
    provider: 'google',
  };
}
