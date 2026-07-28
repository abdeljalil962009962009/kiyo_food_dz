import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Search, Star, Clock, MapPin, BadgeCheck, Sparkles } from 'lucide-react';
import { useT } from '../lib/i18n-react';
import { supabase, type Restaurant, type RestaurantSpecialHours } from '../lib/supabase';
import { useWilaya, getWilayaName } from '../context/WilayaContext';
import { AppShell } from '../components/AppShell';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { ErrorState, PremiumEmptyState, Spinner } from '../components/feedback';
import { RestaurantImage } from '../components/ui';
import { haversineKm } from '../lib/geo';
import { withExponentialBackoff } from '../lib/locationNetwork';
import { useRealtime } from '../lib/useRealtime';
import { sanitizeMarketplaceSearchTerm, scoreMarketplaceRestaurant } from '../lib/marketplaceSearch';
import { userFacingError } from '../lib/userFacingError';
import { algeriaAvailabilityDateRange, restaurantAcceptsOrders } from '../lib/restaurantAvailability';

type RestaurantWithDistance = Restaurant & {
  distance_km?: number | null;
  special_hours?: RestaurantSpecialHours[];
};

type MenuSearchMatch = {
  restaurant_id: string;
  name: string;
  price: string;
};

const pageCopy = {
  en: {
    trustAvailability: 'Availability checked before checkout',
    trustPricing: 'Road-route delivery pricing',
    trustCod: 'Cash on Delivery, no surprise card charge',
    emptyTitle: 'No matching restaurants yet',
    emptyBody: 'Try another search, clear the filter, or adjust your delivery location. Kiyo Food only shows restaurants that are actually published for your area.',
    clearSearch: 'Clear search',
    showAll: 'Show all restaurants',
    verified: 'Verified by Kiyo Food',
    preparation: 'Prep. ~{minutes} min',
    reviews: '{count} reviews',
    dishMatch: 'Matches dish: {dish} · {price} DZD',
    searchDelayed: 'Dish search is delayed. Restaurant search still works.',
    retryDishSearch: 'Retry dish search',
    searchingMenu: 'Searching restaurants and dishes',
  },
  fr: {
    trustAvailability: 'Disponibilité vérifiée avant la commande',
    trustPricing: 'Prix de livraison selon le trajet routier',
    trustCod: 'Paiement à la livraison, sans débit de carte',
    emptyTitle: 'Aucun restaurant correspondant',
    emptyBody: 'Essayez une autre recherche, retirez le filtre ou ajustez votre adresse. Kiyo Food affiche uniquement les restaurants réellement publiés pour votre zone.',
    clearSearch: 'Effacer la recherche',
    showAll: 'Voir tous les restaurants',
    verified: 'Vérifié par Kiyo Food',
    preparation: 'Préparation ~{minutes} min',
    reviews: '{count} avis',
    dishMatch: 'Plat correspondant : {dish} · {price} DZD',
    searchDelayed: 'La recherche de plats est retardée. La recherche de restaurants reste disponible.',
    retryDishSearch: 'Relancer la recherche de plats',
    searchingMenu: 'Recherche dans les restaurants et les plats',
  },
  ar: {
    trustAvailability: 'يتم التحقق من التوفر قبل تأكيد الطلب',
    trustPricing: 'تسعير التوصيل حسب الطريق الحقيقي',
    trustCod: 'الدفع عند التوصيل بدون مفاجآت',
    emptyTitle: 'لا توجد مطاعم مطابقة حالياً',
    emptyBody: 'جرّب بحثاً آخر، أزل الفلتر أو عدّل عنوان التوصيل. كيو فود يعرض فقط المطاعم المنشورة فعلاً في منطقتك.',
    clearSearch: 'مسح البحث',
    showAll: 'عرض كل المطاعم',
    verified: 'موثّق من كيو فود',
    preparation: 'التحضير نحو {minutes} د',
    reviews: '{count} تقييم',
    dishMatch: 'طبق مطابق: {dish} · {price} دج',
    searchDelayed: 'البحث عن الأطباق متأخر. لا يزال البحث عن المطاعم متاحاً.',
    retryDishSearch: 'إعادة البحث عن الأطباق',
    searchingMenu: 'جارٍ البحث في المطاعم والأطباق',
  },
} as const;

