import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, Heart, ShieldCheck, ShoppingBag, Store, Utensils } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useT } from '../lib/i18n-react';
import { AppShell } from '../components/AppShell';
import { Skeleton } from '../components/feedback';
import { supabase } from '../lib/supabase';

export default function DashboardPage() {
  const { profile } = useAuth();
  const role = profile?.role ?? 'customer';
  if (role === 'super_admin') return <AdminDashboard />;
  if (role === 'restaurant_owner') return <RestaurantDashboard />;
  return <CustomerDashboard />;
}

function CustomerDashboard() {
  const { t } = useT();
  const { profile } = useAuth();
  const [usual, setUsual] = useState<{ id: string; name: string } | null>(null);
  const [personalLoading, setPersonalLoading] = useState(true);

  useEffect(() => {
    let active = true;
    if (!profile?.id) {
      setPersonalLoading(false);
      return undefined;
    }
    void supabase.from('orders').select('restaurant_id, restaurants(id, name)').order('created_at', { ascending: false }).limit(30).then(({ data }) => {
      if (!active) return;
      const counts = new Map<string, { id: string; name: string; count: number }>();
      for (const row of (data ?? []) as unknown as Array<{ restaurant_id: string; restaurants: { id: string; name: string } | null }>) {
        if (!row.restaurants) continue;
        const current = counts.get(row.restaurant_id) ?? { ...row.restaurants, count: 0 };
        current.count += 1;
        counts.set(row.restaurant_id, current);
      }
      const favorite = [...counts.values()].sort((a, b) => b.count - a.count)[0];
      setUsual(favorite ? { id: favorite.id, name: favorite.name } : null);
      setPersonalLoading(false);
    });
    return () => { active = false; };
  }, [profile?.id]);

  return (
    <AppShell>
      <Hero
        title={t('dash.customer.title')}
        subtitle={t('dash.customer.subtitle')}
        name={profile?.full_name ?? profile?.email ?? ''}
      />
      {personalLoading ? (
        <div className="kiyo-card mb-4 p-4"><Skeleton count={2} /></div>
      ) : usual ? (
        <Link to={`/restaurants/${usual.id}`} className="kiyo-card mb-4 flex items-center justify-between border border-ember-100 p-4 hover:bg-ember-50">
          <div><p className="text-xs font-bold uppercase text-ember-600">{t('dash.welcome')}</p><p className="mt-1 font-display text-base font-bold text-ink-900">{usual.name}</p><p className="text-xs text-ink-500">{t('orders.reorder')}</p></div>
          <ChevronRight className="h-5 w-5 text-ember-500" />
        </Link>
      ) : null}
      <div className="grid gap-3 sm:grid-cols-2">
        <DashboardAction to="/restaurants" icon={ShoppingBag} title={t('market.browse')} subtitle={t('dash.customer.subtitle')} />
        <DashboardAction to="/orders" icon={Utensils} title={t('orders.title')} subtitle={t('dash.customer.ordersSubtitle')} />
        <DashboardAction to="/favorites" icon={Heart} title={t('nav.favorites')} subtitle={t('favorites.subtitle')} />
        <DashboardAction to="/restaurant/apply" icon={Store} title={t('restaurant.apply.nav')} subtitle={t('restaurant.apply.subtitle')} />
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
