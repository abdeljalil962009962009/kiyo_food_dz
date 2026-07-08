import { useCallback, useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Store, Utensils, Clock, RefreshCw, Bell, DollarSign, TrendingUp, X, Settings } from 'lucide-react';
import { useT } from '../lib/i18n-react';
import { supabase, type Restaurant, type OrderRow, type OrderItemRow, type OrderStatus } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { useRealtime } from '../lib/useRealtime';
import { canTransition, nextStatuses } from '../lib/orderStateMachine';
import { AppShell } from '../components/AppShell';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { Skeleton, ErrorState, Spinner } from '../components/feedback';
import { StatusBadge, PriceTag, relativeTime } from '../components/ui';
import { RestaurantAnalyticsPanel } from '../components/RestaurantAnalytics';

export default function RestaurantDashboardPage() {
  const { t } = useT();
  const { profile } = useAuth();
  const navigate = useNavigate();

  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [itemsMap, setItemsMap] = useState<Record<string, OrderItemRow[]>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [financialsError, setFinancialsError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [newOrderAlert, setNewOrderAlert] = useState<OrderRow | null>(null);
  const [financials, setFinancials] = useState<{
    revenue_today: number; revenue_month: number; revenue_all: number;
    commission_owed: number; payout_pending: number; orders_count: number;
  } | null>(null);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const audioCtxRef = useRef<AudioContext | null>(null);

  const load = useCallback(async () => {
    if (!profile) return;
    setLoading(true);
    setError(null);
    try {
      const { data: r, error: re } = await supabase
        .from('restaurants')
        .select('*')
        .eq('owner_id', profile.id)
        .maybeSingle();
      if (re) throw re;
      
      if (!r) {
        setError('No restaurant assigned to your account. Please contact the platform administrator to onboard your restaurant.');
        return;
      }

      const activeRestaurant = r as Restaurant;
      setRestaurant(activeRestaurant);

      const { data: o, error: oe } = await supabase
        .from('orders')
        .select('*')
        .eq('restaurant_id', activeRestaurant.id)
        .order('created_at', { ascending: false })
        .limit(100);
      if (oe) throw oe;
      const list = (o as OrderRow[]) ?? [];
      
      setOrders(list);
      if (list.length === 0) {
        setItemsMap({});
        setFinancials({
          revenue_today: 0,
          revenue_month: 0,
          revenue_all: 0,
          commission_owed: 0,
          payout_pending: 0,
          orders_count: 0
        });
      } else {
        const itemsResults = await Promise.all(
          list.map((order) =>
            supabase.from('order_items').select('*').eq('order_id', order.id),
          ),
        );
        const map: Record<string, OrderItemRow[]> = {};
        list.forEach((order, i) => {
          if (itemsResults[i].error) throw itemsResults[i].error;
          map[order.id] = (itemsResults[i].data as OrderItemRow[]) ?? [];
        });
        setItemsMap(map);
      }
    } catch (err: unknown) {
      console.error(err);
      setError(err instanceof Error ? err.message : t('error.genericBody'));
    } finally {
      setLoading(false);
    }
  }, [profile, t]);

  useEffect(() => { void load(); }, [load]);

  // Load financials for this restaurant
  useEffect(() => {
    if (!restaurant) return;
    void (async () => {
      try {
        setFinancialsError(null);
        const { data, error: e } = await supabase.rpc('get_restaurant_financials', {
          p_restaurant_id: restaurant.id,
        });
        if (e) throw e;
        const f = data as {
          revenue: { today: number; this_month: number; all_time: number };
          commission_owed: string; payout_pending: string; orders_count: number;
        };
        setFinancials({
          revenue_today: Number(f.revenue.today),
          revenue_month: Number(f.revenue.this_month),
          revenue_all: Number(f.revenue.all_time),
          commission_owed: Number(f.commission_owed),
          payout_pending: Number(f.payout_pending),
          orders_count: f.orders_count,
        });
      } catch (err) {
        console.error('[Kiyo] Restaurant financials load failed:', err);
        setFinancialsError(err instanceof Error ? err.message : t('error.genericBody'));
      }
    })();
  }, [restaurant, t]);

  // Play a notification sound when a new order arrives
  const playSound = useCallback(() => {
    if (!soundEnabled) return;
    try {
      if (!audioCtxRef.current) {
        audioCtxRef.current = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      }
      const ctx = audioCtxRef.current;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = 880;
      osc.type = 'sine';
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.5);
    } catch (err) {
      console.debug('[Kiyo] Order notification sound unavailable:', err);
    }
  }, [soundEnabled]);

  // Real-time: surface the channel status so the UI shows disconnected.
  // Channel filter=restaurant_id=eq.<uuid> prevents receiving other tenants.
  const { status: realtimeStatus } = useRealtime(
    'orders',
    (payload) => {
      if (!restaurant || payload.new?.restaurant_id !== restaurant.id) return;
      setOrders((prev) => {
        const idx = prev.findIndex((o) => o.id === payload.new.id);
        if (idx >= 0) {
          const next = [...prev];
          next[idx] = { ...prev[idx], ...payload.new } as OrderRow;
          return next;
        }
        // New order â†’ fetch its items then prepend.
        void supabase
          .from('order_items')
          .select('*')
          .eq('order_id', payload.new.id as string)
          .then(({ data, error: e }) => {
            if (e) {
              console.error('[Kiyo] Realtime order items load failed:', e);
              setActionError(e.message ?? t('error.genericBody'));
              return;
            }
            setItemsMap((m) => ({ ...m, [payload.new.id as string]: (data as OrderItemRow[]) ?? [] }));
          });
        return [payload.new as OrderRow, ...prev];
      });
    },
    { enabled: !!restaurant && !loading, filter: restaurant ? { restaurant_id: `eq.${restaurant.id}` } : undefined },
  );

  // Detect new pending orders â†’ show alert popup + play sound
  const prevPendingCount = useRef(0);
  useEffect(() => {
    const pendingCount = orders.filter((o) => o.status === 'pending').length;
    if (pendingCount > prevPendingCount.current) {
      const newest = orders.find((o) => o.status === 'pending');
      if (newest) {
        setNewOrderAlert(newest);
        playSound();
      }
    }
    prevPendingCount.current = pendingCount;
  }, [orders, playSound]);

  const updateStatus = async (orderId: string, to: OrderStatus) => {
    const current = orders.find((o) => o.id === orderId)?.status;
    if (!current || !canTransition(current, to)) return;
    setPendingAction(orderId);
    setActionError(null);
    try {
      const { error: e } = await supabase
        .from('orders')
        .update({ status: to })
        .eq('id', orderId);
      if (e) throw e;
      setOrders((prev) =>
        prev.map((o) => (o.id === orderId ? { ...o, status: to } : o)),
      );
    } catch (err) {
      console.error('[Kiyo] Order status update failed:', err);
      setActionError(err instanceof Error ? err.message : t('error.genericBody'));
    } finally {
      setPendingAction(null);
    }
  };

  if (loading) {
    return (
      <AppShell>
        <div className="space-y-3">
          <Skeleton count={1} />
          <Skeleton count={3} />
        </div>
      </AppShell>
    );
  }
  if (error || !restaurant) {
    return (
      <AppShell>
        <ErrorState
          title={t('error.genericTitle')} message={error ?? 'Error'}
          onRetry={load} retryLabel={t('error.retry')}
        />
      </AppShell>
    );
  }

  const pending = orders.filter((o) => o.status === 'pending');
  const active = orders.filter((o) =>
    ['accepted', 'preparing', 'out_for_delivery'].includes(o.status));
  const past = orders.filter((o) =>
    ['delivered', 'cancelled'].includes(o.status));

  return (
    <AppShell>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-ember-600">
            <span className={`h-1.5 w-1.5 rounded-full ${
              restaurant.operational_status === 'open' ? 'bg-sage-500' :
              restaurant.operational_status === 'busy' ? 'bg-warning-500' : 'bg-ink-300'
            }`} />
            {t(`restaurant.${restaurant.operational_status}`)}
            {(restaurant.status !== 'published' && ' Â· awaiting approval')}
          </p>
          <h1 className="mt-1 font-display text-2xl font-extrabold tracking-tight text-ink-900">
            {restaurant.name}
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <RealtimeIndicator status={realtimeStatus} />
          <button
            onClick={() => navigate('/restaurant/settings')}
            className="kiyo-btn-ghost"
            title="Settings"
          >
            <Settings className="h-4 w-4" />
          </button>
          <button
            onClick={() => navigate('/restaurant/menu')}
            className="kiyo-btn-secondary"
          >
            <Utensils className="h-4 w-4" />
            <span className="hidden sm:inline">{t('restaurant.manageMenu')}</span>
          </button>
        </div>
      </div>

      {/* Financial overview */}
      {actionError && (
        <div className="mb-3 rounded-lg border border-error-100 bg-error-50 px-4 py-3 text-sm text-error-700">
          {actionError}
        </div>
      )}
      {financialsError && (
        <div className="mb-3 rounded-lg border border-ember-200 bg-ember-50 px-4 py-3 text-sm text-ember-700">
          Financial data could not be refreshed: {financialsError}
        </div>
      )}
      {financials && (
        <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="kiyo-card p-4">
            <div className="flex items-center gap-2 text-xs font-medium text-ink-400">
              <DollarSign className="h-3.5 w-3.5" /> Today
            </div>
            <div className="mt-1 font-display text-xl font-extrabold text-ink-900">
              {financials.revenue_today.toLocaleString('fr-DZ')} DZD
            </div>
          </div>
          <div className="kiyo-card p-4">
            <div className="flex items-center gap-2 text-xs font-medium text-ink-400">
              <TrendingUp className="h-3.5 w-3.5" /> This Month
            </div>
            <div className="mt-1 font-display text-xl font-extrabold text-ink-900">
              {financials.revenue_month.toLocaleString('fr-DZ')} DZD
            </div>
          </div>
          <div className="kiyo-card p-4">
            <div className="flex items-center gap-2 text-xs font-medium text-ink-400">
              <Clock className="h-3.5 w-3.5" /> Commission Owed
            </div>
            <div className="mt-1 font-display text-xl font-extrabold text-ember-600">
              {financials.commission_owed.toLocaleString('fr-DZ')} DZD
            </div>
          </div>
          <div className="kiyo-card p-4">
            <div className="flex items-center gap-2 text-xs font-medium text-ink-400">
              <DollarSign className="h-3.5 w-3.5" /> Net Payout
            </div>
            <div className="mt-1 font-display text-xl font-extrabold text-sage-600">
              {financials.payout_pending.toLocaleString('fr-DZ')} DZD
            </div>
          </div>
        </div>
      )}

      {/* Sound toggle */}
      <div className="mb-3 flex items-center justify-between">
        <button
          onClick={() => setSoundEnabled((v) => !v)}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-ink-500 hover:text-ink-900"
        >
          <Bell className="h-3.5 w-3.5" />
          {soundEnabled ? 'Sound on' : 'Sound off'}
        </button>
      </div>

      {/* Analytics Panel */}
      {restaurant && <RestaurantAnalyticsPanel restaurantId={restaurant.id} />}

      <ErrorBoundary variant="inline">
        {pending.length > 0 && (
          <Section title={t('restaurant.waitingOrders')} icon={Bell} badge={pending.length}>
            <OrdersList
              orders={pending} itemsMap={itemsMap}
              onAction={updateStatus} pendingAction={pendingAction}
            />
          </Section>
        )}

        <Section title="Active orders" icon={Clock}>
          {active.length === 0 ? (
            <Empty text={t('restaurant.noOrders')} />
          ) : (
            <OrdersList
              orders={active} itemsMap={itemsMap}
              onAction={updateStatus} pendingAction={pendingAction}
            />
          )}
        </Section>

        {past.length > 0 && (
          <Section title="Completed" icon={Store}>
            <OrdersList
              orders={past} itemsMap={itemsMap}
              onAction={updateStatus} pendingAction={pendingAction}
            />
          </Section>
        )}
      </ErrorBoundary>

      {/* New order alert popup */}
      {newOrderAlert && (
        <div className="fixed bottom-4 right-4 z-50 flex max-w-sm items-start gap-3 rounded-xl border border-ember-500/30 bg-white p-4 shadow-card-lg animate-slide-up">
          <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-ember-500 text-white">
            <Bell className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-display text-sm font-bold text-ink-900">New order received!</p>
            <p className="text-xs text-ink-500">
              #{newOrderAlert.id.slice(0, 8)} Â· {newOrderAlert.total} DZD
            </p>
            <p className="mt-0.5 text-xs text-ink-400">
              {newOrderAlert.delivery_address}
            </p>
          </div>
          <button
            onClick={() => setNewOrderAlert(null)}
            className="flex-shrink-0 text-ink-400 hover:text-ink-900"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}
    </AppShell>
  );
}

function Section({ title, icon: Icon, badge, children }: {
  title: string; icon: React.ElementType; badge?: number; children: React.ReactNode;
}) {
  return (
    <section className="mb-6">
      <div className="mb-2 flex items-center gap-2">
        <Icon className="h-4 w-4 text-ink-500" />
        <h2 className="font-display text-base font-bold text-ink-900">{title}</h2>
        {badge !== undefined && badge > 0 && (
          <span className="rounded-full bg-ember-500 px-2 py-0.5 text-[10px] font-bold text-white">
            {badge}
          </span>
        )}
      </div>
      {children}
    </section>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <div className="kiyo-card p-8 text-center text-sm text-ink-400">{text}</div>
  );
}

function OrdersList({ orders, itemsMap, onAction, pendingAction }: {
  orders: OrderRow[];
  itemsMap: Record<string, OrderItemRow[]>;
  onAction: (id: string, to: OrderStatus) => void;
  pendingAction: string | null;
}) {
  const { t } = useT();
  return (
    <div className="space-y-3">
      {orders.map((o) => {
        const items = itemsMap[o.id] ?? [];
        const next = nextStatuses(o.status);
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
                {o.delivery_phone && (
                  <p className="mt-1 text-xs text-ink-500">{o.delivery_phone}</p>
                )}
                {o.delivery_address && (
                  <p className="text-xs text-ink-500">{o.delivery_address}</p>
                )}
                <p className="mt-1 text-[11px] text-ink-400">{relativeTime(o.created_at)}</p>
              </div>
              <div className="text-right">
                <PriceTag value={o.total} />
              </div>
            </div>

            {items.length > 0 && (
              <ul className="mt-3 divide-y divide-ink-50 border-t border-ink-50 text-sm text-ink-600">
                {items.map((it) => (
                  <li key={it.id} className="flex justify-between py-1.5">
                    <span>
                      <span className="font-semibold">{it.quantity}Ã—</span> {it.name}
                    </span>
                    {it.notes && (
                      <span className="text-xs italic text-ink-400">â€œ{it.notes}â€</span>
                    )}
                  </li>
                ))}
              </ul>
            )}

            {o.notes && (
              <p className="mt-2 rounded bg-ink-50 px-2 py-1 text-xs text-ink-500">â€œ{o.notes}â€</p>
            )}

            {next.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {next.map((s) => {
                  const isCancel = s === 'cancelled';
                  return (
                    <button
                      key={s}
                      onClick={() => onAction(o.id, s)}
                      disabled={pendingAction === o.id}
                      className={isCancel
                        ? 'kiyo-btn-secondary border-error-500/30 text-error-600 hover:bg-error-500/10'
                        : 'kiyo-btn-primary'}
                    >
                      {pendingAction === o.id && <Spinner className="h-3.5 w-3.5" />}
                      {t(`status.${s === 'cancelled' ? 'cancelOrder' : s}`)}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function RealtimeIndicator({ status }: { status: string }) {
  if (status === 'connected') {
    return (
      <span className="flex items-center gap-1.5 rounded-lg bg-sage-100 px-2.5 py-2 text-[11px] font-semibold text-sage-600">
        <span className="h-1.5 w-1.5 rounded-full bg-sage-500" />
        Live
      </span>
    );
  }
  if (status === 'error' || status === 'closed') {
    return (
      <span className="flex items-center gap-1.5 rounded-lg bg-error-500/10 px-2.5 py-2 text-[11px] font-semibold text-error-600">
        <RefreshCw className="h-3 w-3" />
        Reconnectingâ€¦
      </span>
    );
  }
  return (
    <span className="flex items-center gap-1.5 rounded-lg bg-ink-100 px-2.5 py-2 text-[11px] font-semibold text-ink-500">
      <Spinner className="h-3 w-3" />
      Connectingâ€¦
    </span>
  );
}
