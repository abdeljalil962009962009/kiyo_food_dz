import { describe, expect, it } from 'vitest';
import type { Restaurant, RestaurantSpecialHours } from './supabase';
import { restaurantAcceptsOrders } from './restaurantAvailability';

const restaurant = {
  status: 'published',
  operational_status: 'open',
  is_vacation_mode: false,
  timezone: 'Africa/Algiers',
  opening_hours: {
    '1': { open: '09:00', close: '22:00' },
    '2': { open: '20:00', close: '02:00' },
  },
} as Pick<Restaurant, 'status' | 'operational_status' | 'is_vacation_mode' | 'timezone' | 'opening_hours'>;

describe('restaurant availability', () => {
  it('respects publication, manual closure, and vacation mode', () => {
    const mondayNoon = new Date('2026-07-27T11:00:00Z');
    expect(restaurantAcceptsOrders(restaurant, [], mondayNoon)).toBe(true);
    expect(restaurantAcceptsOrders({ ...restaurant, status: 'suspended' }, [], mondayNoon)).toBe(false);
    expect(restaurantAcceptsOrders({ ...restaurant, operational_status: 'closed' }, [], mondayNoon)).toBe(false);
    expect(restaurantAcceptsOrders({ ...restaurant, is_vacation_mode: true }, [], mondayNoon)).toBe(false);
  });

  it('supports regular overnight hours on both sides of midnight', () => {
    expect(restaurantAcceptsOrders(restaurant, [], new Date('2026-07-28T22:30:00Z'))).toBe(true);
    expect(restaurantAcceptsOrders(restaurant, [], new Date('2026-07-29T00:30:00Z'))).toBe(true);
    expect(restaurantAcceptsOrders(restaurant, [], new Date('2026-07-29T02:30:00Z'))).toBe(false);
  });

  it('lets special closures and special opening windows override regular hours', () => {
    const closed: RestaurantSpecialHours[] = [{
      id: '1', restaurant_id: 'r', date: '2026-07-27', is_closed: true,
      open_time: null, close_time: null, reason: 'Holiday', created_at: '',
    }];
    expect(restaurantAcceptsOrders(restaurant, closed, new Date('2026-07-27T11:00:00Z'))).toBe(false);

    const special: RestaurantSpecialHours[] = [{
      ...closed[0], is_closed: false, open_time: '14:00', close_time: '18:00',
    }];
    expect(restaurantAcceptsOrders(restaurant, special, new Date('2026-07-27T15:00:00Z'))).toBe(true);
    expect(restaurantAcceptsOrders(restaurant, special, new Date('2026-07-27T11:00:00Z'))).toBe(false);
  });
});
