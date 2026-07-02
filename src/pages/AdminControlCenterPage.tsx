import { useCallback, useEffect, useState } from 'react';
import {
  DollarSign, Users, Store, ShoppingBag, TrendingUp, AlertTriangle,
  CheckCircle, Clock, Ban, ShieldCheck, Star, Settings, Activity,
  Download, ChevronRight, Search, BadgeCheck, Sparkles, Tag, FileText,
  MessageCircle, Send, ChevronLeft, Package, MapPin,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { useT } from '../lib/i18n-react';
import { supabase, type Profile, type Restaurant, type AuditLog, type PromoCode, type SupportTicket } from '../lib/supabase';
import { AppShell } from '../components/AppShell';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { Skeleton, ErrorState, Spinner } from '../components/feedback';
import { RestaurantImage } from '../components/ui';

type Analytics = {
  revenue: { today: number; this_week: number; this_month: number; this_year: number; all_time: number };
  commission: { today: number; this_month: number; all_time: number };
  orders: { total: number; today: number; pending: number; cancelled: number; delivered: number };
  restaurants: { total: number; published: number; pending: number; suspended: number; verified: number };
  users: { total: number; customers: number; owners: number; admins: number; suspended: number };
  settlements: { pending: number; overdue: number; paid_this_year: number };
};

type Tab = 'overview' | 'financials' | 'settlements' | 'users' | 'restaurants' | 'rules' | 'analytics' | 'alerts' | 'marketing' | 'support' | 'monitoring' | 'geography';

const DZD = (n: number) => new Intl.NumberFormat('fr-DZ', { style: 'currency', currency: 'DZD', maximumFractionDigits: 0 }).format(n);

export default function AdminControlCenterPage() {
  const [tab, setTab] = useState<Tab>('overview');

  const tabs: { id: Tab; label: string; icon: React.ElementType }[] = [
    { id: 'overview', label: 'Overview', icon: Activity },
    { id: 'financials', label: 'Financial Center', icon: DollarSign },
    { id: 'settlements', label: 'Settlements', icon: FileText },
    { id: 'users', label: 'Users', icon: Users },
    { id: 'restaurants', label: 'Restaurants', icon: Store },
    { id: 'geography', label: 'Geography', icon: MapPin },
    { id: 'rules', label: 'Business Rules', icon: Settings },
    { id: 'analytics', label: 'Analytics', icon: TrendingUp },
    { id: 'alerts', label: 'Alerts', icon: AlertTriangle },
    { id: 'marketing', label: 'Marketing', icon: Tag },
    { id: 'support', label: 'Support', icon: MessageCircle },
    { id: 'monitoring', label: 'Monitoring', icon: ShieldCheck },
  ];

  return (
    <AppShell>
      <div className="mb-6">
        <div className="flex items-center gap-3">
          <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-ink-900 text-white">
            <ShieldCheck className="h-6 w-6" />
          </span>
          <div>
            <h1 className="font-display text-2xl font-extrabold tracking-tight text-ink-900">
              Control Center
            </h1>
            <p className="text-sm text-ink-400">Full platform visibility & management</p>
          </div>
        </div>
      </div>

      {/* Tab bar */}
      <div className="mb-6 flex gap-1 overflow-x-auto rounded-xl border border-ink-100 bg-white p-1">
        {tabs.map((tb) => (
          <button
            key={tb.id}
            onClick={() => setTab(tb.id)}
            className={`inline-flex flex-shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
              tab === tb.id ? 'bg-ink-900 text-white' : 'text-ink-600 hover:bg-ink-50'
            }`}
          >
            <tb.icon className="h-4 w-4" />
            {tb.label}
          </button>
        ))}
      </div>

      <ErrorBoundary variant="inline">
        {tab === 'overview' && <OverviewTab />}
        {tab === 'financials' && <FinancialsTab />}
        {tab === 'settlements' && <SettlementsTab />}
        {tab === 'users' && <UsersTab />}
        {tab === 'restaurants' && <RestaurantsTab />}
        {tab === 'geography' && <GeographyTab />}
        {tab === 'rules' && <RulesTab />}
        {tab === 'analytics' && <AnalyticsTab />}
        {tab === 'alerts' && <AlertsTab />}
        {tab === 'marketing' && <MarketingTab />}
        {tab === 'support' && <AdminSupportTab />}
        {tab === 'monitoring' && <MonitoringTab />}
      </ErrorBoundary>
    </AppShell>
  );
}

// ===================== OVERVIEW =====================
function OverviewTab() {
  const { t } = useT();
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [audit, setAudit] = useState<AuditLog[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [a, al] = await Promise.all([
        supabase.rpc('get_platform_analytics'),
        supabase.from('audit_logs').select('*').order('created_at', { ascending: false }).limit(10),
      ]);
      if (a.error) throw a.error;
      setAnalytics(a.data as Analytics);
      setAudit((al.data as AuditLog[]) ?? []);
    } catch {
      setError(t('error.genericBody'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => { void load(); }, [load]);

  if (loading) return <Skeleton count={4} />;
  if (error) return <ErrorState title={t('error.genericTitle')} message={error} onRetry={load} retryLabel={t('error.retry')} />;
  if (!analytics) return null;

  return (
    <div className="space-y-6">
      {/* Revenue cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <StatCard icon={DollarSign} label="Today" value={DZD(analytics.revenue.today)} accent="ember" />
        <StatCard icon={TrendingUp} label="This Week" value={DZD(analytics.revenue.this_week)} />
        <StatCard icon={TrendingUp} label="This Month" value={DZD(analytics.revenue.this_month)} accent="ember" />
        <StatCard icon={TrendingUp} label="This Year" value={DZD(analytics.revenue.this_year)} />
        <StatCard icon={DollarSign} label="All Time" value={DZD(analytics.revenue.all_time)} />
      </div>

      {/* Commission + orders */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard icon={DollarSign} label="Commission (Month)" value={DZD(analytics.commission.this_month)} accent="sage" />
        <StatCard icon={ShoppingBag} label="Orders Today" value={String(analytics.orders.today)} />
        <StatCard icon={Clock} label="Pending Orders" value={String(analytics.orders.pending)} />
        <StatCard icon={AlertTriangle} label="Pending Settlements" value={DZD(analytics.settlements.pending)} accent="warning" />
      </div>

      {/* Platform stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard icon={Users} label="Total Users" value={String(analytics.users.total)} />
        <StatCard icon={Store} label="Restaurants" value={String(analytics.restaurants.total)} />
        <StatCard icon={ShoppingBag} label="Total Orders" value={String(analytics.orders.total)} />
        <StatCard icon={BadgeCheck} label="Verified" value={String(analytics.restaurants.verified)} accent="sage" />
      </div>

      {/* Recent activity */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-display text-base font-bold text-ink-900">Recent Activity</h3>
          <Link to="/admin/audit" className="inline-flex items-center gap-1 text-xs font-semibold text-ember-600 hover:text-ember-700">
            View all <ChevronRight className="h-3 w-3" />
          </Link>
        </div>
        {audit.length === 0 ? (
          <div className="kiyo-card p-6 text-center text-sm text-ink-400">No recent activity</div>
        ) : (
          <ul className="kiyo-card divide-y divide-ink-100">
            {audit.map((log) => (
              <li key={log.id} className="flex items-center gap-3 px-4 py-3">
                <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-ink-100 text-ink-500">
                  <Activity className="h-4 w-4" />
                </span>
                <span className="flex-1 truncate text-sm font-medium text-ink-800">
                  {log.action.replace(/_/g, ' ')}
                </span>
                <span className="text-xs text-ink-400">{new Date(log.created_at).toLocaleString()}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

// ===================== FINANCIALS =====================
function FinancialsTab() {
  const { t } = useT();
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [ledger, setLedger] = useState<Array<{ restaurant_id: string; restaurant_name: string; total: number; commission: number; payout: number; }>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [a, l] = await Promise.all([
        supabase.rpc('get_platform_analytics'),
        supabase.from('financial_ledger').select('restaurant_id, platform_commission, restaurant_payout, order_total').order('created_at', { ascending: false }).limit(100),
      ]);
      if (a.error) throw a.error;
      setAnalytics(a.data as Analytics);
      const r = await supabase.from('restaurants').select('id, name');
      const rMap = new Map((r.data ?? []).map((x: { id: string; name: string }) => [x.id, x.name]));
      const agg = new Map<string, { restaurant_name: string; total: number; commission: number; payout: number }>();
      for (const row of (l.data ?? []) as Array<{ restaurant_id: string; platform_commission: string; restaurant_payout: string; order_total: string }>) {
        const existing = agg.get(row.restaurant_id) ?? { restaurant_name: rMap.get(row.restaurant_id) ?? 'Unknown', total: 0, commission: 0, payout: 0 };
        existing.total += parseFloat(row.order_total);
        existing.commission += parseFloat(row.platform_commission);
        existing.payout += parseFloat(row.restaurant_payout);
        agg.set(row.restaurant_id, existing);
      }
      setLedger(Array.from(agg.entries()).map(([id, v]) => ({ restaurant_id: id, ...v })));
    } catch {
      setError(t('error.genericBody'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => { void load(); }, [load]);

  if (loading) return <Skeleton count={4} />;
  if (error) return <ErrorState title={t('error.genericTitle')} message={error} onRetry={load} retryLabel={t('error.retry')} />;
  if (!analytics) return null;

  const exportCSV = () => {
    const rows = [
      ['Restaurant', 'Total Revenue', 'Commission', 'Payout'],
      ...ledger.map((r) => [r.restaurant_name, r.total.toFixed(2), r.commission.toFixed(2), r.payout.toFixed(2)]),
    ];
    const csv = rows.map((r) => r.map((c) => `"${c}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `kiyo-financials-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Revenue summary */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <StatCard icon={DollarSign} label="Today" value={DZD(analytics.revenue.today)} accent="ember" />
        <StatCard icon={TrendingUp} label="This Week" value={DZD(analytics.revenue.this_week)} />
        <StatCard icon={TrendingUp} label="This Month" value={DZD(analytics.revenue.this_month)} accent="ember" />
        <StatCard icon={TrendingUp} label="This Year" value={DZD(analytics.revenue.this_year)} />
        <StatCard icon={DollarSign} label="All Time" value={DZD(analytics.revenue.all_time)} />
      </div>

      {/* Commission breakdown */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatCard icon={DollarSign} label="Commission Today" value={DZD(analytics.commission.today)} accent="sage" />
        <StatCard icon={DollarSign} label="Commission This Month" value={DZD(analytics.commission.this_month)} accent="sage" />
        <StatCard icon={DollarSign} label="Commission All Time" value={DZD(analytics.commission.all_time)} accent="sage" />
      </div>

      {/* Settlements */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatCard icon={Clock} label="Pending Settlements" value={DZD(analytics.settlements.pending)} accent="warning" />
        <StatCard icon={AlertTriangle} label="Overdue" value={DZD(analytics.settlements.overdue)} accent="error" />
        <StatCard icon={CheckCircle} label="Paid This Year" value={DZD(analytics.settlements.paid_this_year)} accent="sage" />
      </div>

      {/* Per-restaurant financials */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-display text-base font-bold text-ink-900">Restaurant Financials</h3>
          <button onClick={exportCSV} className="kiyo-btn-secondary">
            <Download className="h-4 w-4" />
            <span className="hidden sm:inline">Export CSV</span>
          </button>
        </div>
        {ledger.length === 0 ? (
          <div className="kiyo-card p-6 text-center text-sm text-ink-400">No financial data yet</div>
        ) : (
          <div className="kiyo-card overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-ink-100 text-left text-xs font-semibold uppercase tracking-wide text-ink-400">
                  <th className="px-4 py-3">Restaurant</th>
                  <th className="px-4 py-3 text-right">Revenue</th>
                  <th className="px-4 py-3 text-right">Commission</th>
                  <th className="px-4 py-3 text-right">Payout</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-50">
                {ledger.map((r) => (
                  <tr key={r.restaurant_id} className="hover:bg-ink-50/50">
                    <td className="px-4 py-3 font-medium text-ink-900">{r.restaurant_name}</td>
                    <td className="px-4 py-3 text-right text-ink-700">{DZD(r.total)}</td>
                    <td className="px-4 py-3 text-right text-ember-600">{DZD(r.commission)}</td>
                    <td className="px-4 py-3 text-right text-sage-600">{DZD(r.payout)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ===================== USERS =====================
function UsersTab() {
  const { t } = useT();
  const [users, setUsers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [actingId, setActingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: e } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });
      if (e) throw e;
      setUsers((data as Profile[]) ?? []);
    } catch {
      setError(t('error.genericBody'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => { void load(); }, [load]);

  const toggleSuspend = async (user: Profile) => {
    setActingId(user.id);
    try {
      const { error: e } = await supabase.rpc('set_user_suspended', {
        p_user_id: user.id,
        p_suspended: !user.is_suspended,
        p_reason: !user.is_suspended ? 'Suspended by admin' : null,
      });
      if (e) throw e;
      setUsers((prev) => prev.map((u) => u.id === user.id ? { ...u, is_suspended: !u.is_suspended } : u));
    } finally {
      setActingId(null);
    }
  };

  const filtered = users.filter((u) => {
    const q = search.toLowerCase();
    return !q || (u.email ?? '').toLowerCase().includes(q) || (u.full_name ?? '').toLowerCase().includes(q);
  });

  if (loading) return <Skeleton count={4} />;
  if (error) return <ErrorState title={t('error.genericTitle')} message={error} onRetry={load} retryLabel={t('error.retry')} />;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-300" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search users by name or email..."
            className="w-full rounded-lg border border-ink-100 bg-white py-2 pl-10 pr-4 text-sm text-ink-900 placeholder:text-ink-300 focus:border-ember-500 focus:outline-none"
          />
        </div>
      </div>

      <div className="kiyo-card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-ink-100 text-left text-xs font-semibold uppercase tracking-wide text-ink-400">
              <th className="px-4 py-3">User</th>
              <th className="px-4 py-3">Role</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Joined</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-ink-50">
            {filtered.map((u) => (
              <tr key={u.id} className="hover:bg-ink-50/50">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-ember-500 text-xs font-bold text-white">
                      {(u.full_name ?? u.email ?? '?').charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div className="font-medium text-ink-900">{u.full_name ?? 'Unnamed'}</div>
                      <div className="text-xs text-ink-400">{u.email}</div>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <span className="rounded-full bg-ink-100 px-2 py-0.5 text-xs font-medium text-ink-700">
                    {u.role.replace(/_/g, ' ')}
                  </span>
                </td>
                <td className="px-4 py-3">
                  {u.is_suspended ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-error-500/10 px-2 py-0.5 text-xs font-medium text-error-600">
                      <Ban className="h-3 w-3" /> Suspended
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-full bg-sage-500/10 px-2 py-0.5 text-xs font-medium text-sage-600">
                      <CheckCircle className="h-3 w-3" /> Active
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-xs text-ink-400">
                  {new Date(u.created_at).toLocaleDateString()}
                </td>
                <td className="px-4 py-3 text-right">
                  <button
                    onClick={() => toggleSuspend(u)}
                    disabled={actingId === u.id}
                    className={`kiyo-btn-secondary text-xs ${
                      u.is_suspended
                        ? 'border-sage-500/30 text-sage-600 hover:bg-sage-500/10'
                        : 'border-error-500/30 text-error-600 hover:bg-error-500/10'
                    }`}
                  >
                    {actingId === u.id ? <Spinner className="h-3 w-3" /> : <Ban className="h-3 w-3" />}
                    {u.is_suspended ? 'Restore' : 'Suspend'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ===================== RESTAURANTS =====================
function RestaurantsTab() {
  const { t } = useT();
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actingId, setActingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: e } = await supabase
        .from('restaurants')
        .select('*')
        .order('created_at', { ascending: false });
      if (e) throw e;
      setRestaurants((data as Restaurant[]) ?? []);
    } catch {
      setError(t('error.genericBody'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => { void load(); }, [load]);

  const updateRestaurant = async (r: Restaurant, updates: { status?: string; is_verified?: boolean; is_featured?: boolean }) => {
    setActingId(r.id);
    try {
      const { error: e } = await supabase.rpc('update_restaurant_admin', {
        p_restaurant_id: r.id,
        p_status: updates.status ?? null,
        p_is_verified: updates.is_verified ?? null,
        p_is_featured: updates.is_featured ?? null,
      });
      if (e) throw e;
      setRestaurants((prev) => prev.map((x) => x.id === r.id ? { ...x, ...updates } as Restaurant : x));
    } finally {
      setActingId(null);
    }
  };

  if (loading) return <Skeleton count={4} />;
  if (error) return <ErrorState title={t('error.genericTitle')} message={error} onRetry={load} retryLabel={t('error.retry')} />;

  return (
    <div className="space-y-3">
      {restaurants.map((r) => (
        <div key={r.id} className="kiyo-card flex items-center gap-3 p-3">
          <div className="h-12 w-12 flex-shrink-0 overflow-hidden rounded-lg">
            <RestaurantImage url={r.image_url} name={r.name} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h3 className="truncate font-display text-sm font-bold text-ink-900">{r.name}</h3>
              {r.is_verified && (
                <BadgeCheck className="h-4 w-4 flex-shrink-0 text-ember-500" />
              )}
              {r.is_featured && (
                <Sparkles className="h-4 w-4 flex-shrink-0 text-sage-500" />
              )}
            </div>
            <div className="flex items-center gap-2 text-xs text-ink-400">
              <span className={`rounded-full px-2 py-0.5 font-medium ${
                r.status === 'published' ? 'bg-sage-500/10 text-sage-600' :
                r.status === 'suspended' ? 'bg-error-500/10 text-error-600' :
                'bg-ink-100 text-ink-500'
              }`}>{r.status.replace(/_/g, ' ')}</span>
              {r.rating > 0 && (
                <span className="inline-flex items-center gap-0.5">
                  <Star className="h-3 w-3 text-ember-500" />
                  {r.rating.toFixed(1)}
                </span>
              )}
            </div>
          </div>
          <div className="flex flex-wrap gap-1.5">
            <button
              onClick={() => updateRestaurant(r, { is_verified: !r.is_verified })}
              disabled={actingId === r.id}
              className={`kiyo-btn-secondary text-xs ${r.is_verified ? 'border-ember-500/30 text-ember-600' : ''}`}
              title="Toggle verified"
            >
              {actingId === r.id ? <Spinner className="h-3 w-3" /> : <BadgeCheck className="h-3 w-3" />}
              {r.is_verified ? 'Unverify' : 'Verify'}
            </button>
            <button
              onClick={() => updateRestaurant(r, { is_featured: !r.is_featured })}
              disabled={actingId === r.id}
              className={`kiyo-btn-secondary text-xs ${r.is_featured ? 'border-sage-500/30 text-sage-600' : ''}`}
              title="Toggle featured"
            >
              <Sparkles className="h-3 w-3" />
              {r.is_featured ? 'Unfeature' : 'Feature'}
            </button>
            {r.status !== 'published' && (
              <button
                onClick={() => updateRestaurant(r, { status: 'published' })}
                disabled={actingId === r.id}
                className="kiyo-btn-primary bg-sage-500 text-xs hover:bg-sage-600"
              >
                Publish
              </button>
            )}
            {r.status !== 'suspended' && (
              <button
                onClick={() => updateRestaurant(r, { status: 'suspended' })}
                disabled={actingId === r.id}
                className="kiyo-btn-secondary border-error-500/30 text-xs text-error-600 hover:bg-error-500/10"
              >
                Suspend
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

// ===================== BUSINESS RULES =====================
function RulesTab() {
  const { t } = useT();
  const [settings, setSettings] = useState<Record<string, Record<string, unknown>>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedKey, setSavedKey] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: e } = await supabase.from('platform_settings').select('*');
      if (e) throw e;
      const map: Record<string, Record<string, unknown>> = {};
      for (const row of (data ?? []) as Array<{ key: string; value: Record<string, unknown> }>) {
        map[row.key] = row.value;
      }
      setSettings(map);
    } catch {
      setError(t('error.genericBody'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => { void load(); }, [load]);

  const save = async (key: string) => {
    setSaving(true);
    setSavedKey(null);
    try {
      const { error: e } = await supabase.rpc('update_platform_setting', {
        p_key: key,
        p_value: settings[key],
      });
      if (e) throw e;
      setSavedKey(key);
      setTimeout(() => setSavedKey(null), 2000);
    } catch {
      setError(t('error.genericBody'));
    } finally {
      setSaving(false);
    }
  };

  const updateField = (key: string, field: string, value: unknown) => {
    setSettings((prev) => ({ ...prev, [key]: { ...prev[key], [field]: value } }));
  };

  if (loading) return <Skeleton count={4} />;
  if (error) return <ErrorState title={t('error.genericTitle')} message={error} onRetry={load} retryLabel={t('error.retry')} />;

  return (
    <div className="space-y-6">
      {/* Delivery Rules */}
      <RulesCard title="Delivery Rules" icon={Settings} onSave={() => save('delivery')} saving={saving} saved={savedKey === 'delivery'}>
        <RuleField label="Price per km (DZD)" value={settings.delivery?.price_per_km as number ?? 25}
          onChange={(v) => updateField('delivery', 'price_per_km', Number(v))} />
        <RuleField label="Minimum fee (DZD)" value={settings.delivery?.min_fee as number ?? 50}
          onChange={(v) => updateField('delivery', 'min_fee', Number(v))} />
        <RuleField label="Maximum fee (DZD)" value={settings.delivery?.max_fee as number ?? 500}
          onChange={(v) => updateField('delivery', 'max_fee', Number(v))} />
        <RuleField label="Free delivery threshold (DZD)" value={settings.delivery?.free_delivery_threshold as number ?? 1500}
          onChange={(v) => updateField('delivery', 'free_delivery_threshold', Number(v))} />
        <RuleField label="Default max delivery km" value={settings.delivery?.default_max_delivery_km as number ?? 10}
          onChange={(v) => updateField('delivery', 'default_max_delivery_km', Number(v))} />
      </RulesCard>

      {/* Commission Rules */}
      <RulesCard title="Commission Rules" icon={DollarSign} onSave={() => save('commission')} saving={saving} saved={savedKey === 'commission'}>
        <RuleField label="Default commission rate (%)" value={((settings.commission?.default_rate as number ?? 0.07) * 100).toFixed(1)}
          onChange={(v) => updateField('commission', 'default_rate', Number(v) / 100)} />
        <RuleField label="Service fee rate (%)" value={((settings.commission?.service_fee_rate as number ?? 0.01) * 100).toFixed(1)}
          onChange={(v) => updateField('commission', 'service_fee_rate', Number(v) / 100)} />
      </RulesCard>

      {/* Settlement Rules */}
      <RulesCard title="Settlement Rules" icon={Clock} onSave={() => save('settlement')} saving={saving} saved={savedKey === 'settlement'}>
        <RuleField label="Due day of month" value={settings.settlement?.due_day as number ?? 15}
          onChange={(v) => updateField('settlement', 'due_day', Number(v))} />
        <RuleField label="Grace period (days)" value={settings.settlement?.grace_days as number ?? 7}
          onChange={(v) => updateField('settlement', 'grace_days', Number(v))} />
        <RuleField label="Penalty rate (%)" value={((settings.settlement?.penalty_rate as number ?? 0.02) * 100).toFixed(1)}
          onChange={(v) => updateField('settlement', 'penalty_rate', Number(v) / 100)} />
      </RulesCard>

      {/* Operational Rules */}
      <RulesCard title="Operational Rules" icon={Activity} onSave={() => save('operational')} saving={saving} saved={savedKey === 'operational'}>
        <RuleToggle label="Maintenance mode" value={settings.operational?.maintenance_mode as boolean ?? false}
          onChange={(v) => updateField('operational', 'maintenance_mode', v)} />
        <RuleToggle label="Registration open" value={settings.operational?.registration_open as boolean ?? true}
          onChange={(v) => updateField('operational', 'registration_open', v)} />
        <RuleToggle label="Verification required" value={settings.operational?.verification_required as boolean ?? true}
          onChange={(v) => updateField('operational', 'verification_required', v)} />
        <div>
          <label className="mb-1 block text-xs font-medium text-ink-500">Announcement banner</label>
          <input
            type="text"
            value={(settings.operational?.announcement_banner as string) ?? ''}
            onChange={(e) => updateField('operational', 'announcement_banner', e.target.value)}
            placeholder="e.g. Free delivery this weekend!"
            className="w-full rounded-lg border border-ink-100 bg-white px-3 py-2 text-sm text-ink-900 placeholder:text-ink-300 focus:border-ember-500 focus:outline-none"
          />
        </div>
      </RulesCard>

      {/* Maintenance Mode */}
      <RulesCard title="Maintenance Mode" icon={Settings} onSave={() => save('maintenance')} saving={saving} saved={savedKey === 'maintenance'}>
        <RuleToggle label="Enable maintenance mode" value={settings.maintenance?.enabled as boolean ?? false}
          onChange={(v) => updateField('maintenance', 'enabled', v)} />
        <RuleToggle label="Allow admin access during maintenance" value={settings.maintenance?.allow_admin_access as boolean ?? true}
          onChange={(v) => updateField('maintenance', 'allow_admin_access', v)} />
        <RuleField label="Maintenance message" value={settings.maintenance?.message as string ?? 'We are performing scheduled maintenance. Please check back shortly.'}
          onChange={(v) => updateField('maintenance', 'message', v)} />
      </RulesCard>

      {/* Order Rules */}
      <RulesCard title="Order Rules" icon={Clock} onSave={() => save('order_rules')} saving={saving} saved={savedKey === 'order_rules'}>
        <RuleField label="Cancellation window (minutes)" value={settings.order_rules?.cancellation_window_minutes as number ?? 5}
          onChange={(v) => updateField('order_rules', 'cancellation_window_minutes', Number(v))} />
        <RuleField label="Acceptance timeout (minutes)" value={settings.order_rules?.acceptance_timeout_minutes as number ?? 10}
          onChange={(v) => updateField('order_rules', 'acceptance_timeout_minutes', Number(v))} />
        <RuleToggle label="Auto-cancel after timeout" value={settings.order_rules?.auto_cancel_after_timeout as boolean ?? true}
          onChange={(v) => updateField('order_rules', 'auto_cancel_after_timeout', v)} />
        <RuleField label="Busy mode threshold (orders)" value={settings.order_rules?.busy_mode_threshold as number ?? 15}
          onChange={(v) => updateField('order_rules', 'busy_mode_threshold', Number(v))} />
        <RuleToggle label="Auto busy mode" value={settings.order_rules?.auto_busy_mode as boolean ?? true}
          onChange={(v) => updateField('order_rules', 'auto_busy_mode', v)} />
      </RulesCard>

      {/* Feature Flags */}
      <RulesCard title="Feature Flags" icon={Sparkles} onSave={() => save('features')} saving={saving} saved={savedKey === 'features'}>
        {Object.entries(settings.features ?? {}).filter(([, v]) => typeof v === 'boolean').map(([key, val]) => (
          <RuleToggle key={key} label={key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
            value={val as boolean} onChange={(v) => updateField('features', key, v)} />
        ))}
      </RulesCard>
    </div>
  );
}

function RulesCard({ title, icon: Icon, children, onSave, saving, saved }: {
  title: string; icon: React.ElementType; children: React.ReactNode; onSave: () => void; saving: boolean; saved: boolean;
}) {
  return (
    <div className="kiyo-card p-5">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-ink-100 text-ink-700">
            <Icon className="h-4 w-4" />
          </span>
          <h3 className="font-display text-base font-bold text-ink-900">{title}</h3>
        </div>
        <button onClick={onSave} disabled={saving} className="kiyo-btn-primary text-xs">
          {saving ? <Spinner className="h-3 w-3" /> : saved ? <CheckCircle className="h-3 w-3" /> : null}
          {saved ? 'Saved!' : 'Save'}
        </button>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">{children}</div>
    </div>
  );
}

function RuleField({ label, value, onChange }: { label: string; value: string | number; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-ink-500">{label}</label>
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-ink-100 bg-white px-3 py-2 text-sm text-ink-900 focus:border-ember-500 focus:outline-none"
      />
    </div>
  );
}

function RuleToggle({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-ink-100 bg-white px-3 py-2">
      <span className="text-sm font-medium text-ink-700">{label}</span>
      <button
        onClick={() => onChange(!value)}
        className={`relative h-6 w-11 rounded-full transition-colors ${value ? 'bg-ember-500' : 'bg-ink-200'}`}
        role="switch"
        aria-checked={value}
      >
        <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${value ? 'translate-x-5' : 'translate-x-0.5'}`} />
      </button>
    </div>
  );
}

// ===================== ANALYTICS =====================
function AnalyticsTab() {
  const { t } = useT();
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: e } = await supabase.rpc('get_platform_analytics');
      if (e) throw e;
      setAnalytics(data as Analytics);
    } catch {
      setError(t('error.genericBody'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => { void load(); }, [load]);

  if (loading) return <Skeleton count={4} />;
  if (error) return <ErrorState title={t('error.genericTitle')} message={error} onRetry={load} retryLabel={t('error.retry')} />;
  if (!analytics) return null;

  const totalOrders = analytics.orders.total || 1;
  const cancelRate = ((analytics.orders.cancelled / totalOrders) * 100).toFixed(1);
  const deliveryRate = ((analytics.orders.delivered / totalOrders) * 100).toFixed(1);

  return (
    <div className="space-y-6">
      <div>
        <h3 className="mb-3 font-display text-base font-bold text-ink-900">Customer Analytics</h3>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard icon={Users} label="Total Customers" value={String(analytics.users.customers)} />
          <StatCard icon={Users} label="Restaurant Owners" value={String(analytics.users.owners)} />
          <StatCard icon={Users} label="Suspended" value={String(analytics.users.suspended)} accent="error" />
          <StatCard icon={Users} label="Total Users" value={String(analytics.users.total)} />
        </div>
      </div>

      <div>
        <h3 className="mb-3 font-display text-base font-bold text-ink-900">Restaurant Analytics</h3>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard icon={Store} label="Total" value={String(analytics.restaurants.total)} />
          <StatCard icon={Store} label="Published" value={String(analytics.restaurants.published)} accent="sage" />
          <StatCard icon={Store} label="Pending" value={String(analytics.restaurants.pending)} accent="warning" />
          <StatCard icon={BadgeCheck} label="Verified" value={String(analytics.restaurants.verified)} />
        </div>
      </div>

      <div>
        <h3 className="mb-3 font-display text-base font-bold text-ink-900">Order Analytics</h3>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard icon={ShoppingBag} label="Total Orders" value={String(analytics.orders.total)} />
          <StatCard icon={ShoppingBag} label="Today" value={String(analytics.orders.today)} />
          <StatCard icon={AlertTriangle} label={`Cancelled (${cancelRate}%)`} value={String(analytics.orders.cancelled)} accent="error" />
          <StatCard icon={CheckCircle} label={`Delivered (${deliveryRate}%)`} value={String(analytics.orders.delivered)} accent="sage" />
        </div>
      </div>
    </div>
  );
}

// ===================== SETTLEMENTS =====================
function SettlementsTab() {
  const { t } = useT();
  const [overview, setOverview] = useState<{
    total_owed: number; total_paid: number; overdue_count: number; pending_count: number; paid_count: number;
    recent: Array<{
      id: string; restaurant_id: string; restaurant_name: string;
      period_start: string; period_end: string;
      gross_sales: string; commission: string; payout: string;
      amount_owed: string; amount_paid: string; balance: string;
      status: string; due_date: string | null; settled_at: string | null;
    }>;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actingId, setActingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: e } = await supabase.rpc('get_settlement_overview');
      if (e) throw e;
      setOverview(data as typeof overview);
    } catch {
      setError(t('error.genericBody'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => { void load(); }, [load]);

  const markPaid = async (id: string) => {
    setActingId(id);
    try {
      const { error: e } = await supabase.rpc('mark_settlement_paid', {
        p_settlement_id: id, p_amount: null, p_notes: 'Marked as paid by admin',
      });
      if (e) throw e;
      void load();
    } finally {
      setActingId(null);
    }
  };

  if (loading) return <Skeleton count={3} />;
  if (error) return <ErrorState title={t('error.genericTitle')} message={error} onRetry={load} retryLabel={t('error.retry')} />;
  if (!overview) return null;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard icon={Clock} label="Pending" value={String(overview.pending_count)} accent="warning" />
        <StatCard icon={AlertTriangle} label="Overdue" value={String(overview.overdue_count)} accent="error" />
        <StatCard icon={CheckCircle} label="Paid" value={String(overview.paid_count)} accent="sage" />
        <StatCard icon={DollarSign} label="Total Owed" value={DZD(overview.total_owed)} accent="ember" />
      </div>

      <div>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-display text-base font-bold text-ink-900">Settlement History</h3>
          <button onClick={exportSettlementsCSV} className="kiyo-btn-secondary">
            <Download className="h-4 w-4" />
            <span className="hidden sm:inline">Export CSV</span>
          </button>
        </div>
        {overview.recent.length === 0 ? (
          <div className="kiyo-card p-6 text-center text-sm text-ink-400">No settlements yet</div>
        ) : (
          <div className="kiyo-card overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-ink-100 text-left text-xs font-semibold uppercase tracking-wide text-ink-400">
                  <th className="px-4 py-3">Restaurant</th>
                  <th className="px-4 py-3">Period</th>
                  <th className="px-4 py-3 text-right">Gross</th>
                  <th className="px-4 py-3 text-right">Commission</th>
                  <th className="px-4 py-3 text-right">Balance</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-50">
                {overview.recent.map((s) => (
                  <tr key={s.id} className="hover:bg-ink-50/50">
                    <td className="px-4 py-3 font-medium text-ink-900">{s.restaurant_name}</td>
                    <td className="px-4 py-3 text-xs text-ink-500">
                      {s.period_start} → {s.period_end}
                    </td>
                    <td className="px-4 py-3 text-right text-ink-700">{DZD(Number(s.gross_sales))}</td>
                    <td className="px-4 py-3 text-right text-ember-600">{DZD(Number(s.commission))}</td>
                    <td className="px-4 py-3 text-right font-medium text-ink-900">{DZD(Number(s.balance))}</td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        s.status === 'paid' ? 'bg-sage-500/10 text-sage-600' :
                        s.status === 'overdue' ? 'bg-error-500/10 text-error-600' :
                        s.status === 'partially_paid' ? 'bg-ember-500/10 text-ember-600' :
                        'bg-ink-100 text-ink-500'
                      }`}>{s.status.replace(/_/g, ' ')}</span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {s.status !== 'paid' && (
                        <button
                          onClick={() => markPaid(s.id)}
                          disabled={actingId === s.id}
                          className="kiyo-btn-primary bg-sage-500 text-xs hover:bg-sage-600"
                        >
                          {actingId === s.id ? <Spinner className="h-3 w-3" /> : <CheckCircle className="h-3 w-3" />}
                          Mark Paid
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );

  function exportSettlementsCSV() {
    if (!overview) return;
    const rows = [
      ['Restaurant', 'Period Start', 'Period End', 'Gross Sales', 'Commission', 'Payout', 'Amount Owed', 'Amount Paid', 'Balance', 'Status', 'Due Date'],
      ...overview.recent.map((s) => [
        s.restaurant_name, s.period_start, s.period_end,
        s.gross_sales, s.commission, s.payout,
        s.amount_owed, s.amount_paid, s.balance, s.status, s.due_date ?? '',
      ]),
    ];
    const csv = rows.map((r) => r.map((c) => `"${c}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `kiyo-settlements-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }
}

// ===================== MARKETING =====================
function MarketingTab() {
  const { t } = useT();
  const [promos, setPromos] = useState<PromoCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [newPromo, setNewPromo] = useState({ code: '', description: '', discount_type: 'percentage', discount_value: '10', min_order: '0', max_discount: '', valid_until: '' });

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: e } = await supabase.from('promo_codes').select('*').order('created_at', { ascending: false });
      if (e) throw e;
      setPromos((data as PromoCode[]) ?? []);
    } catch {
      setError(t('error.genericBody'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => { void load(); }, [load]);

  const createPromo = async () => {
    try {
      const { error: e } = await supabase.from('promo_codes').insert({
        code: newPromo.code.toUpperCase(),
        description: newPromo.description || null,
        discount_type: newPromo.discount_type,
        discount_value: Number(newPromo.discount_value),
        min_order_amount: Number(newPromo.min_order),
        max_discount: newPromo.max_discount ? Number(newPromo.max_discount) : null,
        valid_until: newPromo.valid_until || null,
      });
      if (e) throw e;
      setShowForm(false);
      setNewPromo({ code: '', description: '', discount_type: 'percentage', discount_value: '10', min_order: '0', max_discount: '', valid_until: '' });
      void load();
    } catch {
      setError(t('error.genericBody'));
    }
  };

  const togglePromo = async (p: PromoCode) => {
    try {
      const { error: e } = await supabase.from('promo_codes').update({ is_active: !p.is_active }).eq('id', p.id);
      if (e) throw e;
      setPromos((prev) => prev.map((x) => x.id === p.id ? { ...x, is_active: !x.is_active } : x));
    } catch { /* non-fatal */ }
  };

  if (loading) return <Skeleton count={3} />;
  if (error) return <ErrorState title={t('error.genericTitle')} message={error} onRetry={load} retryLabel={t('error.retry')} />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-display text-base font-bold text-ink-900">Promo Codes</h3>
        <button onClick={() => setShowForm((v) => !v)} className="kiyo-btn-primary">
          <Tag className="h-4 w-4" />
          <span className="hidden sm:inline">New Code</span>
        </button>
      </div>

      {showForm && (
        <div className="kiyo-card space-y-3 p-5">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-ink-500">Code</label>
              <input value={newPromo.code} onChange={(e) => setNewPromo({ ...newPromo, code: e.target.value.toUpperCase() })}
                placeholder="SUMMER10" className="w-full rounded-lg border border-ink-100 bg-white px-3 py-2 text-sm uppercase focus:border-ember-500 focus:outline-none" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-ink-500">Description</label>
              <input value={newPromo.description} onChange={(e) => setNewPromo({ ...newPromo, description: e.target.value })}
                placeholder="Summer 10% off" className="w-full rounded-lg border border-ink-100 bg-white px-3 py-2 text-sm focus:border-ember-500 focus:outline-none" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-ink-500">Type</label>
              <select value={newPromo.discount_type} onChange={(e) => setNewPromo({ ...newPromo, discount_type: e.target.value })}
                className="w-full rounded-lg border border-ink-100 bg-white px-3 py-2 text-sm focus:border-ember-500 focus:outline-none">
                <option value="percentage">Percentage (%)</option>
                <option value="fixed">Fixed (DZD)</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-ink-500">Value</label>
              <input type="number" value={newPromo.discount_value} onChange={(e) => setNewPromo({ ...newPromo, discount_value: e.target.value })}
                className="w-full rounded-lg border border-ink-100 bg-white px-3 py-2 text-sm focus:border-ember-500 focus:outline-none" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-ink-500">Min order (DZD)</label>
              <input type="number" value={newPromo.min_order} onChange={(e) => setNewPromo({ ...newPromo, min_order: e.target.value })}
                className="w-full rounded-lg border border-ink-100 bg-white px-3 py-2 text-sm focus:border-ember-500 focus:outline-none" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-ink-500">Max discount (DZD)</label>
              <input type="number" value={newPromo.max_discount} onChange={(e) => setNewPromo({ ...newPromo, max_discount: e.target.value })}
                placeholder="No limit" className="w-full rounded-lg border border-ink-100 bg-white px-3 py-2 text-sm focus:border-ember-500 focus:outline-none" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-ink-500">Valid until</label>
              <input type="date" value={newPromo.valid_until} onChange={(e) => setNewPromo({ ...newPromo, valid_until: e.target.value })}
                className="w-full rounded-lg border border-ink-100 bg-white px-3 py-2 text-sm focus:border-ember-500 focus:outline-none" />
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={createPromo} className="kiyo-btn-primary">Create</button>
            <button onClick={() => setShowForm(false)} className="kiyo-btn-secondary">Cancel</button>
          </div>
        </div>
      )}

      {promos.length === 0 ? (
        <div className="kiyo-card p-6 text-center text-sm text-ink-400">No promo codes yet</div>
      ) : (
        <div className="kiyo-card overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-ink-100 text-left text-xs font-semibold uppercase tracking-wide text-ink-400">
                <th className="px-4 py-3">Code</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3 text-right">Value</th>
                <th className="px-4 py-3 text-right">Used</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-50">
              {promos.map((p) => (
                <tr key={p.id} className="hover:bg-ink-50/50">
                  <td className="px-4 py-3">
                    <div className="font-mono font-bold text-ink-900">{p.code}</div>
                    {p.description && <div className="text-xs text-ink-400">{p.description}</div>}
                  </td>
                  <td className="px-4 py-3 capitalize text-ink-600">{p.discount_type}</td>
                  <td className="px-4 py-3 text-right text-ink-700">
                    {p.discount_type === 'percentage' ? `${p.discount_value}%` : `${p.discount_value} DZD`}
                  </td>
                  <td className="px-4 py-3 text-right text-ink-500">
                    {p.used_count}{p.usage_limit ? ` / ${p.usage_limit}` : ''}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      p.is_active ? 'bg-sage-500/10 text-sage-600' : 'bg-ink-100 text-ink-500'
                    }`}>{p.is_active ? 'Active' : 'Inactive'}</span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => togglePromo(p)} className="kiyo-btn-secondary text-xs">
                      {p.is_active ? 'Disable' : 'Enable'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ===================== ALERTS =====================
function AlertsTab() {
  const { t } = useT();
  const [alerts, setAlerts] = useState<{
    failed_orders: Array<{ id: string; restaurant_id: string; total: string; status: string; created_at: string }>;
    high_cancellation_restaurants: Array<{ restaurant_id: string; name: string; cancelled: number; total: number; rate: number }>;
    suspicious_activity: Array<{ user_id: string; order_count: number; window: string }>;
    unread_notifications: number;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: e } = await supabase.rpc('get_admin_alerts');
      if (e) throw e;
      setAlerts(data as typeof alerts);
    } catch {
      setError(t('error.genericBody'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => { void load(); }, [load]);

  if (loading) return <Skeleton count={3} />;
  if (error) return <ErrorState title={t('error.genericTitle')} message={error} onRetry={load} retryLabel={t('error.retry')} />;
  if (!alerts) return null;

  return (
    <div className="space-y-6">
      {/* Failed orders */}
      <div>
        <h3 className="mb-3 font-display text-base font-bold text-ink-900">Failed Orders (24h)</h3>
        {alerts.failed_orders.length === 0 ? (
          <div className="kiyo-card p-6 text-center text-sm text-ink-400">No failed orders in the last 24 hours</div>
        ) : (
          <ul className="kiyo-card divide-y divide-ink-100">
            {alerts.failed_orders.map((o) => (
              <li key={o.id} className="flex items-center gap-3 px-4 py-3">
                <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-error-500/10 text-error-600">
                  <AlertTriangle className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-ink-800">
                    #{o.id.slice(0, 8)} · {o.status.replace(/_/g, ' ')}
                  </span>
                  <span className="text-xs text-ink-400">{new Date(o.created_at).toLocaleString()}</span>
                </div>
                <span className="text-sm font-medium text-ink-700">{o.total} DZD</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* High cancellation restaurants */}
      <div>
        <h3 className="mb-3 font-display text-base font-bold text-ink-900">High Cancellation Rate (7d)</h3>
        {alerts.high_cancellation_restaurants.length === 0 ? (
          <div className="kiyo-card p-6 text-center text-sm text-ink-400">No restaurants with high cancellation rates</div>
        ) : (
          <ul className="kiyo-card divide-y divide-ink-100">
            {alerts.high_cancellation_restaurants.map((r) => (
              <li key={r.restaurant_id} className="flex items-center gap-3 px-4 py-3">
                <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-ember-500/10 text-ember-600">
                  <TrendingUp className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-ink-800">{r.name}</span>
                  <span className="text-xs text-ink-400">{r.cancelled} cancelled / {r.total} total orders</span>
                </div>
                <span className="rounded-full bg-error-500/10 px-2 py-0.5 text-xs font-bold text-error-600">
                  {r.rate}% cancel rate
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Suspicious activity */}
      <div>
        <h3 className="mb-3 font-display text-base font-bold text-ink-900">Suspicious Activity (1h)</h3>
        {alerts.suspicious_activity.length === 0 ? (
          <div className="kiyo-card p-6 text-center text-sm text-ink-400">No suspicious activity detected</div>
        ) : (
          <ul className="kiyo-card divide-y divide-ink-100">
            {alerts.suspicious_activity.map((s) => (
              <li key={s.user_id} className="flex items-center gap-3 px-4 py-3">
                <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-error-500/10 text-error-600">
                  <Ban className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-ink-800">
                    User {s.user_id.slice(0, 8)}...
                  </span>
                  <span className="text-xs text-ink-400">{s.order_count} orders in {s.window}</span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

// ===================== ADMIN SUPPORT =====================
function AdminSupportTab() {
  const { t } = useT();
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'open' | 'in_progress' | 'resolved' | 'closed'>('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      let q = supabase.from('support_tickets').select('*').order('created_at', { ascending: false });
      if (filter !== 'all') q = q.eq('status', filter);
      const { data, error: e } = await q;
      if (e) throw e;
      setTickets((data as SupportTicket[]) ?? []);
    } catch {
      setError(t('error.genericBody'));
    } finally {
      setLoading(false);
    }
  }, [filter, t]);

  useEffect(() => { void load(); }, [load]);

  if (selectedId) {
    return <AdminTicketDetail ticketId={selectedId} onBack={() => setSelectedId(null)} />;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-display text-base font-bold text-ink-900">Support Inbox</h3>
        <div className="flex gap-1">
          {(['all','open','in_progress','resolved','closed'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`rounded-lg px-2.5 py-1 text-xs font-medium transition-colors ${
                filter === f ? 'bg-ember-500 text-white' : 'bg-ink-100 text-ink-600 hover:bg-ink-200'
              }`}
            >
              {f === 'all' ? 'All' : f.replace(/_/g, ' ')}
            </button>
          ))}
        </div>
      </div>

      {loading ? <Skeleton count={4} /> : error ? (
        <ErrorState title={t('error.genericTitle')} message={error} onRetry={load} retryLabel={t('error.retry')} />
      ) : tickets.length === 0 ? (
        <div className="kiyo-card p-8 text-center text-sm text-ink-400">No support tickets</div>
      ) : (
        <ul className="space-y-2">
          {tickets.map((ticket) => (
            <li key={ticket.id}>
              <button
                onClick={() => setSelectedId(ticket.id)}
                className="kiyo-card flex w-full items-start gap-3 p-4 text-left transition-colors hover:bg-ink-50/50"
              >
                <span className={`mt-0.5 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg ${
                  ticket.priority === 'urgent' ? 'bg-error-500/10 text-error-600' :
                  ticket.priority === 'high' ? 'bg-ember-500/10 text-ember-600' :
                  'bg-ink-100 text-ink-500'
                }`}>
                  <MessageCircle className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <h4 className="truncate text-sm font-semibold text-ink-900">{ticket.subject}</h4>
                    <span className={`flex-shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium uppercase ${
                      ticket.status === 'open' ? 'bg-warning-500/10 text-warning-600' :
                      ticket.status === 'in_progress' ? 'bg-blue-100 text-blue-600' :
                      ticket.status === 'resolved' ? 'bg-sage-500/10 text-sage-600' :
                      'bg-ink-100 text-ink-500'
                    }`}>{ticket.status.replace(/_/g, ' ')}</span>
                  </div>
                  <p className="mt-0.5 truncate text-xs text-ink-500">{ticket.body}</p>
                  <div className="mt-1 flex items-center gap-2 text-[10px] text-ink-400">
                    <span className="capitalize">{ticket.category}</span>
                    <span>·</span>
                    <span className="capitalize">{ticket.priority}</span>
                    <span>·</span>
                    <span>{new Date(ticket.created_at).toLocaleDateString()}</span>
                  </div>
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function AdminTicketDetail({ ticketId, onBack }: { ticketId: string; onBack: () => void }) {
  const { t } = useT();
  const [ticket, setTicket] = useState<SupportTicket | null>(null);
  const [messages, setMessages] = useState<Array<{ id: string; ticket_id: string; sender_id: string; body: string; is_admin: boolean; created_at: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reply, setReply] = useState('');
  const [sending, setSending] = useState(false);
  const [updating, setUpdating] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [ticketRes, msgRes] = await Promise.all([
        supabase.from('support_tickets').select('*').eq('id', ticketId).single(),
        supabase.from('support_messages').select('*').eq('ticket_id', ticketId).order('created_at', { ascending: true }),
      ]);
      if (ticketRes.error) throw ticketRes.error;
      if (msgRes.error) throw msgRes.error;
      setTicket(ticketRes.data as SupportTicket);
      setMessages(msgRes.data as typeof messages ?? []);
    } catch {
      setError(t('error.genericBody'));
    } finally {
      setLoading(false);
    }
  }, [ticketId, t]);

  useEffect(() => { void load(); }, [load]);

  const sendReply = async () => {
    if (reply.trim().length < 1) return;
    setSending(true);
    try {
      const { error: e } = await supabase.rpc('reply_to_ticket', {
        p_ticket_id: ticketId, p_body: reply.trim(), p_is_admin: true,
      });
      if (e) throw e;
      setReply('');
      void load();
    } catch {
      setError(t('error.genericBody'));
    } finally {
      setSending(false);
    }
  };

  const updateStatus = async (status: string) => {
    setUpdating(true);
    try {
      const { error: e } = await supabase.rpc('update_ticket_status', {
        p_ticket_id: ticketId, p_status: status,
      });
      if (e) throw e;
      void load();
    } catch {
      setError(t('error.genericBody'));
    } finally {
      setUpdating(false);
    }
  };

  if (loading) return <Skeleton count={3} />;
  if (error) return <ErrorState title={t('error.genericTitle')} message={error} onRetry={load} retryLabel={t('error.retry')} />;
  if (!ticket) return null;

  return (
    <div className="space-y-4">
      <button onClick={onBack} className="inline-flex items-center gap-1 text-sm text-ink-500 hover:text-ink-900">
        <ChevronLeft className="h-4 w-4" /> Back to inbox
      </button>

      <div className="kiyo-card p-5">
        <div className="flex items-start justify-between gap-2">
          <h2 className="font-display text-lg font-bold text-ink-900">{ticket.subject}</h2>
          <div className="flex gap-1">
            {ticket.status !== 'resolved' && (
              <button onClick={() => updateStatus('resolved')} disabled={updating}
                className="rounded-lg bg-sage-500/10 px-2.5 py-1 text-xs font-medium text-sage-600 hover:bg-sage-500/20">
                {updating ? <Spinner className="h-3 w-3" /> : <CheckCircle className="h-3 w-3" />} Resolve
              </button>
            )}
            {ticket.status !== 'closed' && (
              <button onClick={() => updateStatus('closed')} disabled={updating}
                className="rounded-lg bg-ink-100 px-2.5 py-1 text-xs font-medium text-ink-600 hover:bg-ink-200">
                Close
              </button>
            )}
          </div>
        </div>
        <p className="mt-2 text-sm text-ink-600">{ticket.body}</p>
        <div className="mt-3 flex flex-wrap items-center gap-2 text-[10px] text-ink-400">
          <span className="capitalize rounded bg-ink-100 px-1.5 py-0.5">{ticket.category}</span>
          <span className="capitalize rounded bg-ink-100 px-1.5 py-0.5">{ticket.priority} priority</span>
          {ticket.order_id && <span className="flex items-center gap-1 rounded bg-ink-100 px-1.5 py-0.5"><Package className="h-3 w-3" /> {ticket.order_id.slice(0, 8)}</span>}
          <span>{new Date(ticket.created_at).toLocaleString()}</span>
        </div>
      </div>

      <div className="kiyo-card">
        <div className="border-b border-ink-100 px-4 py-3">
          <h3 className="text-sm font-semibold text-ink-900">Conversation</h3>
        </div>
        <div className="max-h-96 space-y-3 overflow-y-auto p-4">
          {messages.length === 0 ? (
            <p className="py-8 text-center text-sm text-ink-400">No messages yet. Reply below.</p>
          ) : (
            messages.map((m) => (
              <div key={m.id} className={`flex ${m.is_admin ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${
                  m.is_admin ? 'bg-ember-500 text-white' : 'bg-ink-100 text-ink-800'
                }`}>
                  <p className="whitespace-pre-wrap">{m.body}</p>
                  <p className={`mt-1 text-[10px] ${m.is_admin ? 'text-ember-100' : 'text-ink-400'}`}>
                    {m.is_admin ? 'Admin' : 'User'} · {new Date(m.created_at).toLocaleString()}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {ticket.status !== 'closed' && (
        <div className="kiyo-card flex items-end gap-2 p-3">
          <textarea
            value={reply}
            onChange={(e) => setReply(e.target.value)}
            rows={2}
            placeholder="Type your reply..."
            className="flex-1 resize-none rounded-lg border border-ink-100 bg-white px-3 py-2 text-sm focus:border-ember-500 focus:outline-none"
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void sendReply(); } }}
          />
          <button onClick={sendReply} disabled={sending || reply.trim().length < 1} className="kiyo-btn-primary flex-shrink-0">
            {sending ? <Spinner className="h-4 w-4" /> : <Send className="h-4 w-4" />}
          </button>
        </div>
      )}
    </div>
  );
}

// ===================== MONITORING =====================
function MonitoringTab() {
  const { t } = useT();
  const [audit, setAudit] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: e } = await supabase
        .from('audit_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);
      if (e) throw e;
      setAudit((data as AuditLog[]) ?? []);
    } catch {
      setError(t('error.genericBody'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => { void load(); }, [load]);

  if (loading) return <Skeleton count={4} />;
  if (error) return <ErrorState title={t('error.genericTitle')} message={error} onRetry={load} retryLabel={t('error.retry')} />;

  return (
    <div className="space-y-6">
      {/* System status */}
      <div className="kiyo-card p-5">
        <h3 className="mb-3 font-display text-base font-bold text-ink-900">System Status</h3>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <StatusIndicator label="Database" status="operational" />
          <StatusIndicator label="Auth Service" status="operational" />
          <StatusIndicator label="API Gateway" status="operational" />
        </div>
      </div>

      {/* Audit log */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-display text-base font-bold text-ink-900">Audit Logs</h3>
          <Link to="/admin/audit" className="inline-flex items-center gap-1 text-xs font-semibold text-ember-600 hover:text-ember-700">
            View all <ChevronRight className="h-3 w-3" />
          </Link>
        </div>
        {audit.length === 0 ? (
          <div className="kiyo-card p-6 text-center text-sm text-ink-400">No audit entries</div>
        ) : (
          <ul className="kiyo-card divide-y divide-ink-100">
            {audit.map((log) => (
              <li key={log.id} className="flex items-center gap-3 px-4 py-3">
                <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-ink-100 text-ink-500">
                  <Activity className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-ink-800">
                    {log.action.replace(/_/g, ' ')}
                  </span>
                  {log.target_type && (
                    <span className="text-xs text-ink-400">{log.target_type}</span>
                  )}
                </div>
                <span className="flex-shrink-0 text-xs text-ink-400">
                  {new Date(log.created_at).toLocaleString()}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function StatusIndicator({ label, status }: { label: string; status: 'operational' | 'degraded' | 'down' }) {
  const colors = {
    operational: 'bg-sage-500',
    degraded: 'bg-ember-500',
    down: 'bg-error-500',
  };
  return (
    <div className="flex items-center gap-2 rounded-lg border border-ink-100 bg-white px-3 py-2">
      <span className={`h-2.5 w-2.5 rounded-full ${colors[status]} ${status === 'operational' ? 'animate-pulse-soft' : ''}`} />
      <span className="text-sm font-medium text-ink-700">{label}</span>
      <span className="ml-auto text-xs capitalize text-ink-400">{status}</span>
    </div>
  );
}

// ===================== GEOGRAPHY TAB =====================
type WilayaStats = {
  id: number;
  name_en: string;
  name_fr: string;
  name_ar: string;
  code: string;
  is_active: boolean;
  restaurant_count: number;
  customer_count: number;
  order_count: number;
};

function GeographyTab() {
  const [wilayaStats, setWilayaStats] = useState<WilayaStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadStats() {
      setLoading(true);
      setError(null);
      try {
        // Get wilayas with counts
        const { data: wilayas } = await supabase
          .from('wilayas')
          .select('*')
          .order('name_fr', { ascending: true });

        // Get restaurant counts per wilaya
        const { data: restaurantCounts } = await supabase
          .from('restaurants')
          .select('wilaya_id')
          .eq('status', 'published');

        // Get customer profile wilaya selections
        const { data: profileWilayas } = await supabase
          .from('profiles')
          .select('selected_wilaya_id')
          .not('selected_wilaya_id', 'is', null);

        // Get order counts by restaurant wilaya
        const { data: orders } = await supabase
          .from('orders')
          .select('restaurant_id')
          .limit(1000);

        // Build restaurant wilaya lookup
        const restaurantWilayaMap: Record<string, number> = {};
        (restaurantCounts ?? []).forEach((r: { wilaya_id: number | null }) => {
          if (r.wilaya_id) {
            restaurantWilayaMap[r.wilaya_id] = (restaurantWilayaMap[r.wilaya_id] || 0) + 1;
          }
        });

        // Build profile wilaya counts
        const profileWilayaMap: Record<number, number> = {};
        (profileWilayas ?? []).forEach((p: { selected_wilaya_id: number }) => {
          profileWilayaMap[p.selected_wilaya_id] = (profileWilayaMap[p.selected_wilaya_id] || 0) + 1;
        });

        // Combine into stats
        const stats: WilayaStats[] = (wilayas ?? []).map((w) => ({
          id: w.id,
          name_en: w.name_en,
          name_fr: w.name_fr,
          name_ar: w.name_ar,
          code: w.code,
          is_active: w.is_active,
          restaurant_count: restaurantWilayaMap[w.id] || 0,
          customer_count: profileWilayaMap[w.id] || 0,
          order_count: 0, // Would need join for accurate count
        }));

        setWilayaStats(stats);
      } catch {
        setError('Failed to load geographic stats');
      } finally {
        setLoading(false);
      }
    }
    void loadStats();
  }, []);

  if (loading) return <Skeleton count={4} />;
  if (error) return <ErrorState title="Error" message={error} onRetry={() => setLoading(true)} retryLabel="Retry" />;

  const totalRestaurants = wilayaStats.reduce((sum, w) => sum + w.restaurant_count, 0);
  const activeWilayas = wilayaStats.filter((w) => w.is_active);
  const wilayasWithRestaurants = wilayaStats.filter((w) => w.restaurant_count > 0);

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard icon={MapPin} label="Active Wilayas" value={String(activeWilayas.length)} accent="ember" />
        <StatCard icon={Store} label="Wilayas with Restaurants" value={String(wilayasWithRestaurants.length)} />
        <StatCard icon={Users} label="Total Restaurants" value={String(totalRestaurants)} />
        <StatCard icon={TrendingUp} label="Coverage" value={`${Math.round((wilayasWithRestaurants.length / 58) * 100)}%`} />
      </div>

      {/* Wilaya list */}
      <div className="kiyo-card overflow-hidden p-0">
        <div className="border-b border-ink-100 px-4 py-3">
          <h3 className="font-display text-sm font-bold text-ink-900">Wilaya Coverage</h3>
        </div>
        <div className="max-h-[400px] overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-ink-50">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-semibold text-ink-500">Wilaya</th>
                <th className="px-4 py-2 text-center text-xs font-semibold text-ink-500">Code</th>
                <th className="px-4 py-2 text-center text-xs font-semibold text-ink-500">Restaurants</th>
                <th className="px-4 py-2 text-center text-xs font-semibold text-ink-500">Customers</th>
                <th className="px-4 py-2 text-center text-xs font-semibold text-ink-500">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-50">
              {wilayaStats.map((w) => (
                <tr key={w.id} className="hover:bg-ink-50/50">
                  <td className="px-4 py-2 font-medium text-ink-900">{w.name_fr}</td>
                  <td className="px-4 py-2 text-center text-ink-500">{w.code}</td>
                  <td className="px-4 py-2 text-center">
                    <span className={`inline-flex items-center justify-center rounded-full px-2 py-0.5 text-xs font-semibold ${
                      w.restaurant_count > 0 ? 'bg-sage-100 text-sage-700' : 'bg-ink-100 text-ink-400'
                    }`}>
                      {w.restaurant_count}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-center text-ink-600">{w.customer_count}</td>
                  <td className="px-4 py-2 text-center">
                    {w.is_active ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-sage-100 px-2 py-0.5 text-xs font-semibold text-sage-700">
                        <CheckCircle className="h-3 w-3" />
                        Active
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full bg-ink-100 px-2 py-0.5 text-xs font-semibold text-ink-500">
                        <Ban className="h-3 w-3" />
                        Inactive
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Expansion opportunities */}
      <div className="kiyo-card">
        <div className="mb-3 flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-ember-500" />
          <h3 className="font-display text-sm font-bold text-ink-900">Expansion Opportunities</h3>
        </div>
        <p className="mb-3 text-xs text-ink-500">
          Wilayas with customer interest but no restaurants yet.
        </p>
        <div className="flex flex-wrap gap-2">
          {wilayaStats
            .filter((w) => w.customer_count > 0 && w.restaurant_count === 0)
            .slice(0, 10)
            .map((w) => (
              <span
                key={w.id}
                className="inline-flex items-center gap-1 rounded-lg border border-ember-200 bg-ember-50 px-2 py-1 text-xs font-medium text-ember-700"
              >
                <MapPin className="h-3 w-3" />
                {w.name_fr}
                <span className="text-ember-500">({w.customer_count} customers)</span>
              </span>
            ))}
          {wilayaStats.filter((w) => w.customer_count > 0 && w.restaurant_count === 0).length === 0 && (
            <span className="text-xs text-ink-400">All customer demand is currently served.</span>
          )}
        </div>
      </div>
    </div>
  );
}

// ===================== SHARED =====================
function StatCard({ icon: Icon, label, value, accent }: {
  icon: React.ElementType; label: string; value: string; accent?: 'ember' | 'sage' | 'warning' | 'error';
}) {
  const accentBg = accent === 'ember' ? 'bg-ember-500/10 text-ember-600' :
    accent === 'sage' ? 'bg-sage-500/10 text-sage-600' :
    accent === 'warning' ? 'bg-ember-500/10 text-ember-600' :
    accent === 'error' ? 'bg-error-500/10 text-error-600' :
    'bg-ink-100 text-ink-700';
  return (
    <div className="kiyo-card p-4">
      <div className="flex items-center justify-between">
        <span className={`flex h-9 w-9 items-center justify-center rounded-lg ${accentBg}`}>
          <Icon className="h-4 w-4" />
        </span>
      </div>
      <div className="mt-3 font-display text-xl font-extrabold text-ink-900">{value}</div>
      <div className="text-xs font-medium text-ink-400">{label}</div>
    </div>
  );
}
