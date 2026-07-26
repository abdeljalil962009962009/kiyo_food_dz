import { useEffect, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { Bike, ChevronRight, Clock3, Heart, RotateCw, ShieldCheck, ShoppingBag, Star, Store, Utensils } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useT } from '../lib/i18n-react';
import { AppShell } from '../components/AppShell';
import { Skeleton } from '../components/feedback';
import { supabase } from '../lib/supabase';
import { RestaurantImage } from '../components/ui';
import { withExponentialBackoff } from '../lib/locationNetwork';
import {
  pickUsualRestaurant,
  usualRestaurantIsAvailable,
  type RecentRestaurantSummary,
  type UsualRestaurant,
} from '../lib/personalization';

const customerCopy = {
  en: {
    usual: 'Your usual',
    usualBody: 'Ready when you want to reorder from a place you already trust.',
    orderCount: '{count} delivered orders',
    available: 'Available now',
    unavailable: 'Currently unavailable · You can still view the menu',
    minutes: '~{minutes} min',
    personalizationError: 'Your usual restaurant could not be loaded right now.',
    retry: 'Try again',
    driver: 'Deliver with Kiyo Food',
    driverBody: 'Apply securely and follow the review of your driver account.',
  },
  fr: {
    usual: 'Votre habituel',
    usualBody: 'Prêt à recommander chez un restaurant que vous connaissez déjà.',
    orderCount: '{count} commandes livrées',
    available: 'Disponible maintenant',
    unavailable: 'Indisponible actuellement · Vous pouvez consulter le menu',
    minutes: '~{minutes} min',
    personalizationError: 'Votre restaurant habituel ne peut pas être chargé actuellement.',
    retry: 'Réessayer',
    driver: 'Livrer avec Kiyo Food',
    driverBody: 'Postulez en toute sécurité et suivez l’examen de votre compte livreur.',
  },
  ar: {
    usual: 'اختيارك المعتاد',
    usualBody: 'جاهز لإعادة الطلب من مطعم تثق به بالفعل.',
    orderCount: '{count} طلبات تم توصيلها',
    available: 'متاح الآن',
    unavailable: 'غير متاح حالياً · يمكنك الاطلاع على القائمة',
    minutes: 'نحو {minutes} د',
    personalizationError: 'تعذّر تحميل مطعمك المعتاد حالياً.',
    retry: 'إعادة المحاولة',
    driver: 'وصّل مع كيو فود',
    driverBody: 'قدّم طلبك بأمان وتابع مراجعة حساب السائق.',
  },
} as const;

export default function DashboardPage() {
  const { profile } = useAuth();
  const role = profile?.role ?? 'customer';
  if (role === 'super_admin') return <AdminDashboard />;
  if (role === 'restaurant_owner') return <RestaurantDashboard />;
  if (role === 'driver') return <Navigate to="/driver" replace />;
  return <CustomerDashboard />;
}

