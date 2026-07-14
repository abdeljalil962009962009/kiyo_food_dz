import { describe, expect, it } from 'vitest';
import { localizePublicationBlocker } from './publicationReadiness';

describe('publication readiness localization', () => {
  it('localizes known blockers in all supported languages', () => {
    const blocker = 'No menu category exists.';
    expect(localizePublicationBlocker(blocker, 'en')).toBe('Create at least one menu category.');
    expect(localizePublicationBlocker(blocker, 'fr')).toBe('Créez au moins une catégorie de menu.');
    expect(localizePublicationBlocker(blocker, 'ar')).toContain('فئة');
  });

  it('preserves an unknown server blocker for diagnostics', () => {
    expect(localizePublicationBlocker('Unexpected readiness rule.', 'fr')).toBe('Unexpected readiness rule.');
  });
});
