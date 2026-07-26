import { Heart, Trash2, Star } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useT } from '../lib/i18n-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { AppShell } from '../components/AppShell';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { Skeleton, PremiumEmptyState } from '../components/feedback';
import { RestaurantImage } from '../components/ui';
import { userFacingError } from '../lib/userFacingError';
import { useEffect, useState, useCallback } from 'react';
import { withExponentialBackoff } from '../lib/locationNetwork';
import {
  algeriaAvailabilityDateRange,
  restaurantAcceptsOrders,
} from '../lib/restaurantAvailability';
import { useRealtime } from '../lib/useRealtime';
import type { Restaurant, RestaurantSpecialHours } from '../lib/supabase';

type FavoriteRestaurant = {
  id: string;
  created_at: string;
  restaurants: Pick<
    Restaurant,
    | 'id'
    | 'name'
    | 'description'
    | 'image_url'
    | 'cuisine'
    | 'rating'
    | 'review_count'
    | 'wilaya_id'
    | 'status'
    | 'operational_status'
    | 'is_vacation_mode'
    | 'opening_hours'
    | 'timezone'
    | 'estimated_delivery_min'
  >;
  availability: 'open' | 'busy' | 'closed';
};

type FavoriteQueryRow = Omit<FavoriteRestaurant, 'availability' | 'restaurants'> & {
  restaurants: FavoriteRestaurant['restaurants'] | null;
};

