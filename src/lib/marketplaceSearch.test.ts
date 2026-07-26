import { describe, expect, it } from 'vitest';
import { sanitizeMarketplaceSearchTerm, scoreMarketplaceRestaurant } from './marketplaceSearch';

describe('marketplace search', () => {
  it('removes wildcard and grouping characters while preserving multilingual text', () => {
    expect(sanitizeMarketplaceSearchTerm('  pizza%_(قسنطينة),  ')).toBe('pizza قسنطينة');
  });

  it('ranks restaurant names above dish and description matches', () => {
    expect(scoreMarketplaceRestaurant({ name: 'Pizza House' }, 'pizza')).toBe(90);
    expect(scoreMarketplaceRestaurant({ name: 'Kiyo Kitchen' }, 'pizza', 'Pizza reine')).toBe(64);
    expect(scoreMarketplaceRestaurant({ name: 'Kiyo Kitchen', description: 'Fresh pizza daily' }, 'pizza')).toBe(50);
  });

  it('uses proximity only as a tie-breaker for relevant results', () => {
    const near = scoreMarketplaceRestaurant({ name: 'Kiyo', cuisine: ['grill'], distance_km: 1 }, 'grill');
    const far = scoreMarketplaceRestaurant({ name: 'Kiyo', cuisine: ['grill'], distance_km: 15 }, 'grill');
    expect(near).toBeGreaterThan(far);
    expect(scoreMarketplaceRestaurant({ name: 'Kiyo', distance_km: 1 }, 'sushi')).toBe(0);
  });
});
