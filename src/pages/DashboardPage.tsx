import { Link } from 'react-router-dom';
import { ChevronRight, ShieldCheck } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useT } from '../lib/i18n-react';
import { AppShell } from '../components/AppShell';

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
  return (
    <AppShell>
      <Hero
        title={t('dash.customer.title')}
        subtitle={t('dash.customer.subtitle')}
        name={profile?.full_name ?? profile?.email ?? ''}
      />
      <ComingSoon />
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
      <ComingSoon />
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

function ComingSoon() {
  const { t } = useT();
  return (
    <div className="kiyo-card flex flex-col items-center justify-center gap-3 px-6 py-16 text-center">
      <div
        className="flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-ember-500/15 to-sage-500/15"
        aria-hidden
      >
        <span className="h-3 w-3 animate-pulse-soft rounded-full bg-ember-500" />
      </div>
      <p className="max-w-sm text-sm text-ink-500">{t('dash.comingSoon')}</p>
    </div>
  );
}
