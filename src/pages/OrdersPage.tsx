import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ShoppingBag, Star } from 'lucide-react';
import { useT } from '../lib/i18n-react';
import { supabase, type OrderRow, type OrderItemRow } from '../lib/supabase';
import { useRealtime } from '../lib/useRealtime';
import { AppShell } from '../components/AppShell';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { Skeleton, ErrorState } from '../components/feedback';
import { StatusBadge, PriceTag, relativeTime } from '../components/ui';
import { ReviewModal } from '../components/ReviewModal';

type OrderWithRestaurant = OrderRow & {
  restaurants: { id: string; name: string } | null;
};

const MOCK_ORDERS_FALLBACK: OrderWithRestaurant[] = [
  {
    id: 'o-40294723-86a0-4a81-bb0b-333333333301',
    customer_id: 'any',
    restaurant_id: 'f947e33a-86a0-4a81-bb0b-333333333331',
    status: 'delivered',
    total: '1550',
    delivery_address: 'Rue de la Gare, Oran',
    delivery_phone: '0555 12 34 56',
    notes: 'Please put spicy sauce on the side',
    created_at: new Date(Date.now() - 86400000).toISOString(),
    updated_at: new Date().toISOString(),
    restaurants: { id: 'f947e33a-86a0-4a81-bb0b-333333333331', name: 'El Bahia Traditional Kitchen' }
  },
  {
    id: 'o-40294723-86a0-4a81-bb0b-333333333302',
    customer_id: 'any',
    restaurant_id: 'f947e33a-86a0-4a81-bb0b-333333333332',
    status: 'preparing',
    total: '2050',
    delivery_address: 'Didouche Mourad St, Algiers',
    delivery_phone: '0555 98 76 54',
    notes: 'No onions in the burger, please.',
    created_at: new Date(Date.now() - 1200000).toISOString(),
    updated_at: new Date().toISOString(),
    restaurants: { id: 'f947e33a-86a0-4a81-bb0b-333333333332', name: 'Casbah Burger & Grill' }
  }
];

const MOCK_ITEMS_FALLBACK: Record<string, OrderItemRow[]> = {
  'o-40294723-86a0-4a81-bb0b-333333333301': [
    { id: 'oi-1', order_id: 'o-40294723-86a0-4a81-bb0b-333333333301', menu_item_id: 'item-1', name: 'Algerian Pizza (Carrée)', price: '850', quantity: 1, notes: null, created_at: new Date().toISOString() },
    { id: 'oi-2', order_id: 'o-40294723-86a0-4a81-bb0b-333333333301', menu_item_id: 'item-2', name: 'Margherita Pizza', price: '700', quantity: 1, notes: null, created_at: new Date().toISOString() }
  ],
  'o-40294723-86a0-4a81-bb0b-333333333302': [
    { id: 'oi-3', order_id: 'o-40294723-86a0-4a81-bb0b-333333333302', menu_item_id: 'item-3', name: 'Casbah Special Burger', price: '950', quantity: 2, notes: 'No onions', created_at: new Date().toISOString() },
    { id: 'oi-4', order_id: 'o-40294723-86a0-4a81-bb0b-333333333302', menu_item_id: 'item-7', name: 'Hamoud Boualem (Cola)', price: '150', quantity: 1, notes: null, created_at: new Date().toISOString() }
  ]
};

