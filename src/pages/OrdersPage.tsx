import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ShoppingBag } from 'lucide-react';
import { useT } from '../lib/i18n-react';
import { supabase, type OrderRow, type OrderItemRow } from '../lib/supabase';
import { useRealtime } from '../lib/useRealtime';
import { AppShell } from '../components/AppShell';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { Skeleton, ErrorState } from '../components/feedback';
import { StatusBadge, PriceTag, relativeTime } from '../components/ui';

export default function OrdersPage() {
  const { t } = useT();
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [itemsByOrder, setItemsByOrder] = useState<Record<string, OrderItemRow[]>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: e } = await supabase
        .from('orders')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);
      if (e) throw e;
      const list = (data as OrderRow[]) ?? [];
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
    } catch {
      setError(t('error.genericBody'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); /* eslint-disable-next-line */ }, []);

  // Real-time: refresh the orders list when any of our orders changes.
  // RLS scopes what we receive to our own orders — channel filter on
  // customer_id adds defense-in-depth.
  useRealtime('orders', (payload) => {
    if (!payload.new?.id) return;
    setOrders((prev) => {
      const next = [...prev];
      const idx = next.findIndex((o) => o.id === payload.new.id);
      if (idx >= 0) {
        next[idx] = { ...next[idx], ...payload.new } as OrderRow;
      } else {
        // New order from another tab/device — prepend.
        next.unshift(payload.new as OrderRow);
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
                            <span className="font-semibold">{it.quantity}×</span> {it.name}
                          </span>
                          {it.notes && (
                            <span className="text-xs italic text-ink-400">“{it.notes}”</span>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </ErrorBoundary>
    </AppShell>
  );
}
