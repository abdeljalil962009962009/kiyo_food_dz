export type DeliveryRuleSource = 'restaurant' | 'wilaya' | 'global';

export type EffectiveDeliveryRules = {
  delivery: {
    max_delivery_km: number;
    minimum_order: number;
    [key: string]: unknown;
  };
  sources: {
    max_delivery_km: DeliveryRuleSource;
    minimum_order: DeliveryRuleSource;
    [key: string]: unknown;
  };
};

export function deliveryRuleNumber(
  rules: EffectiveDeliveryRules | null | undefined,
  key: 'max_delivery_km' | 'minimum_order',
  fallback: number,
): number {
  const value = Number(rules?.delivery?.[key]);
  return Number.isFinite(value) && value >= 0 ? value : fallback;
}
