import { describe, expect, it } from 'vitest';
import { classifyGoogleMapsLoadFailure } from './googleMapsRuntime';

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
});
