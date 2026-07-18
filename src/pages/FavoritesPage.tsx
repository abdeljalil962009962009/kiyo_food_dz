import { Heart, Trash2, Star } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useT } from '../lib/i18n-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { AppShell } from '../components/AppShell';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { Skeleton, PremiumEmptyState } from '../components/feedback';
import { RestaurantImage } from '../components/ui';
import { useEffect, useState, useCallback } from 'react';

type FavoriteRestaurant = {
  id: string;
  created_at: string;
  restaurants: {
    id: string;
    name: string;
    description: string | null;
    image_url: string | null;
    cuisine: string[] | null;
    rating: number;
    review_count: number;
    wilaya_id: number | null;
    operational_status: string;
  };
};

export function FavoritesPage() {
  const { t, locale } = useT();
  const { user } = useAuth();
  const [favorites, setFavorites] = useState<FavoriteRestaurant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
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
      const { data, error: e } = await supabase
        .from('customer_favorites')
        .select('id, created_at, restaurants!customer_favorites_restaurant_id_fkey(id, name, description, image_url, cuisine, rating, review_count, wilaya_id, operational_status)')
        .eq('customer_id', user.id)
        .is('menu_item_id', null)
        .order('created_at', { ascending: false });
      if (e) throw e;
      setFavorites((data as unknown as FavoriteRestaurant[]) ?? []);
    } catch (err: unknown) {
      console.error(err);
      setError(err instanceof Error ? err.message : t('error.genericBody'));
    } finally {
      setLoading(false);
    }
  }, [user, t]);

  useEffect(() => { void loadFavorites(); }, [loadFavorites]);

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
          <Heart className="mr-2 inline h-6 w-6 text-error-500" />
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
                  {fav.restaurants.image_url && (
                    <RestaurantImage
                      url={fav.restaurants.image_url}
                      name={fav.restaurants.name}
                      className="aspect-[16/9] w-full rounded-t-lg object-cover"
                    />
                  )}
                  <div className="p-4">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-display text-base font-bold text-ink-900">
                        {fav.restaurants.name}
                      </h3>
                      {fav.restaurants.rating > 0 && (
                        <span className="flex items-center gap-1 text-xs font-medium text-amber-600">
                          <Star className="h-3.5 w-3.5 fill-amber-500 text-amber-500" aria-hidden />
                          {fav.restaurants.rating.toFixed(1)}
                        </span>
                      )}
                    </div>
                    {fav.restaurants.cuisine && fav.restaurants.cuisine.length > 0 && (
                      <p className="mt-1 text-xs text-ink-400">
                        {fav.restaurants.cuisine.slice(0, 3).join(' / ')}
                      </p>
                    )}
                    <div className="mt-2 flex items-center gap-2">
                      <span className={`h-2 w-2 rounded-full ${
                        fav.restaurants.operational_status === 'open' ? 'bg-sage-500' :
                        fav.restaurants.operational_status === 'busy' ? 'bg-amber-500' : 'bg-ink-300'
                      }`} />
                      <span className="text-xs text-ink-500">
                        {fav.restaurants.operational_status === 'open' ? t('restaurant.open') :
                         fav.restaurants.operational_status === 'busy' ? t('restaurant.busy') : t('restaurant.closed')}
                      </span>
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
