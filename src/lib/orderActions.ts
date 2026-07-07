import { supabase, type OrderRow } from './supabase';

export type CustomerCancelResult =
  | { status: 'cancelled' }
  | { status: 'support_created' }
  | { status: 'failed'; message: string };

type CancellableOrder = Pick<OrderRow, 'id' | 'customer_id' | 'restaurant_id' | 'status'>;

export async function requestCustomerCancellation(order: CancellableOrder): Promise<CustomerCancelResult> {
  try {
    if (order.status === 'pending') {
      const { data, error } = await supabase
        .from('orders')
        .update({ status: 'cancelled', updated_at: new Date().toISOString() })
        .eq('id', order.id)
        .eq('status', 'pending')
        .select('id')
        .maybeSingle();

      if (!error && data) {
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
      message: err instanceof Error ? err.message : 'Cancellation request failed.',
    };
  }
}
