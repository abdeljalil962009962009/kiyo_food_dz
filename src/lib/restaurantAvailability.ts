import type { Restaurant, RestaurantSpecialHours } from './supabase';

type AvailabilityRestaurant = Pick<
  Restaurant,
  'status' | 'operational_status' | 'is_vacation_mode' | 'opening_hours' | 'timezone'
>;

const WEEKDAY_INDEX: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

function timeMinutes(value: string | null | undefined): number | null {
  const match = /^([01]\d|2[0-3]):([0-5]\d)/.exec(value ?? '');
  return match ? Number(match[1]) * 60 + Number(match[2]) : null;
}

function previousDate(value: string): string {
  const [year, month, day] = value.split('-').map(Number);
  const previous = new Date(Date.UTC(year, month - 1, day - 1));
  return previous.toISOString().slice(0, 10);
}

function zonedParts(at: Date, timeZone: string) {
  try {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone,
      weekday: 'short',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(at);
    const value = (type: Intl.DateTimeFormatPartTypes) =>
      parts.find((part) => part.type === type)?.value ?? '';
    const weekday = WEEKDAY_INDEX[value('weekday')];
    if (weekday == null) throw new Error('invalid_weekday');
    return {
      date: `${value('year')}-${value('month')}-${value('day')}`,
      weekday,
      minutes: Number(value('hour')) * 60 + Number(value('minute')),
    };
  } catch {
    return zonedParts(at, 'Africa/Algiers');
  }
}

function currentWindowAllows(open: number | null, close: number | null, minutes: number) {
  if (open == null || close == null || open === close) return false;
  return open < close ? minutes >= open && minutes < close : minutes >= open;
}

function previousOvernightAllows(open: number | null, close: number | null, minutes: number) {
  return open != null && close != null && open > close && minutes < close;
}

export function restaurantAcceptsOrders(
  restaurant: AvailabilityRestaurant,
  specialHours: RestaurantSpecialHours[] = [],
  at = new Date(),
): boolean {
  if (
    restaurant.status !== 'published'
    || restaurant.operational_status === 'closed'
    || restaurant.is_vacation_mode
  ) return false;

  const local = zonedParts(at, restaurant.timezone || 'Africa/Algiers');
  const yesterday = previousDate(local.date);
  const todaySpecial = specialHours.find((entry) => entry.date === local.date);
  const yesterdaySpecial = specialHours.find((entry) => entry.date === yesterday);

  if (todaySpecial) {
    if (todaySpecial.is_closed) return false;
    if (currentWindowAllows(
      timeMinutes(todaySpecial.open_time),
      timeMinutes(todaySpecial.close_time),
      local.minutes,
    )) return true;
  } else {
    const today = restaurant.opening_hours?.[String(local.weekday)];
    if (currentWindowAllows(timeMinutes(today?.open), timeMinutes(today?.close), local.minutes)) {
      return true;
    }
  }

  if (yesterdaySpecial) {
    if (yesterdaySpecial.is_closed) return false;
    return previousOvernightAllows(
      timeMinutes(yesterdaySpecial.open_time),
      timeMinutes(yesterdaySpecial.close_time),
      local.minutes,
    );
  }

  const previousDay = restaurant.opening_hours?.[String((local.weekday + 6) % 7)];
  return previousOvernightAllows(
    timeMinutes(previousDay?.open),
    timeMinutes(previousDay?.close),
    local.minutes,
  );
}

export function algeriaAvailabilityDateRange(at = new Date()) {
  const local = zonedParts(at, 'Africa/Algiers');
  return { from: previousDate(local.date), to: local.date };
}
