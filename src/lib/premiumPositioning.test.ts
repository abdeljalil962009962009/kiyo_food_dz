import { describe, expect, it } from 'vitest';
import { translate, type Locale, type TranslationKey } from './i18n';

const locales: Locale[] = ['fr', 'ar', 'en'];
const publicBrandKeys: TranslationKey[] = [
  'brand.name',
  'brand.tagline',
  'brand.heroSubtitle',
  'brand.heroFeature1Title',
  'brand.heroFeature1Desc',
  'brand.heroFeature2Title',
  'brand.heroFeature2Desc',
  'brand.heroFeature3Title',
  'brand.heroFeature3Desc',
  'brand.heroFeature4Title',
  'brand.heroFeature4Desc',
  'brand.heroFeature5Title',
  'brand.heroFeature5Desc',
  'brand.heroFeature6Title',
  'brand.heroFeature6Desc',
  'brand.whyKiyo',
  'brand.seoDescription',
];

describe('premium positioning copy', () => {
  it('keeps the public brand experience complete and free from encoding corruption', () => {
    for (const locale of locales) {
      for (const key of publicBrandKeys) {
        const value = translate(locale, key);
        expect(value.trim(), `${locale}:${key}`).not.toBe('');
        expect(value, `${locale}:${key}`).not.toMatch(/Ã|Â|Ø|Ù|�|â€™|â€œ|â€/);
      }
    }
  });

  it('does not use unsupported superiority or speed claims', () => {
    const allEnglish = publicBrandKeys.map((key) => translate('en', key)).join(' ');
    const allFrench = publicBrandKeys.map((key) => translate('fr', key)).join(' ');
    const allArabic = publicBrandKeys.map((key) => translate('ar', key)).join(' ');

    expect(allEnglish).not.toMatch(/\bbest\b|\bfastest\b|\bnumber one\b|verified for quality/i);
    expect(allFrench).not.toMatch(/\bmeilleurs?\b|\bnuméro un\b|\bplus rapide\b/i);
    expect(allArabic).not.toMatch(/أفضل|الأسرع|رقم واحد/);
  });

  it('explains authoritative road-route and Cash on Delivery validation in every language', () => {
    expect(translate('en', 'checkout.placeOrderSummary')).toContain('road');
    expect(translate('fr', 'checkout.placeOrderSummary')).toContain('trajet routier');
    expect(translate('ar', 'checkout.placeOrderSummary')).toContain('المسار الطرقي');

    for (const locale of locales) {
      expect(translate(locale, 'checkout.placeOrderSummary')).not.toMatch(/Ã|Â|Ø|Ù|�/);
    }
  });
});
