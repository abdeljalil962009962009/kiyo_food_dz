import type { OrderStatus } from './supabase';

export type EtaWindow = {
  minimumMinutes: number;
  maximumMinutes: number;
  delayed: boolean;
};

export function checkoutEtaWindow(routeMinutes: number, preparationMinutes = 20): EtaWindow {
  const route = Math.max(1, Math.ceil(routeMinutes));
  const preparation = Math.max(5, Math.ceil(preparationMinutes));
  const expected = route + preparation;
  const buffer = Math.max(5, Math.ceil(expected * 0.15));
  return {
    minimumMinutes: expected,
    maximumMinutes: expected + buffer,
    delayed: false,
  };
}

export function liveEtaWindow(input: {
  status: OrderStatus;
  createdAt: string;
  routeMinutes?: number | null;
  preparationMinutes?: number | null;
  now?: number;
}): EtaWindow | null {
  if (['delivered', 'cancelled', 'failed_delivery', 'refunded'].includes(input.status)) return null;

  const route = Math.max(1, Math.ceil(input.routeMinutes ?? 15));
  const preparation = Math.max(5, Math.ceil(input.preparationMinutes ?? 20));
  const initial = checkoutEtaWindow(route, preparation);
  const createdAt = Date.parse(input.createdAt);
  const elapsed = Number.isFinite(createdAt)
    ? Math.max(0, Math.floor(((input.now ?? Date.now()) - createdAt) / 60_000))
    : 0;
  const delayed = elapsed > initial.maximumMinutes;

  if (delayed) {
    const fallback = input.status === 'out_for_delivery' ? route : route + Math.ceil(preparation / 2);
    return {
      minimumMinutes: Math.max(5, fallback),
      maximumMinutes: Math.max(10, fallback + Math.max(5, Math.ceil(fallback * 0.2))),
      delayed: true,
    };
  }

  return {
    minimumMinutes: Math.max(1, initial.minimumMinutes - elapsed),
    maximumMinutes: Math.max(5, initial.maximumMinutes - elapsed),
    delayed: false,
  };
}