const correctedPageCopy = {
  en: {
    trustAvailability: 'Availability checked before checkout',
    trustPricing: 'Road-route delivery pricing',
    trustCod: 'Cash on Delivery, no surprise card charge',
    emptyTitle: 'No matching restaurants yet',
    emptyBody: 'Try another search, clear the filter, or adjust your delivery location. Kiyo Food only shows restaurants that are actually published for your area.',
    clearSearch: 'Clear search',
    showAll: 'Show all restaurants',
    verified: 'Verified by Kiyo Food',
    preparation: 'Prep. ~{minutes} min',
    reviews: '{count} reviews',
    dishMatch: 'Matches dish: {dish} · {price} DZD',
    searchDelayed: 'Dish search is delayed. Restaurant search still works.',
    retryDishSearch: 'Retry dish search',
    searchingMenu: 'Searching restaurants and dishes',
    exclusive: 'Only on Kiyo Food',
    exclusiveFilter: 'Only on Kiyo',
    fairCommission: 'Fair commission, fair prices',
  },
  fr: {
    trustAvailability: 'Disponibilité vérifiée avant la commande',
    trustPricing: 'Prix de livraison selon le trajet routier',
    trustCod: 'Paiement à la livraison, sans débit de carte',
    emptyTitle: 'Aucun restaurant correspondant',
    emptyBody: 'Essayez une autre recherche, retirez le filtre ou ajustez votre adresse. Kiyo Food affiche uniquement les restaurants réellement publiés pour votre zone.',
    clearSearch: 'Effacer la recherche',
    showAll: 'Voir tous les restaurants',
    verified: 'Vérifié par Kiyo Food',
    preparation: 'Préparation ~{minutes} min',
    reviews: '{count} avis',
    dishMatch: 'Plat correspondant : {dish} · {price} DZD',
    searchDelayed: 'La recherche de plats est retardée. La recherche de restaurants reste disponible.',
    retryDishSearch: 'Relancer la recherche de plats',
    searchingMenu: 'Recherche dans les restaurants et les plats',
    exclusive: 'Seulement sur Kiyo Food',
    exclusiveFilter: 'Exclusifs Kiyo',
    fairCommission: 'Commission équitable, prix plus justes',
  },
  ar: {
    trustAvailability: 'يتم التحقق من التوفر قبل تأكيد الطلب',
    trustPricing: 'تسعير التوصيل حسب الطريق الحقيقي',
    trustCod: 'الدفع عند التوصيل بدون مفاجآت',
    emptyTitle: 'لا توجد مطاعم مطابقة حاليا',
    emptyBody: 'جرّب بحثا آخر، أزل الفلتر أو عدّل عنوان التوصيل. كيو فود يعرض فقط المطاعم المنشورة فعلا في منطقتك.',
    clearSearch: 'مسح البحث',
    showAll: 'عرض كل المطاعم',
    verified: 'موثّق من كيو فود',
    preparation: 'التحضير نحو {minutes} د',
    reviews: '{count} تقييم',
    dishMatch: 'طبق مطابق: {dish} · {price} دج',
    searchDelayed: 'البحث عن الأطباق متأخر. لا يزال البحث عن المطاعم متاحا.',
    retryDishSearch: 'إعادة البحث عن الأطباق',
    searchingMenu: 'جار البحث في المطاعم والأطباق',
    exclusive: 'حصري على كيو فود',
    exclusiveFilter: 'حصري على كيو',
    fairCommission: 'عمولة عادلة، أسعار أعدل',
  },
} as const;

