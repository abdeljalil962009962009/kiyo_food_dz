import { supabase, type OrderRow } from './supabase';
import { callUserAction } from './userApi';
import type { Locale } from './i18n';
import { userFacingError } from './userFacingError';

export type CustomerCancelResult =
  | { status: 'cancelled' }
  | { status: 'support_created' }
  | { status: 'failed'; message: string };

type CancellableOrder = Pick<OrderRow, 'id' | 'customer_id' | 'restaurant_id' | 'status' | 'updated_at'>;

export async function requestCustomerCancellation(order: CancellableOrder, locale: Locale = 'fr'): Promise<CustomerCancelResult> {
  try {
    if (order.status === 'pending') {
      const { data, error } = await callUserAction<{ id: string }>('transition_order_status', {
        p_order_id: order.id,
        p_target_status: 'cancelled',
        p_reason: 'Customer cancelled before restaurant preparation',
        p_expected_updated_at: order.updated_at,
      });

      if (!error && data?.id) {
        return { status: 'cancelled' };
      }
    }

    const { error: ticketError } = await supabase.from('support_tickets').insert({
      requester_id: order.customer_id,
      restaurant_id: order.restaurant_id,
      order_id: order.id,
      subject: `Cancellation request for order #${order.id.slice(0, 8)}`,
      body: order.status === 'pending'
        ? 'Customer requested cancellation, but direct cancellation was not available. Please review this order quickly.'
        : `Customer requested help cancelling an order currently marked as "${order.status}".`,
      category: 'complaint',
      priority: order.status === 'pending' ? 'high' : 'normal',
    });

    if (ticketError) throw ticketError;
    return { status: 'support_created' };
  } catch (err) {
    return {
      status: 'failed',
      message: userFacingError(
        err,
        locale,
        locale === 'ar'
          ? 'تعذر إرسال طلب الإلغاء. افتح دعم الطلب وحاول مجدداً.'
          : locale === 'fr'
            ? 'La demande d’annulation n’a pas pu être envoyée. Ouvrez l’assistance de la commande puis réessayez.'
            : 'The cancellation request could not be sent. Open order support and try again.',
      ),
    };
  }
}