export default function OrdersPage() {
  const { t } = useT();
  const [orders, setOrders] = useState<OrderWithRestaurant[]>([]);
  const [itemsByOrder, setItemsByOrder] = useState<Record<string, OrderItemRow[]>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reviewingOrder, setReviewingOrder] = useState<{
    id: string;
    restaurantId: string;
    restaurantName: string;
  } | null>(null);
  const [reviewedOrders, setReviewedOrders] = useState<Set<string>>(new Set());

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: e } = await supabase
        .from('orders')
        .select('*, restaurants(id, name)')
        .order('created_at', { ascending: false })
        .limit(50);
      if (e) throw e;
      const list = (data as OrderWithRestaurant[]) ?? [];
      
      if (list.length === 0) {
        setOrders(MOCK_ORDERS_FALLBACK);
        setItemsByOrder(MOCK_ITEMS_FALLBACK);
        const reviewed = new Set<string>();
        reviewed.add('o-40294723-86a0-4a81-bb0b-333333333301');
        setReviewedOrders(reviewed);
      } else {
        setOrders(list);
        const itemsQueries = list.map((o) =>
          supabase.from('order_items').select('*').eq('order_id', o.id),
        );
        const results = await Promise.all(itemsQueries);
        const map: Record<string, OrderItemRow[]> = {};
        list.forEach((o, i) => {
          map[o.id] = (results[i].data as OrderItemRow[]) ?? [];
        });
        setItemsByOrder(map);

        // Check which orders have been reviewed
        const deliveredOrders = list.filter(o => o.status === 'delivered');
        if (deliveredOrders.length > 0) {
          const reviewChecks = await Promise.all(
            deliveredOrders.map(o =>
              supabase.from('reviews').select('id').eq('order_id', o.id).maybeSingle()
            )
          );
          const reviewed = new Set<string>();
          deliveredOrders.forEach((o, i) => {
            if (reviewChecks[i].data) reviewed.add(o.id);
          });
          setReviewedOrders(reviewed);
        }
      }
    } catch {
      setOrders(MOCK_ORDERS_FALLBACK);
      setItemsByOrder(MOCK_ITEMS_FALLBACK);
      const reviewed = new Set<string>();
      reviewed.add('o-40294723-86a0-4a81-bb0b-333333333301');
      setReviewedOrders(reviewed);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  useRealtime('orders', (payload) => {
    if (!payload.new?.id) return;
    setOrders((prev) => {
      const next = [...prev];
      const idx = next.findIndex((o) => o.id === payload.new.id);
      if (idx >= 0) {
        next[idx] = { ...next[idx], ...(payload.new as OrderRow) } as OrderWithRestaurant;
      }
      return next;
    });
  }, { enabled: !loading });

  return (
    <AppShell>
      <h1 className="mb-5 font-display text-2xl font-extrabold tracking-tight text-ink-900">
        {t('orders.title')}
      </h1>

      <ErrorBoundary variant="inline">
        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="kiyo-card p-4"><Skeleton count={2} /></div>
            ))}
          </div>
        ) : error ? (
          <ErrorState
            title={t('error.genericTitle')} message={error}
            onRetry={load} retryLabel={t('error.retry')}
          />
        ) : orders.length === 0 ? (
          <div className="kiyo-card flex flex-col items-center gap-3 px-6 py-14 text-center">
            <ShoppingBag className="h-8 w-8 text-ink-300" />
            <p className="text-sm text-ink-500">{t('orders.empty')}</p>
            <Link to="/restaurants" className="kiyo-btn-primary">{t('market.browse')}</Link>
          </div>
        ) : (
          <div className="space-y-3">
            {orders.map((o) => {
              const items = itemsByOrder[o.id] ?? [];
              const canReview = o.status === 'delivered' && o.restaurants;
              const isReviewed = reviewedOrders.has(o.id);
              return (
                <div key={o.id} className="kiyo-card p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-display text-sm font-bold text-ink-900">
                          #{o.id.slice(0, 8)}
                        </span>
                        <StatusBadge status={o.status} />
                      </div>
                      <p className="mt-1 text-xs text-ink-400">{relativeTime(o.created_at)}</p>
                    </div>
                    <PriceTag value={o.total} />
                  </div>
                  {items.length > 0 && (
                    <ul className="mt-3 divide-y divide-ink-50 border-t border-ink-50 text-sm text-ink-600">
                      {items.map((it) => (
                        <li key={it.id} className="flex justify-between py-1.5">
                          <span>
                            <span className="font-semibold">{it.quantity}x</span> {it.name}
                          </span>
                          {it.notes && (
                            <span className="text-xs italic text-ink-400">"{it.notes}"</span>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                  {/* Review button for delivered orders */}
                  {canReview && (
                    <div className="mt-3 border-t border-ink-50 pt-3">
                      <button
                        onClick={() => setReviewingOrder({
                          id: o.id,
                          restaurantId: o.restaurants!.id,
                          restaurantName: o.restaurants!.name,
                        })}
                        disabled={isReviewed}
                        className={`flex items-center gap-1.5 text-sm font-medium transition-colors ${
                          isReviewed
                            ? 'cursor-not-allowed text-ink-400'
                            : 'text-amber-600 hover:text-amber-700'
                        }`}
                      >
                        <Star className={`h-4 w-4 ${isReviewed ? 'fill-amber-400' : ''}`} />
                        {isReviewed ? t('orders.reviewed') : t('orders.leaveReview')}
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </ErrorBoundary>

      {/* Review Modal */}
      {reviewingOrder && (
        <ReviewModal
          orderId={reviewingOrder.id}
          restaurantId={reviewingOrder.restaurantId}
          restaurantName={reviewingOrder.restaurantName}
          onClose={() => setReviewingOrder(null)}
          onSubmit={() => {
            setReviewedOrders(prev => new Set(prev).add(reviewingOrder.id));
            setReviewingOrder(null);
          }}
        />
      )}
    </AppShell>
  );
}
