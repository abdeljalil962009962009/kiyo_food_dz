import { describe, expect, it } from 'vitest';
import { deliveryRuleNumber, type EffectiveDeliveryRules } from './deliveryRules';

const rules: EffectiveDeliveryRules = {
  delivery: {
    max_delivery_km: 12.5,
    minimum_order: 700,
  },
  sources: {
    max_delivery_km: 'wilaya',
    minimum_order: 'restaurant',
  },
};

describe('deliveryRuleNumber', () => {
  it('reads the authoritative effective value', () => {
    expect(deliveryRuleNumber(rules, 'max_delivery_km', 10)).toBe(12.5);
    expect(deliveryRuleNumber(rules, 'minimum_order', 0)).toBe(700);
  });

  it('uses the safe fallback for absent or invalid values', () => {
    expect(deliveryRuleNumber(null, 'max_delivery_km', 10)).toBe(10);
    expect(deliveryRuleNumber({
      ...rules,
      delivery: { ...rules.delivery, minimum_order: Number.NaN },
    }, 'minimum_order', 0)).toBe(0);
  });
});
