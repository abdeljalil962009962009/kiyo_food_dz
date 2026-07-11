import { describe, expect, it } from 'vitest';
import { parseGoogleAddressComponents } from './googleMaps';
import { matchWilayaName, type AlgeriaWilaya } from './algeriaLocation';

const WILAYAS: AlgeriaWilaya[] = [
  { id: 25, code: 'CON', name_en: 'Constantine', name_fr: 'Constantine', name_ar: 'قسنطينة' },
  { id: 43, code: 'MIL', name_en: 'Mila', name_fr: 'Mila', name_ar: 'ميلة' },
];

describe('Google address component parser', () => {
  it('keeps locality, commune, and wilaya as separate fields', () => {
    const parsed = parseGoogleAddressComponents({
      displayName: '12 Rue Exemple, Ali Mendjeli, El Khroub, Constantine, Algeria',
      placeId: 'place-25',
      components: [
        { long_name: '12', types: ['street_number'] },
        { long_name: 'Rue Exemple', types: ['route'] },
        { long_name: 'Ali Mendjeli', types: ['neighborhood'] },
        { long_name: 'El Khroub', types: ['locality'] },
        { long_name: 'Constantine', types: ['administrative_area_level_1'] },
        { long_name: '25000', types: ['postal_code'] },
        { long_name: 'Algeria', types: ['country'] },
      ],
    });
    expect(parsed.street).toBe('12 Rue Exemple');
    expect(parsed.neighborhood).toBe('Ali Mendjeli');
    expect(parsed.commune).toBe('El Khroub');
    expect(parsed.province).toBe('Constantine');
    expect(matchWilayaName(parsed.province, WILAYAS)?.id).toBe(25);
  });

  it('recognizes Arabic Google components without falling back to Mila', () => {
    const parsed = parseGoogleAddressComponents({
      displayName: 'الخروب، قسنطينة، الجزائر',
      components: [
        { longText: 'الخروب', types: ['locality'] },
        { longText: 'قسنطينة', types: ['administrative_area_level_1'] },
        { longText: 'الجزائر', types: ['country'] },
      ],
    });
    expect(matchWilayaName(parsed.province, WILAYAS)?.id).toBe(25);
  });
});

