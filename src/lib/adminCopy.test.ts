import { describe, expect, it } from 'vitest';
import { adminCopy } from './adminCopy';

describe('owner control center localization', () => {
  it('provides Arabic labels for financial growth controls', () => {
    const copy = adminCopy('ar');
    expect(copy.marketing.promoTitle).toBe('الرموز الترويجية');
    expect(copy.marketing.campaignTitle).toBe('الحملات التسويقية');
    expect(copy.marketing.plansTitle).toBe('خطط الاشتراك');
  });

  it('keeps French as a complete localized fallback', () => {
    const copy = adminCopy('fr');
    expect(copy.analytics.orders).toBe('Analyse des commandes');
    expect(copy.monitoring.auditLogs).toBe('Journal d’audit');
  });
});