function CustomerDashboard() {
  const { t, locale } = useT();
  const tx = customerCopy[locale];
  const { profile } = useAuth();
  const [usual, setUsual] = useState<UsualRestaurant | null>(null);
  const [personalLoading, setPersonalLoading] = useState(true);
  const [personalError, setPersonalError] = useState(false);
  const [personalRetry, setPersonalRetry] = useState(0);

  useEffect(() => {
    let active = true;
    if (!profile?.id) {
      setPersonalLoading(false);
      return undefined;
    }
    setPersonalLoading(true);
    setPersonalError(false);
    void withExponentialBackoff(async () => {
      const result = await supabase
        .from('recent_orders_summary')
        .select(`
          restaurant_id,
          order_count,
          last_order_at,
          restaurants!inner(
            id,
            name,
            image_url,
            rating,
            estimated_delivery_min,
            status,
            operational_status,
            is_vacation_mode
          )
        `)
        .eq('customer_id', profile.id)
        .eq('restaurants.status', 'published')
        .order('order_count', { ascending: false })
        .order('last_order_at', { ascending: false })
        .limit(5);
      if (result.error) throw result.error;
      return result.data;
    }, { attempts: 3, timeoutMs: 12_000 })
      .then((data) => {
        if (!active) return;
        setUsual(pickUsualRestaurant((data ?? []) as unknown as RecentRestaurantSummary[]));
      })
      .catch(() => {
        if (!active) return;
        setUsual(null);
        setPersonalError(true);
      })
      .finally(() => {
        if (active) setPersonalLoading(false);
      });
    return () => { active = false; };
  }, [profile?.id, personalRetry]);

  const usualAvailable = usual ? usualRestaurantIsAvailable(usual) : false;

  return (
    <AppShell>
      <Hero
        title={t('dash.customer.title')}
        subtitle={t('dash.customer.subtitle')}
        name={profile?.full_name ?? profile?.email ?? ''}
      />
      {personalLoading ? (
        <div className="kiyo-card mb-4 flex gap-4 p-4" aria-busy="true">
          <div className="h-20 w-20 flex-shrink-0 animate-pulse rounded-lg bg-ink-100" />
          <div className="min-w-0 flex-1"><Skeleton count={3} /></div>
        </div>
      ) : personalError ? (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-warning-200 bg-warning-50 px-4 py-3 text-sm text-warning-800" role="status">
          <span>{tx.personalizationError}</span>
          <button
            type="button"
            onClick={() => setPersonalRetry((value) => value + 1)}
            className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-warning-300 bg-white px-3 font-semibold hover:bg-warning-100"
          >
            <RotateCw className="h-4 w-4" />
            {tx.retry}
          </button>
        </div>
      ) : usual ? (
        <Link
          to={`/restaurant/${usual.id}`}
          className="kiyo-card group mb-4 flex min-h-28 items-center gap-4 overflow-hidden border border-ember-100 p-3 transition hover:border-ember-200 hover:bg-ember-50/60 hover:shadow-card-lg sm:p-4"
        >
          <div className="h-20 w-20 flex-shrink-0 overflow-hidden rounded-lg bg-ink-100 sm:h-24 sm:w-24">
            <RestaurantImage url={usual.image_url} name={usual.name} className="transition-transform duration-300 group-hover:scale-105" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold uppercase text-ember-600">{tx.usual}</p>
            <p className="mt-1 truncate font-display text-base font-bold text-ink-900 sm:text-lg">{usual.name}</p>
            <p className="line-clamp-2 text-xs text-ink-500">{tx.usualBody}</p>
            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] font-semibold">
              <span className={usualAvailable ? 'text-sage-700' : 'text-ink-500'}>
                {usualAvailable ? tx.available : tx.unavailable}
              </span>
              <span className="inline-flex items-center gap-1 text-ink-500">
                <ShoppingBag className="h-3.5 w-3.5" />
                {tx.orderCount.replace('{count}', String(usual.orderCount))}
              </span>
              {usual.rating > 0 && (
                <span className="inline-flex items-center gap-1 text-ink-500">
                  <Star className="h-3.5 w-3.5 fill-warning-400 text-warning-400" />
                  <span dir="ltr">{usual.rating.toFixed(1)}</span>
                </span>
              )}
              {usual.estimated_delivery_min != null && (
                <span className="inline-flex items-center gap-1 text-ink-500">
                  <Clock3 className="h-3.5 w-3.5" />
                  {tx.minutes.replace('{minutes}', String(usual.estimated_delivery_min))}
                </span>
              )}
            </div>
          </div>
          <ChevronRight className={`h-5 w-5 flex-shrink-0 text-ember-500 transition-transform group-hover:translate-x-0.5 ${locale === 'ar' ? 'rotate-180 group-hover:-translate-x-0.5' : ''}`} />
        </Link>
      ) : null}
      <div className="grid gap-3 sm:grid-cols-2">
        <DashboardAction to="/restaurants" icon={ShoppingBag} title={t('market.browse')} subtitle={t('dash.customer.subtitle')} />
        <DashboardAction to="/orders" icon={Utensils} title={t('orders.title')} subtitle={t('dash.customer.ordersSubtitle')} />
        <DashboardAction to="/favorites" icon={Heart} title={t('nav.favorites')} subtitle={t('favorites.subtitle')} />
        <DashboardAction to="/restaurant/apply" icon={Store} title={t('restaurant.apply.nav')} subtitle={t('restaurant.apply.subtitle')} />
        <DashboardAction to="/driver/onboarding" icon={Bike} title={tx.driver} subtitle={tx.driverBody} />
      </div>
    </AppShell>
  );
}

