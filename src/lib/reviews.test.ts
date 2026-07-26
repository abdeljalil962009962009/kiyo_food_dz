import { describe, expect, it } from 'vitest';
import type { ReviewRow } from './supabase';
import { applyReviewChange } from './reviews';

const review = (id: string, createdAt: string, overrides: Partial<ReviewRow> = {}): ReviewRow => ({
  id,
  restaurant_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  customer_id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  order_id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
  rating: 5,
  comment: 'Excellent',
  owner_reply: null,
  replied_at: null,
  is_hidden: false,
  created_at: createdAt,
  updated_at: createdAt,
  ...overrides,
});

describe('review realtime updates', () => {
  it('inserts and sorts a new visible review', () => {
    const older = review('old', '2026-07-20T10:00:00Z');
    const newer = review('new', '2026-07-21T10:00:00Z');
    expect(applyReviewChange([older], {
      eventType: 'INSERT',
      new: newer,
      old: {},
    }).map((item) => item.id)).toEqual(['new', 'old']);
  });

  it('updates a restaurant reply without duplicating the review', () => {
    const original = review('one', '2026-07-20T10:00:00Z');
    const updated = { ...original, owner_reply: 'Thank you.' };
    expect(applyReviewChange([original], {
      eventType: 'UPDATE',
      new: updated,
      old: original,
    })).toEqual([updated]);
  });

  it('removes deleted or moderated reviews from customer-facing state', () => {
    const original = review('one', '2026-07-20T10:00:00Z');
    expect(applyReviewChange([original], {
      eventType: 'UPDATE',
      new: { ...original, is_hidden: true },
      old: original,
    })).toEqual([]);
  });
});