export function FavoritesPage() {
  const { t, locale } = useT();
  const { user } = useAuth();
  const [favorites, setFavorites] = useState<FavoriteRestaurant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const cardCopy = locale === 'ar'
    ? { reviews: 'تقييم موثّق', minutes: 'دقيقة تقريباً' }
    : locale === 'fr'
      ? { reviews: 'avis vérifiés', minutes: 'min environ' }
      : { reviews: 'verified reviews', minutes: 'min estimated' };
  const removeError = locale === 'ar'
    ? 'تعذر حذف المطعم من المفضلة. بقي محفوظاً ويمكنك إعادة المحاولة.'
    : locale === 'fr'
      ? 'Impossible de retirer ce restaurant des favoris. Il reste enregistré et vous pouvez réessayer.'
      : 'Could not remove this restaurant from favorites. It remains saved, and you can try again.';

  const loadFavorites = useCallback(async () => {
    if (!user) {
      setFavorites([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const favoritesResult = await withExponentialBackoff(async () => {
        const result = await supabase
          .from('customer_favorites')
          .select('id, created_at, restaurants!customer_favorites_restaurant_id_fkey(id, name, description, image_url, cuisine, rating, review_count, wilaya_id, status, operational_status, is_vacation_mode, opening_hours, timezone, estimated_delivery_min)')
          .eq('customer_id', user.id)
          .is('menu_item_id', null)
          .order('created_at', { ascending: false });
        if (result.error) throw result.error;
        return (result.data ?? []) as unknown as FavoriteQueryRow[];
      }, { attempts: 3, timeoutMs: 12_000 });

      const publicFavorites = favoritesResult.filter(
        (favorite): favorite is FavoriteQueryRow & { restaurants: FavoriteRestaurant['restaurants'] } =>
          Boolean(favorite.restaurants),
      );
      const restaurantIds = publicFavorites.map((favorite) => favorite.restaurants.id);
      let specialHours: RestaurantSpecialHours[] = [];

      if (restaurantIds.length > 0) {
        const range = algeriaAvailabilityDateRange();
        specialHours = await withExponentialBackoff(async () => {
          const result = await supabase
            .from('restaurant_special_hours')
            .select('*')
            .in('restaurant_id', restaurantIds)
            .gte('date', range.from)
            .lte('date', range.to);
          if (result.error) throw result.error;
          return (result.data as RestaurantSpecialHours[] | null) ?? [];
        }, { attempts: 3, timeoutMs: 12_000 });
      }

      setFavorites(publicFavorites.map((favorite) => {
        const restaurant = favorite.restaurants;
        const acceptsOrders = restaurantAcceptsOrders(
          restaurant,
          specialHours.filter((entry) => entry.restaurant_id === restaurant.id),
        );
        return {
          id: favorite.id,
          created_at: favorite.created_at,
          restaurants: restaurant,
          availability: acceptsOrders ? restaurant.operational_status : 'closed',
        };
      }));
    } catch (err: unknown) {
      console.error(err);
      setError(userFacingError(err, locale, t('error.genericBody')));
    } finally {
      setLoading(false);
    }
  }, [locale, user, t]);

  useEffect(() => { void loadFavorites(); }, [loadFavorites]);

  const realtimeRestaurantIds = favorites
    .map((favorite) => favorite.restaurants.id)
    .sort()
    .join(',');
  const realtimeFilter = realtimeRestaurantIds
    ? `in.(${realtimeRestaurantIds})`
    : undefined;

  useRealtime('restaurants', () => {
    void loadFavorites();
  }, {
    enabled: Boolean(user && realtimeFilter),
    filter: realtimeFilter ? { id: realtimeFilter } : undefined,
  });

  useRealtime('restaurant_special_hours', () => {
    void loadFavorites();
  }, {
    enabled: Boolean(user && realtimeFilter),
    filter: realtimeFilter ? { restaurant_id: realtimeFilter } : undefined,
  });

  const removeFavorite = async (favoriteId: string) => {
    const previous = favorites;
    setFavorites(prev => prev.filter(f => f.id !== favoriteId));
    const { error: e } = await supabase.from('customer_favorites').delete().eq('id', favoriteId);
    if (e) {
      setFavorites(previous);
      setError(removeError);
    }
  };

  if (loading) {
    return (
      <AppShell>
        <Skeleton count={3} />
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="mb-5">
        <h1 className="font-display text-2xl font-extrabold tracking-tight text-ink-900">
          <Heart className="me-2 inline h-6 w-6 text-error-500" />
          {t('nav.favorites')}
        </h1>
        <p className="text-sm text-ink-400">{t('favorites.subtitle')}</p>
      </div>

      {error && (
        <div className="mb-4 rounded-xl bg-error-50 p-4 border border-error-100 text-sm text-error-700">
          {error}
        </div>
      )}

      <ErrorBoundary variant="inline">
        {favorites.length === 0 ? (
          <PremiumEmptyState
            icon={<Heart className="h-7 w-7" />}
            title={t('favorites.none')}
            message={locale === 'ar'
              ? 'احفظ المطاعم التي تحبها لتعود إلى قوائمها بسرعة.'
              : locale === 'fr'
                ? 'Enregistrez les restaurants que vous aimez pour retrouver rapidement leur menu.'
                : 'Save restaurants you enjoy so you can return to their menus quickly.'}
            action={<Link to="/restaurants" className="kiyo-btn-primary min-h-11 text-sm">{t('market.browse')}</Link>}
          />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {favorites.map((fav) => (
              <div key={fav.id} className="kiyo-card group relative overflow-hidden">
                <Link to={`/restaurant/${fav.restaurants.id}`} className="block">
                  <RestaurantImage
                    url={fav.restaurants.image_url}
                    name={fav.restaurants.name}
                    className="aspect-[16/9] w-full rounded-t-lg object-cover"
                  />
                  <div className="p-4">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-display text-base font-bold text-ink-900">
                        {fav.restaurants.name}
                      </h3>
                      {fav.restaurants.rating > 0 && (
                        <span className="text-end text-xs font-medium text-amber-700">
                          <span className="flex items-center justify-end gap-1">
                            <Star className="h-3.5 w-3.5 fill-amber-500 text-amber-500" aria-hidden />
                            {fav.restaurants.rating.toFixed(1)}
                          </span>
                          {fav.restaurants.review_count > 0 && (
                            <span className="mt-0.5 block text-[10px] text-ink-400">
                              {fav.restaurants.review_count} {cardCopy.reviews}
                            </span>
                          )}
                        </span>
                      )}
                    </div>
                    {fav.restaurants.cuisine && fav.restaurants.cuisine.length > 0 && (
                      <p className="mt-1 text-xs text-ink-400">
                        {fav.restaurants.cuisine.slice(0, 3).join(' / ')}
                      </p>
                    )}
                    <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1">
                      <span className="inline-flex items-center gap-2">
                      <span className={`h-2 w-2 rounded-full ${
                        fav.availability === 'open' ? 'bg-sage-500' :
                        fav.availability === 'busy' ? 'bg-amber-500' : 'bg-ink-300'
                      }`} />
                      <span className="text-xs text-ink-500">
                        {fav.availability === 'open' ? t('restaurant.open') :
                         fav.availability === 'busy' ? t('restaurant.busy') : t('restaurant.closed')}
                      </span>
                      </span>
                      {fav.restaurants.estimated_delivery_min != null && fav.availability !== 'closed' && (
                        <span className="text-xs text-ink-400">
                          {fav.restaurants.estimated_delivery_min} {cardCopy.minutes}
                        </span>
                      )}
                    </div>
                  </div>
                </Link>
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    removeFavorite(fav.id);
                  }}
                  className="absolute top-2 flex h-11 w-11 items-center justify-center rounded-lg bg-white/95 text-ink-500 shadow-sm transition-colors hover:bg-error-50 hover:text-error-600"
                  style={{ insetInlineEnd: '0.5rem' }}
                  aria-label={t('restaurant.delete')}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </ErrorBoundary>
    </AppShell>
  );
}

export default FavoritesPage;
