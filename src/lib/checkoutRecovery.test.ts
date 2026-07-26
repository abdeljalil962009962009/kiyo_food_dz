import { describe, expect, it } from 'vitest';
import { checkoutRecovery, deliveryQuoteNeedsRefresh } from './checkoutRecovery';

describe('checkout recovery', () => {
  it('distinguishes an expired route quote from a generic failure', () => {
    expect(checkoutRecovery(
      { message: 'Delivery route quote is missing, expired, or already used.' },
      'en',
      'Fallback',
    )).toEqual({
      kind: 'refresh_quote',
      message: 'Your road-route price expired. Recalculate it before placing the order.',
    });
  });

  it('gives restaurant closure a clear Arabic recovery message', () => {
    const result = checkoutRecovery(
      { code: '55006', message: 'Restaurant is not currently accepting orders.' },
      'ar',
      'Fallback',
    );
    expect(result.kind).toBe('restaurant_closed');
    expect(result.message).toContain('سلتك محفوظة');
  });

  it('sends changed items and options back to cart review', () => {
    expect(checkoutRecovery(
      { message: 'A selected option is unavailable or does not belong to this dish.' },
      'fr',
      'Fallback',
    ).kind).toBe('review_cart');
  });

  it('preserves the caller fallback for unrelated failures', () => {
    expect(checkoutRecovery(new Error('unexpected'), 'en', 'Try again.')).toEqual({
      kind: 'generic',
      message: 'Try again.',
    });
  });
});

describe('delivery quote freshness', () => {
  const now = Date.parse('2026-07-26T12:00:00Z');

  it('accepts a quote with more than the safety window remaining', () => {
    expect(deliveryQuoteNeedsRefresh('2026-07-26T12:01:00Z', now)).toBe(false);
  });

  it('requires refresh inside the safety window or for an invalid expiry', () => {
    expect(deliveryQuoteNeedsRefresh('2026-07-26T12:00:20Z', now)).toBe(true);
    expect(deliveryQuoteNeedsRefresh(undefined, now)).toBe(true);
  });
});
