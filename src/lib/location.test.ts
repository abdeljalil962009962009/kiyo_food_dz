import { describe, expect, it } from 'vitest';
import { isConfirmedDeliveryLocation, locationPrimaryLine, restoreDeliveryLocation, restoreLastMapState, type DeliveryLocation } from './location';

const LOCATION: DeliveryLocation = {
  lat: 36.365,
  lng: 6.6147,
  address: 'Ali Mendjeli, Constantine, Algeria',
  accuracy: 12,
  source: 'gps',
  confirmed: true,
  placeId: 'google-place-id',
  addressQuality: 'precise',
  addressParts: {
    displayName: 'Ali Mendjeli, Constantine, Algeria',
    neighborhood: 'Ali Mendjeli',
    commune: 'El Khroub',
    province: 'Constantine',
    country: 'Algeria',
    provider: 'google',
  },
  requiresManualAdjustment: false,
  confirmedAt: new Date().toISOString(),
};

describe('confirmed delivery location', () => {
  it('requires valid exact coordinates and an explicit confirmation', () => {
    expect(isConfirmedDeliveryLocation(LOCATION)).toBe(true);
    expect(isConfirmedDeliveryLocation({ ...LOCATION, confirmed: false })).toBe(false);
    expect(isConfirmedDeliveryLocation({ ...LOCATION, lat: 6.6147, lng: 36.365 })).toBe(false);
    expect(isConfirmedDeliveryLocation({ ...LOCATION, requiresManualAdjustment: true })).toBe(false);
  });

  it('restores a recent valid location with delivery details', () => {
    const restored = restoreDeliveryLocation(JSON.stringify({
      ...LOCATION,
      details: { building: 'legacy', floor: '4', landmark: 'Blue mosque', instructions: 'Call on arrival' },
    }));
    expect(restored?.lat).toBe(36.365);
    expect(restored?.details).toEqual({ landmark: 'Blue mosque', instructions: 'Call on arrival' });
    expect(restored?.details).not.toHaveProperty('building');
    expect(restored?.details).not.toHaveProperty('floor');
  });

  it('rejects stale persisted coordinates', () => {
    const stale = { ...LOCATION, confirmedAt: '2020-01-01T00:00:00.000Z' };
    expect(restoreDeliveryLocation(JSON.stringify(stale))).toBeNull();
  });

  it('uses neighborhood or street instead of displaying only the wilaya', () => {
    expect(locationPrimaryLine(LOCATION)).toBe('Ali Mendjeli');
  });

  it('restores a recent map state without treating it as confirmed', () => {
    const cached = restoreLastMapState(JSON.stringify({ ...LOCATION, cachedAt: new Date().toISOString() }));
    expect(cached?.lat).toBe(36.365);
    expect(cached?.confirmed).toBe(false);
    expect(cached?.requiresManualAdjustment).toBe(true);
  });
});
