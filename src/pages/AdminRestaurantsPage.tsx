import { useCallback, useEffect, useState } from 'react';
import { Store, X, ChevronLeft, Plus } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useT } from '../lib/i18n-react';
import { supabase, type Restaurant } from '../lib/supabase';
import { callAdminAction } from '../lib/adminApi';
import { AppShell } from '../components/AppShell';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { Skeleton, ErrorState, Spinner } from '../components/feedback';
import { RestaurantImage } from '../components/ui';
import { RestaurantApplicationsPanel } from '../components/RestaurantApplicationsPanel';
import { userFacingError } from '../lib/userFacingError';

export default function AdminRestaurantsPage() {
  const { t, locale } = useT();
  const [pending, setPending] = useState<Restaurant[]>([]);
  const [active, setActive] = useState<Restaurant[]>([]);
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
      const list = (data as Restaurant[]) ?? [];
      setActive(list.filter((r) => r.status === 'published'));
      setPending(list.filter((r) => r.status !== 'published' && r.status !== 'suspended'));
    } catch (err: unknown) {
      console.error(err);
      setError(userFacingError(err, locale, t('error.genericBody')));
    } finally {
      setLoading(false);
    }
  }, [locale, t]);

  useEffect(() => { void load(); }, [load]);

  const reject = async (id: string) => {
    setActingId(id);
    setError(null);
    try {
      const { error: e } = await callAdminAction('set_restaurant_status', {
        p_restaurant_id: id, p_status: 'suspended',
      });
      if (e) throw e;
      setPending((prev) => prev.filter((r) => r.id !== id));
    } catch (err) {
      setError(userFacingError(err, locale, t('error.genericBody')));
    } finally {
      setActingId(null);
    }
  };

  return (
    <AppShell>
      <button
        onClick={() => window.history.back()}
        className="mb-3 inline-flex items-center gap-1 text-xs font-semibold text-ink-500 hover:text-ink-900"
      >
        <ChevronLeft className="h-4 w-4" />
        {t('common.back')}
      </button>

      <div className="mb-6 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-ink-900 text-white">
            <Store className="h-5 w-5" />
          </span>
          <div>
            <h1 className="font-display text-xl font-extrabold tracking-tight text-ink-900">
              {t('admin.restaurantsManagement')}
            </h1>
            <p className="text-xs text-ink-400">
              {pending.length} {t('admin.pendingApproval').toLowerCase()} · {active.length} {t('admin.liveRestaurants')}
            </p>
          </div>
        </div>
        <Link to="/restaurant/onboarding" className="kiyo-btn-primary">
          <Plus className="h-4 w-4" />
          <span className="hidden sm:inline">{t('restaurant.openRestaurant')}</span>
        </Link>
      </div>

      <ErrorBoundary variant="inline">
        <div className="mb-8">
          <RestaurantApplicationsPanel />
        </div>
        {loading ? (
          <Skeleton count={3} />
        ) : error ? (
          <ErrorState
            title={t('error.genericTitle')} message={error}
            onRetry={load} retryLabel={t('error.retry')}
          />
        ) : (
          <>
            <section className="mb-6">
              <h2 className="mb-2 font-display text-base font-bold text-ink-900">
                {t('admin.pendingApproval')}
              </h2>
              {pending.length === 0 ? (
                <div className="kiyo-card p-8 text-center text-sm text-ink-400">
                  {t('admin.noPending')}
                </div>
              ) : (
                <div className="space-y-3">
                  {pending.map((r) => (
                    <div key={r.id} className="kiyo-card flex items-center gap-3 p-3">
                      <div className="h-14 w-14 flex-shrink-0 overflow-hidden rounded-lg">
                        <RestaurantImage url={r.image_url} name={r.name} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <h3 className="font-display text-sm font-bold text-ink-900">{r.name}</h3>
                        {r.cuisine && r.cuisine.length > 0 && (
                          <p className="text-xs text-ink-400">{r.cuisine.join(' · ')}</p>
                        )}
                        {r.address && <p className="text-xs text-ink-400">{r.address}</p>}
                      </div>
                      {!r.source_application_id && <div className="flex flex-col items-end gap-2">
                        <span className="max-w-52 text-right text-xs font-medium text-warning-700">{t('admin.applicationRequired')}</span>
                        <button
                          onClick={() => reject(r.id)} disabled={actingId === r.id}
                          className="kiyo-btn-secondary border-error-500/30 text-error-600 hover:bg-error-500/10"
                        >
                          {actingId === r.id ? <Spinner className="h-4 w-4" /> : <X className="h-4 w-4" />}
                          <span className="hidden sm:inline">{t('admin.reject')}</span>
                        </button>
                      </div>}
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section>
              <h2 className="mb-2 font-display text-base font-bold text-ink-900">
                {t('market.browse')}
              </h2>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {active.map((r) => (
                  <div key={r.id} className="kiyo-card flex items-center gap-3 p-3">
                    <div className="h-10 w-10 flex-shrink-0 overflow-hidden rounded-lg">
                      <RestaurantImage url={r.image_url} name={r.name} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="truncate font-display text-sm font-bold text-ink-900">{r.name}</h3>
                      {r.cuisine && <p className="truncate text-xs text-ink-400">{r.cuisine[0]}</p>}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </>
        )}
      </ErrorBoundary>
    </AppShell>
  );
}
