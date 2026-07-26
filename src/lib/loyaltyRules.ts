export type LoyaltyRules = {
  enabled: boolean;
  pointsPerHundred: number;
  pointValueDzd: number;
};

export const DEFAULT_LOYALTY_RULES: LoyaltyRules = {
  enabled: false,
  pointsPerHundred: 1,
  pointValueDzd: 1,
};

function finiteNonNegative(value: unknown, fallback: number) {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

export function normalizeLoyaltyRules(value: unknown): LoyaltyRules {
  const raw = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  const legacyPointsPerDzd = finiteNonNegative(raw.points_per_dzd, 0);
  const pointsPerHundred = raw.points_per_hundred == null
    ? legacyPointsPerDzd * 100
    : finiteNonNegative(raw.points_per_hundred, DEFAULT_LOYALTY_RULES.pointsPerHundred);

  return {
    enabled: typeof raw.loyalty_enabled === 'boolean'
      ? raw.loyalty_enabled
      : DEFAULT_LOYALTY_RULES.enabled,
    pointsPerHundred,
    pointValueDzd: finiteNonNegative(
      raw.point_value_dzd ?? raw.points_redemption_rate,
      DEFAULT_LOYALTY_RULES.pointValueDzd,
    ),
  };
}

export function loyaltyPointsForTotal(totalDzd: number, rules: LoyaltyRules) {
  if (!rules.enabled || !Number.isFinite(totalDzd) || totalDzd <= 0 || rules.pointsPerHundred <= 0) {
    return 0;
  }
  return Math.floor((totalDzd / 100) * rules.pointsPerHundred);
}
