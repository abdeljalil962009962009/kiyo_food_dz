import { useCallback, useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Store, Utensils, Clock, RefreshCw, Bell, DollarSign, TrendingUp, X, Settings, Star } from 'lucide-react';
import { useT } from '../lib/i18n-react';
import { supabase, type Restaurant, type OrderRow, type OrderItemRow, type OrderStatus, type ReviewRow } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { useRealtime } from '../lib/useRealtime';
import { canTransition, nextStatuses } from '../lib/orderStateMachine';
import { AppShell } from '../components/AppShell';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { Skeleton, ErrorState, Spinner } from '../components/feedback';
import { StatusBadge, PriceTag, relativeTime } from '../components/ui';
import { RestaurantAnalyticsPanel } from '../components/RestaurantAnalytics';
import { callUserAction } from '../lib/userApi';
import { userFacingError } from '../lib/userFacingError';
import { useActionDialog } from '../context/ActionDialogContext';
import { useSettings } from '../context/SettingsContext';
import { RestaurantReviews } from '../components/RestaurantReviews';
import { applyReviewChange } from '../lib/reviews';
import { withExponentialBackoff } from '../lib/locationNetwork';

export default function RestaurantDashboardPage() {
  const { t, locale } = useT();
  const { profile } = useAuth();
  const { features } = useSettings();
  const navigate = useNavigate();
  const { requestText } = useActionDialog();

  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [itemsMap, setItemsMap] = useState<Record<string, OrderItemRow[]>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [financialsError, setFinancialsError] = useState<string | null>(null);
  const [reviewsLoadError, setReviewsLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [newOrderAlert, setNewOrderAlert] = useState<OrderRow | null>(null);
  const [financials, setFinancials] = useState<{
    revenue_today: number; revenue_month: number; revenue_all: number;
    commission_owed: number; payout_pending: number; orders_count: number;
  } | null>(null);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [reviews, setReviews] = useState<ReviewRow[]>([]);
  const [replyingReviewId, setReplyingReviewId] = useState<string | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);

  const load = useCallback(async (foreground = true) => {
    if (!profile) return;
    if (foreground) {
      setLoading(true);
      setError(null);
    }
    try {
      const managedRestaurantId = await withExponentialBackoff(async () => {
        const { data, error: managedRestaurantError } = await supabase.rpc('get_user_restaurant_id');
        if (managedRestaurantError) throw managedRestaurantError;
        return data as string | null;
      }, { attempts: 3, baseDelayMs: 700, timeoutMs: 15000 });
      const { data: r, error: re } = managedRestaurantId
        ? await withExponentialBackoff(
          async () => supabase.from('restaurants').select('*').eq('id', managedRestaurantId).maybeSingle(),
          { attempts: 3, baseDelayMs: 700, timeoutMs: 15000 },
        )
        : { data: null, error: null };
      if (re) throw re;
      
      if (!r) {
        if (foreground) setError(t('restaurant.notAssigned'));
        return;
      }

      const activeRestaurant = r as Restaurant;
      setRestaurant(activeRestaurant);

      const ordersResult = await withExponentialBackoff(
        async () => supabase
          .from('orders')
          .select('*')
          .eq('restaurant_id', activeRestaurant.id)
          .order('created_at', { ascending: false })
          .limit(100),
        { attempts: 3, baseDelayMs: 700, timeoutMs: 15000 },
      );
      const { data: o, error: oe } = ordersResult;
      if (oe) throw oe;
      const list = (o as OrderRow[]) ?? [];
      
      setOrders(list);
      setError(null);
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
        const itemRows = await withExponentialBackoff(async () => {
          const { data, error: itemsError } = await supabase
            .from('order_items')
            .select('*')
            .in('order_id', list.map((order) => order.id));
          if (itemsError) throw itemsError;
          return (data as OrderItemRow[]) ?? [];
        }, { attempts: 3, baseDelayMs: 700, timeoutMs: 15000 });
        const map: Record<string, OrderItemRow[]> = {};
        list.forEach((order) => { map[order.id] = []; });
        itemRows.forEach((item) => { map[item.order_id]?.push(item); });
        setItemsMap(map);
      }

      if (features.reviews) {
        try {
          const reviewsResult = await withExponentialBackoff(
            async () => supabase
              .from('reviews')
              .select('id,restaurant_id,customer_id,order_id,rating,comment,owner_reply,replied_at,is_hidden,created_at,updated_at')
              .eq('restaurant_id', activeRestaurant.id)
              .eq('is_hidden', false)
              .order('created_at', { ascending: false })
              .limit(50),
            { attempts: 3, baseDelayMs: 700, timeoutMs: 15000 },
          );
          if (reviewsResult.error) throw reviewsResult.error;
          setReviews((reviewsResult.data as ReviewRow[]) ?? []);
          setReviewsLoadError(null);
        } catch (reviewsError: unknown) {
          console.error('[Kiyo] Restaurant reviews load failed:', reviewsError);
          if (foreground) setReviewsLoadError(userFacingError(reviewsError, locale, t('error.genericBody')));
        }
      } else {
        setReviews([]);
        setReviewsLoadError(null);
      }
    } catch (err: unknown) {
      console.error(err);
      if (foreground) setError(userFacingError(err, locale, t('error.genericBody')));
    } finally {
      if (foreground) setLoading(false);
    }
  }, [features.reviews, locale, profile, t]);

  useEffect(() => {
    void load();
    const refresh = () => {
      if (document.visibilityState === 'visible') void load(false);
    };
    const interval = window.setInterval(refresh, 30000);
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, [load]);

  // Load financials for this restaurant
  useEffect(() => {
    if (!restaurant) return;
    void (async () => {
      try {
        setFinancialsError(null);
        const data = await withExponentialBackoff(async () => {
          const result = await callUserAction('get_restaurant_financials', {
            p_restaurant_id: restaurant.id,
          });
          if (result.error) throw result.error;
          return result.data;
        }, { attempts: 3, baseDelayMs: 700, timeoutMs: 15000 });
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
        setFinancialsError(userFacingError(err, locale, t('error.genericBody')));
      }
    })();
  }, [locale, restaurant, t]);

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
        // Fetch the immutable item snapshots before prepending a new order.
        void withExponentialBackoff(
          async () => supabase
            .from('order_items')
            .select('*')
            .eq('order_id', payload.new.id as string),
          { attempts: 3, baseDelayMs: 700, timeoutMs: 15000 },
        )
          .then(({ data, error: e }) => {
            if (e) {
              console.error('[Kiyo] Realtime order items load failed:', e);
              setActionError(userFacingError(e, locale, t('error.genericBody')));
              return;
            }
            setItemsMap((m) => ({ ...m, [payload.new.id as string]: (data as OrderItemRow[]) ?? [] }));
          });
        return [payload.new as OrderRow, ...prev];
      });
    },
    { enabled: !!restaurant && !loading, filter: restaurant ? { restaurant_id: `eq.${restaurant.id}` } : undefined },
  );

  // Detect new pending orders, then show the alert and play the optional sound.
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

  useEffect(() => {
    if (newOrderAlert && !orders.some((order) => order.id === newOrderAlert.id && order.status === 'pending')) {
      setNewOrderAlert(null);
    }
  }, [newOrderAlert, orders]);

  useRealtime('reviews', (payload) => {
    setReviews((current) => applyReviewChange(current, payload));
  }, {
    enabled: Boolean(restaurant) && features.reviews,
    filter: restaurant ? { restaurant_id: `eq.${restaurant.id}` } : undefined,
  });

  const replyToReview = async (review: ReviewRow) => {
    const reply = await requestText({
      title: review.owner_reply
        ? t('restaurant.dash.reviewEditReply')
        : t('restaurant.dash.reviewReply'),
      inputLabel: t('restaurant.dash.reviewReplyLabel'),
      initialValue: review.owner_reply ?? '',
      confirmLabel: t('common.save'),
      required: true,
    });
    if (!reply || reply.trim().length < 2) return;

    setReplyingReviewId(review.id);
    setActionError(null);
    try {
      const { data, error: replyError } = await callUserAction<{
        owner_reply: string;
        replied_at: string;
      }>('reply_to_restaurant_review', {
        p_review_id: review.id,
        p_reply: reply.trim(),
      });
      if (replyError || !data) throw replyError ?? new Error(t('error.genericBody'));
      setReviews((current) => current.map((item) => (
        item.id === review.id
          ? { ...item, owner_reply: data.owner_reply, replied_at: data.replied_at }
          : item
      )));
    } catch (err) {
      setActionError(userFacingError(err, locale, t('error.genericBody')));
    } finally {
      setReplyingReviewId(null);
    }
  };

  const updateStatus = async (orderId: string, to: OrderStatus) => {
    const order = orders.find((item) => item.id === orderId);
    const current = order?.status;
    if (!order || !current || !canTransition(current, to)) return;
    let reason: string | null = null;
    if (['cancelled', 'failed_delivery', 'refunded'].includes(to)) {
      reason = await requestText({
        title: t('restaurant.dash.statusReasonPrompt'),
        inputLabel: t('restaurant.dash.statusReasonPrompt'),
        confirmLabel: t('common.continue'),
        required: true,
        tone: 'danger',
      });
      if (!reason || reason.length < 3) return;
    }
    setPendingAction(orderId);
    setActionError(null);
    try {
      const { data, error: e } = await callUserAction<OrderRow>('transition_order_status', {
        p_order_id: orderId,
        p_target_status: to,
        p_reason: reason,
        p_expected_updated_at: order.updated_at,
      });
      if (e || !data) throw e ?? new Error(t('error.genericBody'));
      setOrders((prev) =>
        prev.map((o) => (o.id === orderId ? { ...o, ...data } : o)),
      );
    } catch (err) {
      console.error('[Kiyo] Order status update failed:', err);
      setActionError(userFacingError(err, locale, t('error.genericBody')));
      await load(false);
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
          title={t('error.genericTitle')} message={error ?? t('error.genericBody')}
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
            {restaurant.status !== 'published' && ` - ${t('restaurant.dash.awaitingApproval')}`}
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
            title={t('nav.settings')}
            aria-label={t('nav.settings')}
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
          {t('restaurant.dash.financialsError')}: {financialsError}
        </div>
      )}
      {financials && (
        <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="kiyo-card p-4">
            <div className="flex items-center gap-2 text-xs font-medium text-ink-400">
              <DollarSign className="h-3.5 w-3.5" /> {t('restaurant.dash.today')}
            </div>
            <div className="mt-1 font-display text-xl font-extrabold text-ink-900">
              {financials.revenue_today.toLocaleString('fr-DZ')} DZD
            </div>
          </div>
          <div className="kiyo-card p-4">
            <div className="flex items-center gap-2 text-xs font-medium text-ink-400">
              <TrendingUp className="h-3.5 w-3.5" /> {t('restaurant.dash.thisMonth')}
            </div>
            <div className="mt-1 font-display text-xl font-extrabold text-ink-900">
              {financials.revenue_month.toLocaleString('fr-DZ')} DZD
            </div>
          </div>
          <div className="kiyo-card p-4">
            <div className="flex items-center gap-2 text-xs font-medium text-ink-400">
              <Clock className="h-3.5 w-3.5" /> {t('restaurant.dash.commissionOwed')}
            </div>
            <div className="mt-1 font-display text-xl font-extrabold text-ember-600">
              {financials.commission_owed.toLocaleString('fr-DZ')} DZD
            </div>
          </div>
          <div className="kiyo-card p-4">
            <div className="flex items-center gap-2 text-xs font-medium text-ink-400">
              <DollarSign className="h-3.5 w-3.5" /> {t('restaurant.dash.netPayout')}
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
          {soundEnabled ? t('restaurant.dash.soundOn') : t('restaurant.dash.soundOff')}
        </button>
      </div>

      {/* Analytics Panel */}
      {restaurant && <RestaurantAnalyticsPanel restaurantId={restaurant.id} />}

      <ErrorBoundary variant="inline">
        {features.reviews && (
          <Section title={t('restaurant.dash.reviews')} icon={Star} badge={reviews.length}>
            {reviewsLoadError ? (
              <div className="kiyo-card flex flex-wrap items-center justify-between gap-3 border border-warning-200 bg-warning-50 p-4 text-sm text-warning-800">
                <span>{reviewsLoadError}</span>
                <button type="button" onClick={() => void load(false)} className="min-h-11 font-bold underline">{t('error.retry')}</button>
              </div>
            ) : (
              <RestaurantReviews
                reviews={reviews}
                locale={locale}
                ownerMode
                pendingReviewId={replyingReviewId}
                onReply={(review) => void replyToReview(review)}
              />
            )}
          </Section>
        )}

        {pending.length > 0 && (
          <Section title={t('restaurant.waitingOrders')} icon={Bell} badge={pending.length}>
            <OrdersList
              orders={pending} itemsMap={itemsMap}
              onAction={updateStatus} pendingAction={pendingAction}
            />
          </Section>
        )}

        <Section title={t('restaurant.dash.activeOrders')} icon={Clock}>
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
          <Section title={t('restaurant.dash.completed')} icon={Store}>
            <OrdersList
              orders={past} itemsMap={itemsMap}
              onAction={updateStatus} pendingAction={pendingAction}
            />
          </Section>
        )}
      </ErrorBoundary>

      {/* New order alert popup */}
      {newOrderAlert && (
        <div className="fixed bottom-4 end-4 z-50 flex max-w-sm items-start gap-3 rounded-xl border border-ember-500/30 bg-white p-4 shadow-card-lg animate-slide-up">
          <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-ember-500 text-white">
            <Bell className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-display text-sm font-bold text-ink-900">{t('restaurant.dash.newOrderAlert')}</p>
            <p className="text-xs text-ink-500">
              #{newOrderAlert.id.slice(0, 8)} - {newOrderAlert.total} DZD
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
                      <span className="font-semibold">{it.quantity}x</span> {it.name}
                    </span>
                    {it.notes && (
                      <span className="text-xs italic text-ink-400">&quot;{it.notes}&quot;</span>
                    )}
                  </li>
                ))}
              </ul>
            )}

            {o.notes && (
              <p className="mt-2 rounded bg-ink-50 px-2 py-1 text-xs text-ink-500">&quot;{o.notes}&quot;</p>
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
  const { t } = useT();
  if (status === 'connected') {
    return (
      <span className="flex items-center gap-1.5 rounded-lg bg-sage-100 px-2.5 py-2 text-[11px] font-semibold text-sage-600">
        <span className="h-1.5 w-1.5 rounded-full bg-sage-500" />
        {t('restaurant.dash.live')}
      </span>
    );
  }
  if (status === 'error' || status === 'closed') {
    return (
      <span className="flex items-center gap-1.5 rounded-lg bg-error-500/10 px-2.5 py-2 text-[11px] font-semibold text-error-600">
        <RefreshCw className="h-3 w-3" />
        {t('restaurant.dash.reconnecting')}
      </span>
    );
  }
  return (
    <span className="flex items-center gap-1.5 rounded-lg bg-ink-100 px-2.5 py-2 text-[11px] font-semibold text-ink-500">
      <Spinner className="h-3 w-3" />
      {t('restaurant.dash.connecting')}
    </span>
  );
}
