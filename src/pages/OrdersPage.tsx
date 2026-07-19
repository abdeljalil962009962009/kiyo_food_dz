import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { LifeBuoy, RotateCcw, ShoppingBag, Star, Trash } from 'lucide-react';
import { useT } from '../lib/i18n-react';
import { supabase, type MenuItem, type OrderRow, type OrderItemRow } from '../lib/supabase';
import { useRealtime } from '../lib/useRealtime';
import { useCart, type CartLine } from '../context/CartContext';
import { AppShell } from '../components/AppShell';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { Skeleton, ErrorState, Spinner } from '../components/feedback';
import { StatusBadge, PriceTag, relativeTime } from '../components/ui';
import { ReviewModal } from '../components/ReviewModal';
import { LiveOrderTracker } from '../components/LiveOrderTracker';
import { requestCustomerCancellation } from '../lib/orderActions';

type OrderWithRestaurant = OrderRow & {
  restaurants: {
    id: string;
    name: string;
    latitude: number | null;
    longitude: number | null;
    estimated_delivery_min: number | null;
  } | null;
};

const copy = {
  en: {
    confirmCancel: 'Cancel this order?', cancelled: 'Order cancelled. No refund is needed because payment is Cash on Delivery.',
    supportCreated: 'Automatic cancellation is no longer available. An urgent support request was created.', cancelling: 'Cancelling...', cancel: 'Cancel order',
    cod: 'Cash on Delivery: no money has been collected yet.', help: 'Get help with this order', again: 'Order again', preparing: 'Preparing cart...',
    reorderReady: 'Available items were added using today\u2019s prices.', reorderUnavailable: 'Some items are no longer available and were not added.',
    reorderEmpty: 'None of the original items are currently available. Browse the menu for alternatives.', pricesUpdated: 'Prices were updated to today\u2019s menu.', reviewPrompt: 'How was your last delivery?', reviewBody: 'A quick rating helps local restaurants improve.',
  },
  fr: {
    confirmCancel: 'Annuler cette commande ?', cancelled: 'Commande annul\u00e9e. Aucun remboursement n\u2019est n\u00e9cessaire car le paiement se fait \u00e0 la livraison.',
    supportCreated: 'L\u2019annulation automatique n\u2019est plus disponible. Une demande urgente a \u00e9t\u00e9 cr\u00e9\u00e9e.', cancelling: 'Annulation...', cancel: 'Annuler la commande',
    cod: 'Paiement a la livraison : aucun montant n\u2019a encore \u00e9t\u00e9 encaiss\u00e9.', help: 'Obtenir de l\u2019aide pour cette commande', again: 'Commander a nouveau', preparing: 'Pr\u00e9paration du panier...',
    reorderReady: 'Les articles disponibles ont \u00e9t\u00e9 ajout\u00e9s avec les prix actuels.', reorderUnavailable: 'Certains articles ne sont plus disponibles et n\u2019ont pas \u00e9t\u00e9 ajout\u00e9s.',
    reorderEmpty: 'Aucun article de cette commande n\u2019est disponible actuellement. Consultez le menu pour choisir une alternative.', pricesUpdated: 'Les prix ont \u00e9t\u00e9 actualis\u00e9s selon le menu du jour.', reviewPrompt: 'Comment \u00e9tait votre derniere livraison ?', reviewBody: 'Une \u00e9valuation rapide aide les restaurants locaux \u00e0 progresser.',
  },
  ar: {
    confirmCancel: '\u0647\u0644 \u062a\u0631\u064a\u062f \u0625\u0644\u063a\u0627\u0621 \u0647\u0630\u0627 \u0627\u0644\u0637\u0644\u0628\u061f', cancelled: '\u062a\u0645 \u0625\u0644\u063a\u0627\u0621 \u0627\u0644\u0637\u0644\u0628. \u0644\u0627 \u064a\u0644\u0632\u0645 \u0627\u0633\u062a\u0631\u062f\u0627\u062f \u0644\u0623\u0646 \u0627\u0644\u062f\u0641\u0639 \u0639\u0646\u062f \u0627\u0644\u062a\u0648\u0635\u064a\u0644.',
    supportCreated: '\u0644\u0645 \u064a\u0639\u062f \u0627\u0644\u0625\u0644\u063a\u0627\u0621 \u0627\u0644\u062a\u0644\u0642\u0627\u0626\u064a \u0645\u062a\u0627\u062d\u0627. \u062a\u0645 \u0625\u0646\u0634\u0627\u0621 \u0637\u0644\u0628 \u062f\u0639\u0645 \u0639\u0627\u062c\u0644.', cancelling: '\u062c\u0627\u0631\u064a \u0627\u0644\u0625\u0644\u063a\u0627\u0621...', cancel: '\u0625\u0644\u063a\u0627\u0621 \u0627\u0644\u0637\u0644\u0628',
    cod: '\u0627\u0644\u062f\u0641\u0639 \u0639\u0646\u062f \u0627\u0644\u062a\u0648\u0635\u064a\u0644: \u0644\u0645 \u064a\u062a\u0645 \u062a\u062d\u0635\u064a\u0644 \u0623\u064a \u0645\u0628\u0644\u063a \u0628\u0639\u062f.', help: '\u0627\u0644\u062d\u0635\u0648\u0644 \u0639\u0644\u0649 \u0645\u0633\u0627\u0639\u062f\u0629 \u0641\u064a \u0647\u0630\u0627 \u0627\u0644\u0637\u0644\u0628', again: '\u0625\u0639\u0627\u062f\u0629 \u0627\u0644\u0637\u0644\u0628', preparing: '\u062c\u0627\u0631\u064a \u062a\u062d\u0636\u064a\u0631 \u0627\u0644\u0633\u0644\u0629...',
    reorderReady: '\u062a\u0645\u062a \u0625\u0636\u0627\u0641\u0629 \u0627\u0644\u0639\u0646\u0627\u0635\u0631 \u0627\u0644\u0645\u062a\u0627\u062d\u0629 \u0628\u0627\u0644\u0623\u0633\u0639\u0627\u0631 \u0627\u0644\u062d\u0627\u0644\u064a\u0629.', reorderUnavailable: '\u0628\u0639\u0636 \u0627\u0644\u0639\u0646\u0627\u0635\u0631 \u0644\u0645 \u062a\u0639\u062f \u0645\u062a\u0627\u062d\u0629 \u0648\u0644\u0645 \u062a\u062a\u0645 \u0625\u0636\u0627\u0641\u062a\u0647\u0627.',
    reorderEmpty: '\u0644\u0627 \u062a\u062a\u0648\u0641\u0631 \u0623\u064a \u0645\u0646 \u0627\u0644\u0639\u0646\u0627\u0635\u0631 \u0627\u0644\u0623\u0635\u0644\u064a\u0629 \u062d\u0627\u0644\u064a\u0627. \u062a\u0635\u0641\u062d \u0627\u0644\u0642\u0627\u0626\u0645\u0629 \u0644\u0627\u062e\u062a\u064a\u0627\u0631 \u0628\u062f\u0627\u0626\u0644.', pricesUpdated: '\u062a\u0645 \u062a\u062d\u062f\u064a\u062b \u0627\u0644\u0623\u0633\u0639\u0627\u0631 \u062d\u0633\u0628 \u0642\u0627\u0626\u0645\u0629 \u0627\u0644\u064a\u0648\u0645.', reviewPrompt: '\u0643\u064a\u0641 \u0643\u0627\u0646\u062a \u0639\u0645\u0644\u064a\u0629 \u0627\u0644\u062a\u0648\u0635\u064a\u0644 \u0627\u0644\u0623\u062e\u064a\u0631\u0629\u061f', reviewBody: '\u062a\u0642\u064a\u064a\u0645\u0643 \u0627\u0644\u0633\u0631\u064a\u0639 \u064a\u0633\u0627\u0639\u062f \u0627\u0644\u0645\u0637\u0627\u0639\u0645 \u0627\u0644\u0645\u062d\u0644\u064a\u0629 \u0639\u0644\u0649 \u0627\u0644\u062a\u062d\u0633\u0646.',
  },
} as const;

