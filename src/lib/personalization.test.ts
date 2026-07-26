import { describe, expect, it } from 'vitest';
import {
  pickUsualRestaurant,
  usualRestaurantIsAvailable,
  type RecentRestaurantSummary,
} from './personalization';

function summary(
  id: string,
  orderCount: number,
  lastOrderAt: string,
  overrides: Partial<NonNullable<RecentRestaurantSummary['restaurants']>> = {},
): RecentRestaurantSummary {
  return {
    restaurant_id: id,
    order_count: orderCount,
    last_order_at: lastOrderAt,
    restaurants: {
      id,
      name: `Restaurant ${id}`,
      image_url: null,
      rating: 4.5,
      estimated_delivery_min: 30,
      status: 'published',
      operational_status: 'open',
      is_vacation_mode: false,
      ...overrides,
    },
  };
}

describe('returning-customer personalization', () => {
  it('selects the most frequently ordered published restaurant', () => {
    const selected = pickUsualRestaurant([
      summary('recent', 2, '2026-07-25T10:00:00Z'),
      summary('usual', 5, '2026-07-20T10:00:00Z'),
    ]);

    expect(selected?.id).toBe('usual');
    expect(selected?.orderCount).toBe(5);
  });

  it('uses the latest delivered order to break equal-frequency ties', () => {
    const selected = pickUsualRestaurant([
      summary('older', 3, '2026-07-20T10:00:00Z'),
      summary('newer', 3, '2026-07-25T10:00:00Z'),
    ]);

    expect(selected?.id).toBe('newer');
  });

  it('never recommends an unpublished restaurant', () => {
    const selected = pickUsualRestaurant([
      summary('hidden', 20, '2026-07-25T10:00:00Z', { status: 'suspended' }),
      summary('public', 2, '2026-07-20T10:00:00Z'),
    ]);

    expect(selected?.id).toBe('public');
  });

  it('reports closed and vacation-mode restaurants as unavailable', () => {
    const closed = pickUsualRestaurant([
      summary('closed', 2, '2026-07-25T10:00:00Z', { operational_status: 'closed' }),
    ]);
    const vacation = pickUsualRestaurant([
      summary('vacation', 2, '2026-07-25T10:00:00Z', { is_vacation_mode: true }),
    ]);

    expect(closed && usualRestaurantIsAvailable(closed)).toBe(false);
    expect(vacation && usualRestaurantIsAvailable(vacation)).toBe(false);
  });
});
