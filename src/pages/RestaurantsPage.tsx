import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Search, Star, Clock, MapPin } from 'lucide-react';
import { useT } from '../lib/i18n-react';
import { supabase, type Restaurant } from '../lib/supabase';
import { useWilaya, getWilayaName } from '../context/WilayaContext';
import { AppShell } from '../components/AppShell';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { ErrorState } from '../components/feedback';
import { RestaurantImage } from '../components/ui';
import { haversineKm, formatDistanceKm } from '../lib/geo';

type RestaurantWithDistance = Restaurant & {
  distance_km?: number | null;
};

export default function RestaurantsPage() {
  const { t } = useT();
  const { selectedWilaya, deliveryLocation, loading: wilayaLoading, locale } = useWilaya();
  const [items, setItems] = useState<RestaurantWithDistance[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<'all' | 'open' | 'top'>('all');
  const currentLocation = useMemo(() => deliveryLocation
    ? { lat: deliveryLocation.lat, lng: deliveryLocation.lng }
    : null, [deliveryLocation]);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      let q = supabase
        .from('restaurants')
        .select('*')
        .eq('status', 'published');

      if (selectedWilaya) {
        q = q.eq('wilaya_id', selectedWilaya.id);
      }

      const { data, error: e } = await q.order('rating', { ascending: false }).limit(50);
      if (e) throw e;
      const restaurants = ((data as RestaurantWithDistance[]) ?? []).map((restaurant) => ({
        ...restaurant,
        distance_km: currentLocation && restaurant.latitude != null && restaurant.longitude != null
          ? haversineKm(currentLocation, { lat: restaurant.latitude, lng: restaurant.longitude })
          : null,
      }));
      setItems(restaurants);
    } catch (err: unknown) {
      console.error(err);
      setError(t('error.genericBody'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!wilayaLoading) {
      void load();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedWilaya?.id, wilayaLoading, currentLocation?.lat, currentLocation?.lng]);

  const filtered = useMemo(() => {
    let list = items;
    if (filter === 'open') list = list.filter((r) => r.operational_status === 'open');
    if (filter === 'top') list = list.filter((r) => r.rating >= 4).sort((a, b) => b.rating - a.rating);
    if (currentLocation) {
      list = [...list].sort((a, b) => (a.distance_km ?? Number.MAX_VALUE) - (b.distance_km ?? Number.MAX_VALUE));
    }
    if (query.trim()) {
      const q = query.toLowerCase();
      list = list.filter(
        (r) =>
          r.name.toLowerCase().includes(q) ||
          (r.cuisine ?? []).some((c) => c.toLowerCase().includes(q)),
      );
    }
    return list;
  }, [items, filter, query, currentLocation]);

  return (
    <AppShell>
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-extrabold tracking-tight text-ink-900 sm:text-3xl">
            {t('market.browse')}
          </h1>
          <p className="mt-1 text-sm text-ink-500">
            {selectedWilaya ? getWilayaName(selectedWilaya, locale) : t('brand.areaServed')}
          </p>
        </div>
      </div>

      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('market.searchPlaceholder')}
            className="kiyo-input pl-10"
            aria-label={t('market.searchPlaceholder')}
          />
        </div>
        <div className="flex gap-2">
          {[
            { id: 'all', label: t('nav.restaurants') },
            { id: 'open', label: t('market.openNow') },
            { id: 'top', label: t('market.topRated') },
          ].map((f) => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id as typeof filter)}
              className={`rounded-lg px-3 py-2 text-xs font-semibold transition-colors ${
                filter === f.id ? 'bg-ink-900 text-white' : 'bg-white text-ink-600 hover:bg-ink-100'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <ErrorBoundary variant="inline">
        {loading ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="kiyo-card overflow-hidden">
                <div className="kiyo-skeleton h-36 w-full rounded-none" />
                <div className="p-4">
                  <SkeletonLine w="w-2/3" />
                  <SkeletonLine w="w-1/3" h="h-3" />
                </div>
              </div>
            ))}
          </div>
        ) : error ? (
          <ErrorState
            title={t('error.genericTitle')}
            message={error}
            onRetry={load}
            retryLabel={t('error.retry')}
          />
        ) : filtered.length === 0 ? (
          <div className="kiyo-card flex flex-col items-center gap-2 p-10 text-center">
            <MapPin className="h-8 w-8 text-ink-300" />
            <p className="text-sm text-ink-500">{t('market.empty')}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((r) => (
              <Link
                key={r.id}
                to={`/restaurant/${r.id}`}
                className="kiyo-card group block overflow-hidden transition-shadow hover:shadow-card-lg"
              >
                <div className="relative h-36 overflow-hidden">
                  <RestaurantImage url={r.image_url} name={r.name} className="transition-transform duration-500 group-hover:scale-105" />
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent p-3">
                    <div className="flex items-center gap-2">
                      <StatusChip status={r.operational_status} />
                      {r.estimated_delivery_min && (
                        <span className="flex items-center gap-1 rounded-full bg-white/20 px-2 py-0.5 text-[10px] font-semibold text-white backdrop-blur">
                          <Clock className="h-3 w-3" />
                          {r.estimated_delivery_min}m
                        </span>
                      )}
                      {r.distance_km != null && (
                        <span className="flex items-center gap-1 rounded-full bg-white/20 px-2 py-0.5 text-[10px] font-semibold text-white backdrop-blur">
                          <MapPin className="h-3 w-3" />
                          {formatDistanceKm(r.distance_km)}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-display text-base font-bold text-ink-900">{r.name}</h3>
                    {r.rating > 0 && (
                      <span className="flex items-center gap-0.5 text-xs font-semibold text-ink-700">
                        <Star className="h-3 w-3 fill-ember-500 text-ember-500" />
                        {Number(r.rating).toFixed(1)}
                      </span>
                    )}
                  </div>
                  {r.cuisine && r.cuisine.length > 0 && (
                    <p className="mt-1 text-xs text-ink-400">{r.cuisine.slice(0, 3).join(' / ')}</p>
                  )}
                  {r.description && (
                    <p className="mt-2 line-clamp-2 text-sm text-ink-500">{r.description}</p>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}
      </ErrorBoundary>
    </AppShell>
  );
}

function StatusChip({ status }: { status: Restaurant['operational_status'] }) {
  const { t } = useT();
  if (status === 'open') {
    return (
      <span className="rounded-full bg-sage-500/90 px-2 py-0.5 text-[10px] font-semibold text-white backdrop-blur">
        {t('restaurant.open')}
      </span>
    );
  }
  if (status === 'busy') {
    return (
      <span className="rounded-full bg-warning-500/90 px-2 py-0.5 text-[10px] font-semibold text-white backdrop-blur">
        {t('restaurant.busy')}
      </span>
    );
  }
  return (
    <span className="rounded-full bg-ink-900/80 px-2 py-0.5 text-[10px] font-semibold text-white backdrop-blur">
      {t('restaurant.closed')}
    </span>
  );
}

function SkeletonLine({ w = 'w-full', h = 'h-4' }: { w?: string; h?: string }) {
  return <div className={`kiyo-skeleton ${w} ${h}`} />;
}