export default function OrdersPage() {
  const { t, locale } = useT();
  const tx = copy[locale];
  const navigate = useNavigate();
  const { replaceCart } = useCart();
  const [orders, setOrders] = useState<OrderWithRestaurant[]>([]);
  const [itemsByOrder, setItemsByOrder] = useState<Record<string, OrderItemRow[]>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reviewingOrder, setReviewingOrder] = useState<{ id: string; restaurantId: string; restaurantName: string } | null>(null);
  const [reviewedOrders, setReviewedOrders] = useState<Set<string>>(new Set());
  const [cancellingOrderId, setCancellingOrderId] = useState<string | null>(null);
  const [reorderingOrderId, setReorderingOrderId] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ kind: 'success' | 'error'; text: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: ordersError } = await supabase
        .from('orders')
        .select('*, restaurants(id, name, latitude, longitude, estimated_delivery_min)')
        .order('created_at', { ascending: false })
        .limit(50);
      if (ordersError) throw ordersError;
      const list = (data as OrderWithRestaurant[]) ?? [];
      setOrders(list);
      if (list.length === 0) { setItemsByOrder({}); return; }

      const results = await Promise.all(list.map((order) => supabase.from('order_items').select('*').eq('order_id', order.id)));
      const itemMap: Record<string, OrderItemRow[]> = {};
      list.forEach((order, index) => { itemMap[order.id] = (results[index].data as OrderItemRow[]) ?? []; });
      setItemsByOrder(itemMap);

      const delivered = list.filter((order) => order.status === 'delivered');
      const reviewChecks = await Promise.all(delivered.map((order) => supabase.from('reviews').select('id').eq('order_id', order.id).maybeSingle()));
      const reviewed = new Set<string>();
      delivered.forEach((order, index) => { if (reviewChecks[index].data) reviewed.add(order.id); });
      setReviewedOrders(reviewed);
    } catch {
      setError(t('error.genericBody'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => { void load(); }, [load]);

  const { status: realtimeStatus } = useRealtime('orders', (payload) => {
    if (!payload.new?.id) return;
    setOrders((current) => current.map((order) => order.id === payload.new.id
      ? { ...order, ...(payload.new as OrderRow) } as OrderWithRestaurant
      : order));
  }, { enabled: !loading });

  const activeOrder = orders.find((order) => ['pending', 'accepted', 'preparing', 'out_for_delivery'].includes(order.status));
  const reviewCandidate = useMemo(() => orders.find((order) => order.status === 'delivered' && order.restaurants && !reviewedOrders.has(order.id)), [orders, reviewedOrders]);

  const handleCancelOrder = async (order: OrderWithRestaurant) => {
    if (!window.confirm(`${tx.confirmCancel}\n\n${tx.cod}`)) return;
    setCancellingOrderId(order.id);
    setNotice(null);
    const result = await requestCustomerCancellation(order, locale);
    setCancellingOrderId(null);
    if (result.status === 'failed') setNotice({ kind: 'error', text: result.message });
    else setNotice({ kind: 'success', text: result.status === 'cancelled' ? tx.cancelled : tx.supportCreated });
    void load();
  };

  const handleReorder = async (order: OrderWithRestaurant) => {
    const historical = itemsByOrder[order.id] ?? [];
    const ids = [...new Set(historical.map((item) => item.menu_item_id).filter((id): id is string => Boolean(id)))];
    if (!order.restaurants || ids.length === 0) {
      setNotice({ kind: 'error', text: tx.reorderEmpty });
      return;
    }
    setReorderingOrderId(order.id);
    setNotice(null);
    try {
      const { data, error: menuError } = await supabase.from('menu_items').select('*').eq('restaurant_id', order.restaurant_id).in('id', ids);
      if (menuError) throw menuError;
      const current = new Map(((data as MenuItem[]) ?? []).map((item) => [item.id, item]));
      const lines = new Map<string, CartLine>();
      let unavailable = 0;
      let priceChanged = false;
      for (const oldItem of historical) {
        const menuItem = oldItem.menu_item_id ? current.get(oldItem.menu_item_id) : undefined;
        if (!menuItem?.is_available) { unavailable += 1; continue; }
        priceChanged ||= Number(menuItem.price) !== Number(oldItem.unit_price);
        const existing = lines.get(menuItem.id);
        if (existing) existing.quantity += oldItem.quantity;
        else lines.set(menuItem.id, { item: menuItem, quantity: oldItem.quantity, notes: oldItem.notes ?? undefined, unitPriceSnapshot: Number(menuItem.price) });
      }
      if (lines.size === 0) {
        setNotice({ kind: 'error', text: tx.reorderEmpty });
        return;
      }
      replaceCart(order.restaurant_id, order.restaurants.name, [...lines.values()]);
      const message = `${tx.reorderReady}${unavailable > 0 ? ` ${tx.reorderUnavailable}` : ''}${priceChanged ? ' ' + tx.pricesUpdated : ''}`;
      sessionStorage.setItem('kiyo-cart-notice', message);
      navigate('/cart');
    } catch {
      setNotice({ kind: 'error', text: t('error.genericBody') });
    } finally {
      setReorderingOrderId(null);
    }
  };

  return (
    <AppShell>
      <h1 className="mb-5 font-display text-2xl font-extrabold tracking-tight text-ink-900">{t('orders.title')}</h1>
      <ErrorBoundary variant="inline">
        {loading ? (
          <div className="space-y-3">{Array.from({ length: 3 }).map((_, index) => <div key={index} className="kiyo-card p-4"><Skeleton count={2} /></div>)}</div>
        ) : error ? (
          <ErrorState title={t('error.genericTitle')} message={error} onRetry={load} retryLabel={t('error.retry')} />
        ) : orders.length === 0 ? (
          <div className="kiyo-card flex flex-col items-center gap-3 px-6 py-14 text-center"><ShoppingBag className="h-8 w-8 text-ink-300" /><p className="text-sm text-ink-500">{t('orders.empty')}</p><Link to="/restaurants" className="kiyo-btn-primary">{t('market.browse')}</Link></div>
        ) : (
          <div className="space-y-6">
            {activeOrder && <LiveOrderTracker order={activeOrder} onRefresh={load} realtimeStatus={realtimeStatus} />}
            {reviewCandidate && (
              <button type="button" onClick={() => setReviewingOrder({ id: reviewCandidate.id, restaurantId: reviewCandidate.restaurants!.id, restaurantName: reviewCandidate.restaurants!.name })} className="kiyo-card flex w-full items-center gap-3 border border-amber-200 p-4 text-left hover:bg-amber-50">
                <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-amber-100 text-amber-600"><Star className="h-5 w-5" /></span>
                <span><span className="block text-sm font-bold text-ink-900">{tx.reviewPrompt}</span><span className="block text-xs text-ink-500">{tx.reviewBody}</span></span>
              </button>
            )}
            {notice && <div className={`rounded-lg border px-4 py-3 text-sm ${notice.kind === 'success' ? 'border-sage-200 bg-sage-50 text-sage-700' : 'border-error-200 bg-error-50 text-error-700'}`}>{notice.text}</div>}

            <div className="space-y-3">
              {orders.map((order) => {
                const items = itemsByOrder[order.id] ?? [];
                const canReview = order.status === 'delivered' && order.restaurants;
                const past = ['delivered', 'cancelled', 'failed_delivery', 'refunded'].includes(order.status);
                return (
                  <article key={order.id} className="kiyo-card p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div><div className="flex items-center gap-2"><span className="font-display text-sm font-bold text-ink-900">#{order.id.slice(0, 8)}</span><StatusBadge status={order.status} /></div><p className="mt-1 text-xs text-ink-400">{relativeTime(order.created_at)}</p></div>
                      <PriceTag value={order.total} />
                    </div>
                    {items.length > 0 && <ul className="mt-3 divide-y divide-ink-50 border-t border-ink-50 text-sm text-ink-600">{items.map((item) => <li key={item.id} className="flex justify-between py-1.5"><span><span className="font-semibold">{item.quantity}x</span> {item.name}</span></li>)}</ul>}
                    <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-ink-50 pt-3">
                      {past && (
                        <button type="button" onClick={() => void handleReorder(order)} disabled={reorderingOrderId === order.id} className="inline-flex min-h-11 items-center gap-1.5 rounded-lg px-3 text-sm font-bold text-ink-700 hover:bg-ink-50 disabled:opacity-50">
                          {reorderingOrderId === order.id ? <Spinner className="h-4 w-4" /> : <RotateCcw className="h-4 w-4" />} {reorderingOrderId === order.id ? tx.preparing : tx.again}
                        </button>
                      )}
                      <Link to={`/support?order=${order.id}`} className="inline-flex min-h-11 items-center gap-1.5 rounded-lg px-3 text-sm font-bold text-ink-700 hover:bg-ink-50"><LifeBuoy className="h-4 w-4 text-ember-600" /> {tx.help}</Link>
                      {canReview && (
                        <button type="button" onClick={() => setReviewingOrder({ id: order.id, restaurantId: order.restaurants!.id, restaurantName: order.restaurants!.name })} disabled={reviewedOrders.has(order.id)} className="inline-flex min-h-11 items-center gap-1.5 rounded-lg px-3 text-sm font-bold text-amber-600 hover:bg-amber-50 disabled:text-ink-400">
                          <Star className={`h-4 w-4 ${reviewedOrders.has(order.id) ? 'fill-amber-400' : ''}`} /> {reviewedOrders.has(order.id) ? t('orders.reviewed') : t('orders.leaveReview')}
                        </button>
                      )}
                      {order.status === 'pending' && order.id !== activeOrder?.id && (
                        <button type="button" onClick={() => void handleCancelOrder(order)} disabled={cancellingOrderId === order.id} className="ml-auto inline-flex min-h-11 items-center gap-1 rounded-lg border border-error-100 px-3 text-xs font-bold text-error-600 hover:bg-error-50 disabled:opacity-60"><Trash className="h-3.5 w-3.5" />{cancellingOrderId === order.id ? tx.cancelling : tx.cancel}</button>
                      )}
                    </div>
                    {order.status === 'pending' && <p className="mt-2 text-xs text-ink-400">{tx.cod}</p>}
                  </article>
                );
              })}
            </div>
          </div>
        )}
      </ErrorBoundary>

      {reviewingOrder && <ReviewModal orderId={reviewingOrder.id} restaurantId={reviewingOrder.restaurantId} restaurantName={reviewingOrder.restaurantName} onClose={() => setReviewingOrder(null)} onSubmit={() => { setReviewedOrders((current) => new Set(current).add(reviewingOrder.id)); setReviewingOrder(null); }} />}
    </AppShell>
  );
}
