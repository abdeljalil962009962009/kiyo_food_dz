import { describe, expect, it } from 'vitest';
import { loyaltyPointsForTotal, normalizeLoyaltyRules } from './loyaltyRules';

describe('loyalty rules', () => {
  it('normalizes the current owner-control fields', () => {
    expect(normalizeLoyaltyRules({
      loyalty_enabled: true,
      points_per_hundred: 5,
      point_value_dzd: 2,
    })).toEqual({ enabled: true, pointsPerHundred: 5, pointValueDzd: 2 });
  });

  it('supports the legacy points-per-DZD field without changing its value', () => {
    expect(normalizeLoyaltyRules({
      loyalty_enabled: true,
      points_per_dzd: 0.01,
      points_redemption_rate: 1,
    })).toEqual({ enabled: true, pointsPerHundred: 1, pointValueDzd: 1 });
  });

  it('never awards points when disabled or given an invalid total', () => {
    const rules = { enabled: false, pointsPerHundred: 5, pointValueDzd: 1 };
    expect(loyaltyPointsForTotal(2_000, rules)).toBe(0);
    expect(loyaltyPointsForTotal(Number.NaN, { ...rules, enabled: true })).toBe(0);
  });

  it('uses the owner-configured earning rate', () => {
    const rules = { enabled: true, pointsPerHundred: 5, pointValueDzd: 1 };
    expect(loyaltyPointsForTotal(1_250, rules)).toBe(62);
  });
});