export default function RestaurantsPage() {
  const { t } = useT();
  const { selectedWilaya, deliveryLocation, loading: wilayaLoading, locale } = useWilaya();
  const tx = { ...pageCopy[locale], ...correctedPageCopy[locale] };
  const [items, setItems] = useState<RestaurantWithDistance[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<'all' | 'open' | 'top' | 'exclusive'>('all');
  const [menuMatches, setMenuMatches] = useState<Map<string, MenuSearchMatch>>(new Map());
  const [menuSearchLoading, setMenuSearchLoading] = useState(false);
  const [menuSearchError, setMenuSearchError] = useState<string | null>(null);
  const [menuSearchRetry, setMenuSearchRetry] = useState(0);
  const [availabilityClock, setAvailabilityClock] = useState(() => new Date());
  const currentLocation = useMemo(() => deliveryLocation
    ? { lat: deliveryLocation.lat, lng: deliveryLocation.lng }
    : null, [deliveryLocation]);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await withExponentialBackoff(async () => {
        let q = supabase
          .from('restaurants')
          .select('*')
          .eq('status', 'published');

        if (selectedWilaya) {
          q = q.eq('wilaya_id', selectedWilaya.id);
        }

        const result = await q.order('rating', { ascending: false }).limit(50);
        if (result.error) throw result.error;
        return result;
      }, { attempts: 3, timeoutMs: 16_000 });

      const restaurants = ((data as RestaurantWithDistance[]) ?? []).map((restaurant) => ({
        ...restaurant,
        distance_km: currentLocation && restaurant.latitude != null && restaurant.longitude != null
          ? haversineKm(currentLocation, { lat: restaurant.latitude, lng: restaurant.longitude })
          : null,
      }));
      const specialByRestaurant = new Map<string, RestaurantSpecialHours[]>();
      if (restaurants.length > 0) {
        const range = algeriaAvailabilityDateRange();
        const specialResult = await supabase
          .from('restaurant_special_hours')
          .select('*')
          .in('restaurant_id', restaurants.map((restaurant) => restaurant.id))
          .gte('date', range.from)
          .lte('date', range.to);
        if (specialResult.error) throw specialResult.error;
        for (const entry of (specialResult.data as RestaurantSpecialHours[] | null) ?? []) {
          const current = specialByRestaurant.get(entry.restaurant_id) ?? [];
          current.push(entry);
          specialByRestaurant.set(entry.restaurant_id, current);
        }
      }
      setItems(restaurants.map((restaurant) => ({
        ...restaurant,
        special_hours: specialByRestaurant.get(restaurant.id) ?? [],
      })));
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

  useRealtime('restaurants', (payload) => {
    const changed = payload.new as Partial<RestaurantWithDistance>;
    const previousId = String(payload.old?.id ?? '');
    const changedId = String(changed.id ?? previousId);
    if (!changedId) return;

    if (payload.eventType === 'DELETE' || changed.status !== 'published') {
      setItems((current) => current.filter((restaurant) => restaurant.id !== changedId));
      return;
    }

    if (
      payload.eventType === 'INSERT'
      || (payload.eventType === 'UPDATE' && payload.old?.status !== 'published')
    ) {
      void load();
      return;
    }

    setItems((current) => {
      const existing = current.find((restaurant) => restaurant.id === changedId);
      if (!existing) return current;
      return current.map((restaurant) => restaurant.id === changedId
        ? { ...restaurant, ...changed }
        : restaurant);
    });
  }, {
    enabled: Boolean(selectedWilaya?.id),
    filter: selectedWilaya?.id ? { wilaya_id: `eq.${selectedWilaya.id}` } : undefined,
  });

  useRealtime('restaurant_special_hours', () => {
    void load();
  }, { enabled: Boolean(selectedWilaya?.id) });

  useEffect(() => {
    const timer = window.setInterval(() => setAvailabilityClock(new Date()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const term = sanitizeMarketplaceSearchTerm(query);
    if (term.length < 2) {
      setMenuMatches(new Map());
      setMenuSearchLoading(false);
      setMenuSearchError(null);
      return;
    }

    const controller = new AbortController();
    setMenuSearchLoading(true);
    setMenuSearchError(null);
    const timer = window.setTimeout(() => {
      void withExponentialBackoff(async () => {
        const pattern = `%${term}%`;
        const result = await supabase
          .from('menu_items')
          .select('restaurant_id,name,price')
          .eq('is_available', true)
          .or(`name.ilike.${pattern},description.ilike.${pattern}`)
          .limit(40)
          .abortSignal(controller.signal);
        if (result.error) throw result.error;
        return (result.data as MenuSearchMatch[] | null) ?? [];
      }, {
        attempts: 2,
        timeoutMs: 12_000,
        shouldRetry: (searchError) => !(searchError instanceof DOMException && searchError.name === 'AbortError'),
      })
        .then((matches) => {
          if (controller.signal.aborted) return;
          const bestByRestaurant = new Map<string, MenuSearchMatch>();
          for (const match of matches) {
            if (!bestByRestaurant.has(match.restaurant_id)) {
              bestByRestaurant.set(match.restaurant_id, match);
            }
          }
          setMenuMatches(bestByRestaurant);
        })
        .catch((searchError: unknown) => {
          if (controller.signal.aborted) return;
          console.error('[Kiyo] Dish search failed:', searchError);
          setMenuMatches(new Map());
          setMenuSearchError(userFacingError(searchError, locale, tx.searchDelayed));
        })
        .finally(() => {
          if (!controller.signal.aborted) setMenuSearchLoading(false);
        });
    }, 300);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [locale, menuSearchRetry, query, tx.searchDelayed]);

  const filtered = useMemo(() => {
    let list = items;
    if (filter === 'open') {
      list = list.filter((restaurant) =>
        restaurantAcceptsOrders(restaurant, restaurant.special_hours, availabilityClock));
    }
    if (filter === 'top') list = list.filter((r) => r.rating >= 4).sort((a, b) => b.rating - a.rating);
    if (filter === 'exclusive') list = list.filter((r) => r.is_exclusive_to_kiyo);
    if (currentLocation) {
      list = [...list].sort((a, b) => (a.distance_km ?? Number.MAX_VALUE) - (b.distance_km ?? Number.MAX_VALUE));
    }
    if (query.trim()) {
      list = list
        .map((restaurant) => ({
          restaurant,
          score: scoreMarketplaceRestaurant(
            restaurant,
            query,
            menuMatches.get(restaurant.id)?.name,
          ),
        }))
        .filter(({ score }) => score > 0)
        .sort((a, b) => b.score - a.score)
        .map(({ restaurant }) => restaurant);
    }
    return list;
  }, [items, filter, query, currentLocation, menuMatches, availabilityClock]);

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
          <Search
            className={`pointer-events-none absolute top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400 ${locale === 'ar' ? 'right-3' : 'left-3'}`}
          />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('market.searchPlaceholder')}
            className={`kiyo-input ${locale === 'ar' ? 'pr-10' : 'pl-10'}`}
            aria-label={t('market.searchPlaceholder')}
          />
          {menuSearchLoading && (
            <span
              className="pointer-events-none absolute top-1/2 -translate-y-1/2 text-ember-600"
              style={{ insetInlineEnd: '0.75rem' }}
              role="status"
              aria-label={tx.searchingMenu}
            >
              <Spinner className="h-4 w-4" />
            </span>
          )}
        </div>
        <div className="flex gap-2">
          {[
            { id: 'all', label: t('nav.restaurants') },
            { id: 'open', label: t('market.openNow') },
            { id: 'top', label: t('market.topRated') },
            { id: 'exclusive', label: tx.exclusiveFilter },
          ].map((f) => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id as typeof filter)}
              className={`min-h-11 rounded-lg px-3 py-2 text-xs font-semibold transition-colors ${
                filter === f.id ? 'bg-ink-900 text-white' : 'bg-white text-ink-600 hover:bg-ink-100'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {menuSearchError && query.trim().length >= 2 && (
        <div
          className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-warning-200 bg-warning-50 px-3 py-2 text-xs text-warning-800"
          role="status"
        >
          <span>{menuSearchError}</span>
          <button
            type="button"
            className="min-h-11 font-bold underline underline-offset-2"
            onClick={() => setMenuSearchRetry((value) => value + 1)}
          >
            {tx.retryDishSearch}
          </button>
        </div>
      )}

      <div className="mb-5 grid gap-2 text-xs font-semibold text-ink-600 sm:grid-cols-3">
        <TrustPill icon={<Clock className="h-4 w-4" />} label={tx.trustAvailability} />
        <TrustPill icon={<MapPin className="h-4 w-4" />} label={tx.trustPricing} />
        <TrustPill icon={<Star className="h-4 w-4" />} label={tx.trustCod} />
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
        ) : menuSearchLoading && filtered.length === 0 && query.trim().length >= 2 ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3" aria-label={tx.searchingMenu}>
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="kiyo-card overflow-hidden">
                <div className="kiyo-skeleton h-36 w-full rounded-none" />
                <div className="p-4">
                  <SkeletonLine w="w-2/3" />
                  <SkeletonLine w="w-1/2" h="h-3" />
                </div>
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <PremiumEmptyState
            icon={<MapPin className="h-7 w-7" />}
            title={query.trim() || filter !== 'all' ? tx.emptyTitle : t('market.empty')}
            message={tx.emptyBody}
            action={(query.trim() || filter !== 'all') ? (
              <button
                type="button"
                className="kiyo-btn-primary min-h-11"
                onClick={() => { setQuery(''); setFilter('all'); }}
              >
                {tx.showAll}
              </button>
            ) : undefined}
            secondary={query.trim() ? (
              <button
                type="button"
                className="kiyo-btn-secondary min-h-11"
                onClick={() => setQuery('')}
              >
                {tx.clearSearch}
              </button>
            ) : undefined}
          />
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
                  {r.is_verified && (
                    <span
                      className="absolute top-3 inline-flex min-h-7 items-center gap-1 rounded-full bg-white/95 px-2 text-[10px] font-bold text-sage-700 shadow-sm"
                      style={{ insetInlineEnd: '0.75rem' }}
                      title={tx.verified}
                    >
                      <BadgeCheck className="h-3.5 w-3.5" aria-hidden />
                      {tx.verified}
                    </span>
                  )}
                  {r.is_exclusive_to_kiyo && (
                    <span
                      className="absolute top-3 inline-flex min-h-7 items-center gap-1 rounded-full bg-ember-500 px-2 text-[10px] font-bold text-white shadow-sm"
                      style={{ insetInlineStart: '0.75rem' }}
                    >
                      <Sparkles className="h-3.5 w-3.5" aria-hidden />
                      {tx.exclusive}
                    </span>
                  )}
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent p-3">
                    <div className="flex items-center gap-2">
                      <StatusChip
                        status={restaurantAcceptsOrders(r, r.special_hours, availabilityClock)
                          ? r.operational_status
                          : 'closed'}
                      />
                      {r.estimated_delivery_min && (
                        <span className="flex items-center gap-1 rounded-full bg-white/20 px-2 py-0.5 text-[10px] font-semibold text-white backdrop-blur">
                          <Clock className="h-3 w-3" />
                          {tx.preparation.replace('{minutes}', String(r.estimated_delivery_min))}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-display text-base font-bold text-ink-900">{r.name}</h3>
                    {r.rating > 0 && r.review_count > 0 && (
                      <span className="text-end text-xs font-semibold text-ink-700">
                        <span className="flex items-center justify-end gap-0.5">
                          <Star className="h-3 w-3 fill-ember-500 text-ember-500" />
                          {Number(r.rating).toFixed(1)}
                        </span>
                        <span className="block text-[10px] font-medium text-ink-400">
                          {tx.reviews.replace('{count}', String(r.review_count))}
                        </span>
                      </span>
                    )}
                  </div>
                  {r.cuisine && r.cuisine.length > 0 && (
                    <p className="mt-1 text-xs text-ink-400">{r.cuisine.slice(0, 3).join(' / ')}</p>
                  )}
                  {r.description && (
                    <p className="mt-2 line-clamp-2 text-sm text-ink-500">{r.description}</p>
                  )}
                  {r.is_exclusive_to_kiyo && (
                    <p className="mt-2 inline-flex items-center gap-1 rounded-lg bg-ember-50 px-2.5 py-1.5 text-xs font-bold text-ember-700">
                      <Sparkles className="h-3.5 w-3.5" aria-hidden />
                      {r.fair_commission_message || tx.fairCommission}
                    </p>
                  )}
                  {menuMatches.has(r.id) && (
                    <p className="mt-2 rounded-lg bg-ember-50 px-2.5 py-2 text-xs font-semibold text-ember-800">
                      {tx.dishMatch
                        .replace('{dish}', menuMatches.get(r.id)?.name ?? '')
                        .replace('{price}', String(Number(menuMatches.get(r.id)?.price ?? 0)))}
                    </p>
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

function TrustPill({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="flex min-h-11 items-center gap-2 rounded-xl border border-ink-100 bg-white px-3 py-2 shadow-sm">
      <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg bg-ember-50 text-ember-600">
        {icon}
      </span>
      <span className="leading-5">{label}</span>
    </div>
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