function RestaurantDashboard() {
  const { t } = useT();
  const { profile } = useAuth();
  return (
    <AppShell>
      <Hero
        title={t('dash.restaurant.title')}
        subtitle={t('dash.restaurant.subtitle')}
        name={profile?.full_name ?? profile?.email ?? ''}
        badge={t('role.restaurant_owner')}
      />
      <div className="grid gap-3 sm:grid-cols-2">
        <DashboardAction to="/restaurant" icon={Store} title={t('restaurant.dashboard')} subtitle={t('dash.restaurant.subtitle')} />
        <DashboardAction to="/restaurant/menu" icon={Utensils} title={t('restaurant.manageMenu')} subtitle={t('restaurant.noMenu')} />
      </div>
    </AppShell>
  );
}

function AdminDashboard() {
  const { t } = useT();
  const { profile } = useAuth();
  return (
    <AppShell>
      <Hero
        title={t('dash.admin.title')}
        subtitle={t('dash.admin.subtitle')}
        name={profile?.full_name ?? profile?.email ?? ''}
        badge={t('role.super_admin')}
      />
      <div className="grid gap-3 sm:grid-cols-2">
        <Link
          to="/admin"
          className="kiyo-card group flex items-center justify-between p-5 transition-shadow hover:shadow-card-lg"
        >
          <div className="flex items-center gap-3">
            <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-ink-900 text-white">
              <ShieldCheck className="h-6 w-6" />
            </span>
            <div>
              <div className="font-display text-base font-bold text-ink-900">{t('admin.controlCenter')}</div>
              <div className="text-xs text-ink-400">{t('admin.financialsDesc')}</div>
            </div>
          </div>
          <ChevronRight className="h-5 w-5 text-ink-300 transition-transform group-hover:translate-x-0.5" />
        </Link>
        <Link
          to="/admin/audit"
          className="kiyo-card group flex items-center justify-between p-4 transition-shadow hover:shadow-card-lg"
        >
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-ink-900 text-white">
              <ShieldCheck className="h-5 w-5" />
            </span>
            <div>
              <div className="text-sm font-semibold text-ink-900">{t('nav.auditLogs')}</div>
              <div className="text-xs text-ink-400">{t('audit.title')}</div>
            </div>
          </div>
          <ChevronRight className="h-5 w-5 text-ink-300 transition-transform group-hover:translate-x-0.5" />
        </Link>
      </div>
    </AppShell>
  );
}

function Hero({
  title, subtitle, name, badge,
}: { title: string; subtitle: string; name: string; badge?: string }) {
  const { t } = useT();
  return (
    <div className="mb-6">
      <div className="flex items-center gap-2">
        <p className="text-xs font-medium uppercase tracking-wide text-ember-600">
          {t('dash.welcome')}
        </p>
        {badge && (
          <span className="rounded-full bg-ember-500/10 px-2 py-0.5 text-[10px] font-semibold text-ember-700">
            {badge}
          </span>
        )}
      </div>
      <h1 className="mt-1 font-display text-2xl font-extrabold tracking-tight text-ink-900 sm:text-3xl">
        {name ? `${name.split(' ')[0]}` : title}
      </h1>
      <p className="mt-1 text-sm text-ink-500">{subtitle}</p>
    </div>
  );
}

function DashboardAction({
  to, icon: Icon, title, subtitle,
}: { to: string; icon: typeof ShoppingBag; title: string; subtitle: string }) {
  return (
    <Link
      to={to}
      className="kiyo-card group flex items-center justify-between p-5 transition-shadow hover:shadow-card-lg"
    >
      <div className="flex min-w-0 items-center gap-3">
        <span className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-ink-900 text-white">
          <Icon className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <div className="truncate font-display text-base font-bold text-ink-900">{title}</div>
          <div className="line-clamp-2 text-xs text-ink-400">{subtitle}</div>
        </div>
      </div>
      <ChevronRight className="h-5 w-5 flex-shrink-0 text-ink-300 transition-transform group-hover:translate-x-0.5" />
    </Link>
  );
}
