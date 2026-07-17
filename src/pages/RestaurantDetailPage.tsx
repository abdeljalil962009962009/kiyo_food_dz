import { useEffect, useState, useCallback } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { Map, AdvancedMarker } from '@vis.gl/react-google-maps';
import { Star, Clock, MapPin, Plus, ChevronLeft, ShoppingBag, Info, Truck, Heart } from 'lucide-react';
import { useT } from '../lib/i18n-react';
import { supabase, type Restaurant, type MenuItem, type MenuCategory } from '../lib/supabase';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import { AppShell } from '../components/AppShell';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { Skeleton, ErrorState } from '../components/feedback';
import { RestaurantImage, PriceTag } from '../components/ui';
import { GoogleMapShell, GOOGLE_MAPS_MAP_ID, MapCircle, MapMarkerBadge } from '../components/GoogleMapShell';
import { isValidMapCoordinate } from '../lib/googleMaps';
import { useRealtime } from '../lib/useRealtime';

export default function RestaurantDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { t } = useT();
  const navigate = useNavigate();
  const { addItem, state: cart, setRestaurantName } = useCart();
  const { user } = useAuth();

  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [categories, setCategories] = useState<MenuCategory[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isFavorite, setIsFavorite] = useState(false);
  const [favoriteAnimating, setFavoriteAnimating] = useState(false);
  const [addedItemId, setAddedItemId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const [r, c, m] = await Promise.all([
        supabase.from('restaurants').select('*').eq('id', id).maybeSingle(),
        supabase.from('menu_categories').select('*').eq('restaurant_id', id).order('position'),
        supabase.from('menu_items').select('*').eq('restaurant_id', id).order('position'),
      ]);
      const foundRes = r.data as Restaurant;
      if (!foundRes) {
        setError('404');
      } else {
        setRestaurant(foundRes);
        setRestaurantName(foundRes.name);
        setCategories((c.data as MenuCategory[]) ?? []);
        setMenuItems((m.data as MenuItem[]) ?? []);
      }

      // Check if favorite
      if (user && foundRes) {
        const { data: fav } = await supabase
          .from('customer_favorites')
          .select('id')
          .eq('customer_id', user.id)
          .eq('restaurant_id', id)
          .maybeSingle();
        setIsFavorite(!!fav);
      }
    } catch (err: unknown) {
      console.error(err);
      setError('500');
    } finally {
      setLoading(false);
    }
  }, [id, setRestaurantName, user]);

  useEffect(() => { void load(); }, [load]);

  useRealtime('restaurants', (payload) => {
    if (payload.new.id !== id) return;
    setRestaurant((current) => current ? { ...current, ...payload.new } as Restaurant : current);
  }, { enabled: Boolean(id), filter: id ? { id: `eq.${id}` } : undefined });

  const toggleFavorite = async () => {
    if (!user || !restaurant) return;
    setActionError(null);
    const result = isFavorite
      ? await supabase.from('customer_favorites').delete().eq('customer_id', user.id).eq('restaurant_id', restaurant.id)
      : await supabase.from('customer_favorites').insert({ customer_id: user.id, restaurant_id: restaurant.id });
    if (result.error) {
      setActionError(t('error.genericBody'));
      return;
    }
    setIsFavorite(!isFavorite);
    setFavoriteAnimating(true);
    window.setTimeout(() => setFavoriteAnimating(false), 350);
  };

  const handleAdd = (item: MenuItem) => {
    setActionError(null);
    addItem(item, 1);
    setAddedItemId(item.id);
    window.setTimeout(() => setAddedItemId(null), 450);
  };

  if (loading) {
    return (
      <AppShell>
        <div className="kiyo-card overflow-hidden">
          <div className="kiyo-skeleton h-48 w-full rounded-none" />
          <div className="p-5"><Skeleton count={4} /></div>
        </div>
      </AppShell>
    );
  }
  if (error === '404') {
    return (
      <AppShell>
        <ErrorState
          title={t('error.pageNotFound')}
          message={t('error.pageNotFoundBody')}
          onRetry={() => navigate('/restaurants')}
          retryLabel={t('error.goHome')}
        />
      </AppShell>
    );
  }
  if (error || !restaurant) {
    return (
      <AppShell>
        <ErrorState
          title={t('error.genericTitle')} message={t('error.genericBody')}
          onRetry={load} retryLabel={t('error.retry')}
        />
      </AppShell>
    );
  }

  const isOpen = restaurant.operational_status !== 'closed';
  const cartHasOtherRestaurant = cart.restaurantId && cart.restaurantId !== restaurant.id;

  return (
    <AppShell>
      <Link
        to="/restaurants"
        className="mb-3 inline-flex items-center gap-1 text-xs font-semibold text-ink-500 hover:text-ink-900"
      >
        <ChevronLeft className="h-4 w-4" />
        {t('market.browse')}
      </Link>

      <ErrorBoundary variant="inline">
        <div className="kiyo-card overflow-hidden">
          <div className="relative h-44 sm:h-56">
            <RestaurantImage url={restaurant.image_url} name={restaurant.name} />
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
            <div className="absolute bottom-0 left-0 right-0 p-4 sm:p-5">
              <h1 className="font-display text-2xl font-extrabold tracking-tight text-white sm:text-3xl">
                {restaurant.name}
              </h1>
              {user && (
                <button
                  onClick={toggleFavorite}
                  className={`absolute right-4 top-4 flex h-11 w-11 items-center justify-center rounded-full bg-white/90 shadow-lg transition-all hover:bg-white sm:right-5 sm:top-5 ${favoriteAnimating ? 'animate-favorite-pop' : ''}`}
                  aria-label={t('nav.favorites')}
                >
                  <Heart className={`h-5 w-5 ${isFavorite ? 'fill-error-500 text-error-500' : 'text-ink-400'}`} />
                </button>
              )}
              <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-ink-100">
                {restaurant.rating > 0 && (
                  <span className="flex items-center gap-0.5 rounded-full bg-white/20 px-2 py-0.5 font-semibold backdrop-blur">
                    <Star className="h-3 w-3 fill-ember-500 text-ember-500" />
                    {Number(restaurant.rating).toFixed(1)}
                  </span>
                )}
                <span className={`rounded-full px-2 py-0.5 font-semibold backdrop-blur ${
                  restaurant.operational_status === 'open' ? 'bg-sage-500/80 text-white' :
                  restaurant.operational_status === 'busy' ? 'bg-warning-500/80 text-white' :
                  'bg-ink-900/80 text-white'
                }`}>
                  {t(`restaurant.${restaurant.operational_status}`)}
                </span>
                {restaurant.estimated_delivery_min && (
                  <span className="flex items-center gap-1 rounded-full bg-white/20 px-2 py-0.5 font-semibold backdrop-blur">
                    <Clock className="h-3 w-3" /> {restaurant.estimated_delivery_min}m
                  </span>
                )}
                {restaurant.cuisine && restaurant.cuisine.length > 0 && (
                  <span className="rounded-full bg-white/20 px-2 py-0.5 backdrop-blur">
                    {restaurant.cuisine.slice(0, 3).join(' · ')}
                  </span>
                )}
              </div>
            </div>
          </div>

          {restaurant.description && (
            <div className="border-b border-ink-100 p-4 sm:p-5">
              <p className="text-sm text-ink-600">{restaurant.description}</p>
            </div>
          )}

          {restaurant.address && (
            <div className="flex items-center gap-2 border-b border-ink-100 px-4 py-3 text-xs text-ink-500 sm:px-5">
              <MapPin className="h-3.5 w-3.5" />
              {restaurant.address}
            </div>
          )}

          <div className="flex items-center gap-2 bg-ember-500/5 px-4 py-2.5 text-xs text-ember-700 sm:px-5">
            <Truck className="h-3.5 w-3.5 flex-shrink-0" />
            {t('checkout.deliveryByRestaurant')}
          </div>
        </div>

        {actionError && <div className="mb-3 rounded-lg border border-error-200 bg-error-50 px-3 py-2 text-xs text-error-700" role="alert">{actionError}</div>}
        {cartHasOtherRestaurant && (
          <div className="mt-3 flex items-start gap-2 rounded-xl bg-warning-500/10 px-3 py-2.5 text-xs text-warning-600">
            <Info className="mt-0.5 h-4 w-4 flex-shrink-0" />
            <span>{t('cart.switchWarning')}</span>
          </div>
        )}

        {!isOpen && (
          <div className="mt-3 rounded-xl bg-ink-100 px-3 py-2 text-xs font-medium text-ink-500">
            {t('restaurant.closed')} — {t('restaurant.addToCart')} disabled.
          </div>
        )}

        <div className="mt-6">
          <h2 className="mb-3 font-display text-lg font-bold text-ink-900">{t('restaurant.menu')}</h2>
          {menuItems.length === 0 ? (
            <div className="kiyo-card p-8 text-center text-sm text-ink-400">
              {t('restaurant.noMenu')}
            </div>
          ) : categories.length === 0 ? (
            <MenuGrid items={menuItems} onAdd={handleAdd} disabled={!isOpen} addedItemId={addedItemId} />
          ) : (
            <div className="space-y-6">
              {categories.map((cat) => {
                const items = menuItems.filter((m) => m.category_id === cat.id);
                if (items.length === 0) return null;
                return (
                  <div key={cat.id}>
                    <h3 className="mb-2 font-display text-base font-bold text-ink-900">{cat.name}</h3>
                    <MenuGrid items={items} onAdd={handleAdd} disabled={!isOpen} addedItemId={addedItemId} />
                  </div>
                );
              })}
              {/* Uncategorised items */}
              {menuItems.filter((m) => !m.category_id).length > 0 && (
                <div>
                  <h3 className="mb-2 font-display text-base font-bold text-ink-900">{t('profile.addresses.other')}</h3>
                  <MenuGrid
                    items={menuItems.filter((m) => !m.category_id)}
                    onAdd={handleAdd} disabled={!isOpen} addedItemId={addedItemId}
                  />
                </div>
              )}
            </div>
          )}
        </div>
      </ErrorBoundary>

      {cart.restaurantId === restaurant.id && cart.lines.length > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-ink-100 bg-white/90 px-4 py-3 backdrop-blur-xl sm:px-6"
          style={{ paddingBottom: 'calc(var(--kiyo-safe-bottom) + 12px)' }}
        >
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-sm font-medium text-ink-700">
              <ShoppingBag className="h-4 w-4" />
              {cart.lines.reduce((s, l) => s + l.quantity, 0)} {t('orders.items')}
            </div>
            <button
              onClick={() => navigate('/cart')}
              className="kiyo-btn-primary"
            >
              {t('cart.checkout')}
              <ChevronLeft className="h-4 w-4 rotate-180" />
            </button>
          </div>
        </div>
      )}
      {/* Restaurant location + delivery zone map */}
      <div className="mt-6 mb-20">
        <h2 className="mb-2 font-display text-base font-bold text-ink-900">{t('map.locationDeliveryZone')}</h2>
        <RestaurantMiniMap restaurant={restaurant} />
      </div>
    </AppShell>
  );
}

