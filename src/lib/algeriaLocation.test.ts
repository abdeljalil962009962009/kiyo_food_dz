import { describe, expect, it } from 'vitest';
import { matchWilayaFromAddress, matchWilayaName, normalizeWilayaText, type AlgeriaWilaya } from './algeriaLocation';

const WILAYAS: AlgeriaWilaya[] = [
  { id: 25, code: 'CON', name_en: 'Constantine', name_fr: 'Constantine', name_ar: 'قسنطينة' },
  { id: 43, code: 'MIL', name_en: 'Mila', name_fr: 'Mila', name_ar: 'ميلة' },
];

describe('Algeria wilaya matching', () => {
  it.each([
    ['Constantine', 25],
    ['Wilaya de Constantine', 25],
    ['قسنطينة', 25],
    ['25', 25],
    ['Mila Province', 43],
    ['ولاية ميلة', 43],
    ['43', 43],
  ])('normalizes %s to wilaya %s', (value, expectedId) => {
    expect(matchWilayaName(value, WILAYAS)?.id).toBe(expectedId);
  });

  it('uses the administrative province before a conflicting locality', () => {
    expect(matchWilayaFromAddress({
      displayName: 'Border address',
      province: 'Wilaya de Constantine',
      city: 'Mila',
      provider: 'google',
    }, WILAYAS)?.id).toBe(25);
  });

  it('does not confuse Constantine and Mila', () => {
    expect(matchWilayaName('Mila', WILAYAS)?.id).toBe(43);
    expect(matchWilayaName('Constantine', WILAYAS)?.id).toBe(25);
  });

  it('normalizes accents, administration words, and Arabic diacritics', () => {
    expect(normalizeWilayaText('Wilaya de Béjaïa')).toBe('bejaia');
    expect(normalizeWilayaText('وِلَايَة قسنطينة')).toBe('قسنطينه');
  });
});

