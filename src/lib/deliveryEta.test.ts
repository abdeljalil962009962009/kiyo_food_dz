import { describe, expect, it } from 'vitest';
import { checkoutEtaWindow, liveEtaWindow } from './deliveryEta';

describe('delivery ETA', () => {
  it('adds preparation time and a conservative safety margin', () => {
    expect(checkoutEtaWindow(12, 20)).toEqual({
      minimumMinutes: 32,
      maximumMinutes: 37,
      delayed: false,
    });
  });

  it('updates the remaining range as time passes', () => {
    const createdAt = new Date('2026-07-17T10:00:00Z').toISOString();
    expect(liveEtaWindow({
      status: 'preparing',
      createdAt,
      routeMinutes: 10,
      preparationMinutes: 20,
      now: Date.parse('2026-07-17T10:10:00Z'),
    })).toEqual({ minimumMinutes: 20, maximumMinutes: 25, delayed: false });
  });

  it('shows an honest refreshed range when an order runs late', () => {
    const result = liveEtaWindow({
      status: 'out_for_delivery',
      createdAt: '2026-07-17T10:00:00Z',
      routeMinutes: 12,
      preparationMinutes: 20,
      now: Date.parse('2026-07-17T11:00:00Z'),
    });
    expect(result).toEqual({ minimumMinutes: 12, maximumMinutes: 17, delayed: true });
  });
});