function RestaurantMiniMap({ restaurant }: { restaurant: Restaurant }) {
  const { t } = useT();
  const lat = restaurant.latitude;
  const lng = restaurant.longitude;
  const maxKm = restaurant.max_delivery_km;
  
  if (!isValidMapCoordinate(lat, lng)) {
    return (
      <div className="rounded-xl border border-ink-200 bg-ink-50 px-4 py-6 text-center text-xs text-ink-500">
        {t('map.locationUnavailableShort')}
      </div>
    );
  }
  const position = { lat: lat as number, lng: lng as number };
  
  return (
    <GoogleMapShell fallbackHeightClass="h-64">
      <div className="relative h-64 w-full overflow-hidden rounded-xl border border-ink-200 bg-ink-100 shadow-card">
        <Map
          defaultCenter={position}
          defaultZoom={13}
          mapId={GOOGLE_MAPS_MAP_ID}
          gestureHandling="cooperative"
          disableDefaultUI
          zoomControl
          fullscreenControl
          minZoom={5}
          maxZoom={20}
          reuseMaps
          style={{ width: '100%', height: '100%' }}
        >
          <AdvancedMarker position={position} title={restaurant.name}>
            <MapMarkerBadge kind="restaurant" />
          </AdvancedMarker>
          {maxKm && maxKm > 0 && <MapCircle center={position} radius={maxKm * 1000} color="#ec3804" fillOpacity={0.07} />}
        </Map>
      </div>
    </GoogleMapShell>
  );
}

