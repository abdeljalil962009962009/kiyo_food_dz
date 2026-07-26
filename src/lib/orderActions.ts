import type { OrderRow } from './supabase';
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

    const subject = locale === 'ar'
      ? `طلب إلغاء الطلب #${order.id.slice(0, 8)}`
      : locale === 'fr'
        ? `Demande d’annulation de la commande #${order.id.slice(0, 8)}`
        : `Cancellation request for order #${order.id.slice(0, 8)}`;
    const body = locale === 'ar'
      ? 'تعذّر الإلغاء التلقائي. يرجى مراجعة هذا الطلب ومساعدة العميل في أقرب وقت.'
      : locale === 'fr'
        ? 'L’annulation automatique n’était plus disponible. Merci de vérifier rapidement cette commande et d’aider le client.'
        : 'Automatic cancellation was no longer available. Please review this order quickly and help the customer.';
    const { error: ticketError } = await callUserAction('create_support_ticket', {
      p_subject: subject,
      p_body: body,
      p_category: 'complaint',
      p_priority: order.status === 'pending' ? 'high' : 'normal',
      p_order_id: order.id,
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
