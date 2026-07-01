import type { OrderStatus } from './supabase';

/**
 * Strict order state machine. Returns allowed transitions from current status.
 * Invalid transitions must be silently rejected by the UI.
 *
 * Pending → Accepted → Preparing → Out for Delivery → Delivered
 * Pending/Accepted/Preparing → Cancelled
 * Out for Delivery → Delivered | Failed Delivery
 * Delivered/Cancelled/Failed Delivery → Refunded
 */
const ALLOWED: Record<OrderStatus, OrderStatus[]> = {
  pending: ['accepted', 'cancelled'],
  accepted: ['preparing', 'cancelled'],
  preparing: ['out_for_delivery', 'cancelled'],
  out_for_delivery: ['delivered', 'failed_delivery', 'cancelled'],
  delivered: ['refunded'],
  cancelled: ['refunded'],
  failed_delivery: ['refunded'],
  refunded: [],
};

export function nextStatuses(current: OrderStatus): OrderStatus[] {
  return ALLOWED[current] ?? [];
}

export function canTransition(current: OrderStatus, to: OrderStatus): boolean {
  return (ALLOWED[current] ?? []).includes(to);
}

/** UI labels per status transition button */
export const STATUS_ACTION_LABEL: Record<OrderStatus, string> = {
  pending: 'status.accept',
  accepted: 'status.startPreparing',
  preparing: 'status.markOutForDelivery',
  out_for_delivery: 'status.markDelivered',
  delivered: 'status.delivered',
  cancelled: 'status.cancelled',
  failed_delivery: 'status.markFailedDelivery',
  refunded: 'status.refunded',
};