function MenuGrid({ items, onAdd, disabled, addedItemId }: {
  items: MenuItem[]; onAdd: (item: MenuItem) => void; disabled: boolean; addedItemId: string | null;
}) {
  const { t } = useT();
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {items.map((item) => {
        const unavailable = !item.is_available || disabled;
        return (
          <div
            key={item.id}
            className={`kiyo-card flex items-start gap-3 p-3 transition-opacity ${
              unavailable ? 'opacity-60' : ''
            }`}
          >
            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-2">
                <h4 className="font-display text-sm font-bold text-ink-900">{item.name}</h4>
                <PriceTag value={item.price} />
              </div>
              {item.description && (
                <p className="mt-1 line-clamp-2 text-xs text-ink-500">{item.description}</p>
              )}
              {!item.is_available && (
                <span className="mt-1.5 inline-block rounded bg-ink-100 px-2 py-0.5 text-[10px] font-semibold text-ink-500">
                  {t('restaurant.outOfStock')}
                </span>
              )}
            </div>
            <button
              onClick={() => onAdd(item)}
              disabled={unavailable}
              className={`flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-lg bg-ink-900 text-white transition-transform active:scale-95 disabled:cursor-not-allowed disabled:opacity-40 ${addedItemId === item.id ? 'animate-cart-pulse' : ''}`}
              aria-label={t('restaurant.addToCart')}
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
