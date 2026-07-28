import { describe, expect, it } from 'vitest';
import { classifyGoogleMapsLoadFailure, containsNativeGoogleMapErrorText } from './googleMapsRuntime';

describe('Google Maps runtime failures', () => {
  it.each([
    'InvalidKeyMapError: API key is invalid',
    'RefererNotAllowedMapError',
    'BillingNotEnabledMapError',
    'ApiTargetBlockedMapError: request denied',
    'OverQuotaMapError',
  ])('classifies configuration rejection as authorization: %s', (message) => {
    expect(classifyGoogleMapsLoadFailure(new Error(message), true)).toBe('authorization');
  });

  it('classifies transport and script failures as network failures', () => {
    expect(classifyGoogleMapsLoadFailure(new Error('Failed to fetch the Google Maps script'), true)).toBe('network');
    expect(classifyGoogleMapsLoadFailure(new Error('Anything'), false)).toBe('network');
  });

  it('detects native Google Maps error panels in English and French', () => {
    expect(containsNativeGoogleMapErrorText("This page can't load Google Maps correctly.")).toBe(true);
    expect(containsNativeGoogleMapErrorText("Google Maps ne s'est pas chargé correctement sur cette page.")).toBe(true);
    expect(containsNativeGoogleMapErrorText('Pour plus d’informations techniques, veuillez consulter la console JavaScript.')).toBe(true);
  });
});
