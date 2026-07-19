import { describe, expect, it } from 'vitest';
import { legalDocuments, legalUi, type LegalDocumentId } from './legalContent';

const documentIds: LegalDocumentId[] = ['terms', 'privacy', 'refund', 'restaurantAgreement', 'cookies', 'accountDeletion'];

describe('localized legal content', () => {
  it('provides every public legal document in French, Arabic and English', () => {
    for (const locale of ['en', 'fr', 'ar'] as const) {
      expect(legalUi[locale].back.length).toBeGreaterThan(0);
      for (const id of documentIds) {
        const document = legalDocuments[locale][id];
        expect(document.title.length).toBeGreaterThan(0);
        expect(document.sections.length).toBeGreaterThanOrEqual(5);
        expect(document.sections.every((section) => section.heading && section.body)).toBe(true);
      }
    }
  });

  it('does not hard-code mutable commission percentages into the partnership agreement', () => {
    for (const locale of ['en', 'fr', 'ar'] as const) {
      const agreement = legalDocuments[locale].restaurantAgreement.sections.map((section) => section.body).join(' ');
      expect(agreement).not.toMatch(/\d+(?:[.,]\d+)?\s*%/);
      expect(agreement.toLowerCase()).not.toContain('currently set');
    }
  });
});
