import { describe, expect, it, vi } from 'vitest';
import { classifyGeolocationError, getAccuracyQuality, haversineKm, isCoordinateInAlgeria, isUsableAccuracy, searchAddresses, shouldPrioritizeGps } from './geo';

describe('geolocation safety', () => {
  it('accepts Constantine coordinates in latitude-longitude order', () => {
    expect(isCoordinateInAlgeria(36.365, 6.6147)).toBe(true);
  });

  it('rejects reversed Constantine coordinates', () => {
    expect(isCoordinateInAlgeria(6.6147, 36.365)).toBe(false);
  });

  it.each([
    [8, 'excellent'],
    [20, 'excellent'],
    [24, 'good'],
    [50, 'good'],
    [51, 'acceptable'],
    [150, 'acceptable'],
    [151, 'weak'],
    [null, 'unknown'],
  ] as const)('classifies %s metre accuracy as %s', (accuracy, expected) => {
    expect(getAccuracyQuality(accuracy)).toBe(expected);
  });

  it('never accepts kilometre-level accuracy for automatic wilaya detection', () => {
    expect(isUsableAccuracy(4000, 'wilaya')).toBe(false);
    expect(isUsableAccuracy(42, 'wilaya')).toBe(true);
    expect(isUsableAccuracy(150, 'customer')).toBe(true);
    expect(isUsableAccuracy(151, 'customer')).toBe(false);
  });

  it('never treats missing, zero, or invalid accuracy as precise', () => {
    expect(isUsableAccuracy(null, 'customer')).toBe(false);
    expect(isUsableAccuracy(0, 'customer')).toBe(false);
    expect(isUsableAccuracy(Number.NaN, 'restaurant')).toBe(false);
  });

  it('calculates a stable short distance', () => {
    const distance = haversineKm(
      { lat: 36.365, lng: 6.6147 },
      { lat: 36.375, lng: 6.6247 },
    );
    expect(distance).toBeGreaterThan(1);
    expect(distance).toBeLessThan(2);
  });

  it('classifies denied, unavailable, and timeout as distinct failures', () => {
    expect(classifyGeolocationError(geoError(1))).toBe('permission_denied');
    expect(classifyGeolocationError(geoError(2))).toBe('position_unavailable');
    expect(classifyGeolocationError(geoError(3))).toBe('timeout');
    expect(classifyGeolocationError({ ...geoError(2), code: '2' } as unknown as GeolocationPositionError)).toBe('position_unavailable');
  });

  it('prioritizes GPS only for compact coarse-pointer devices', () => {
    expect(shouldPrioritizeGps(true, true, 390)).toBe(true);
    expect(shouldPrioritizeGps(true, false, 1440)).toBe(false);
    expect(shouldPrioritizeGps(true, true, 1024)).toBe(false);
    expect(shouldPrioritizeGps(false, true, 390)).toBe(false);
  });

  it('retries a transient fallback address-search failure', async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn()
      .mockRejectedValueOnce(new TypeError('temporary network failure'))
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [{
          lat: '36.365',
          lon: '6.6147',
          display_name: 'Constantine, Algeria',
          place_id: 25,
        }],
      });
    vi.stubGlobal('fetch', fetchMock);

    const pending = searchAddresses('Constantine', 'fr', 3);
    await vi.runAllTimersAsync();
    const results = await pending;

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(results[0]).toMatchObject({
      lat: 36.365,
      lng: 6.6147,
      label: 'Constantine, Algeria',
    });
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });
});

function geoError(code: number): GeolocationPositionError {
  return { code, message: `error ${code}`, PERMISSION_DENIED: 1, POSITION_UNAVAILABLE: 2, TIMEOUT: 3 } as GeolocationPositionError;
}
