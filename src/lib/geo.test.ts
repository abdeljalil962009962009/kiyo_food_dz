import { describe, expect, it } from 'vitest';
import { getAccuracyQuality, haversineKm, isCoordinateInAlgeria, isUsableAccuracy } from './geo';

describe('geolocation safety', () => {
  it('accepts Constantine coordinates in latitude-longitude order', () => {
    expect(isCoordinateInAlgeria(36.365, 6.6147)).toBe(true);
  });

  it('rejects reversed Constantine coordinates', () => {
    expect(isCoordinateInAlgeria(6.6147, 36.365)).toBe(false);
  });

  it.each([
    [8, 'excellent'],
    [24, 'good'],
    [45, 'acceptable'],
    [85, 'weak'],
    [null, 'unknown'],
  ] as const)('classifies %s metre accuracy as %s', (accuracy, expected) => {
    expect(getAccuracyQuality(accuracy)).toBe(expected);
  });

  it('never accepts kilometre-level accuracy for automatic wilaya detection', () => {
    expect(isUsableAccuracy(4000, 'wilaya')).toBe(false);
    expect(isUsableAccuracy(42, 'wilaya')).toBe(true);
  });

  it('calculates a stable short distance', () => {
    const distance = haversineKm(
      { lat: 36.365, lng: 6.6147 },
      { lat: 36.375, lng: 6.6247 },
    );
    expect(distance).toBeGreaterThan(1);
    expect(distance).toBeLessThan(2);
  });
});

