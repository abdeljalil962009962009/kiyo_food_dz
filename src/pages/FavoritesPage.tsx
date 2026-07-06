import { Heart, Trash2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useT } from '../lib/i18n-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { AppShell } from '../components/AppShell';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { Skeleton } from '../components/feedback';
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
  const { t } = useT();
  const { user } = useAuth();
  const [favorites, setFavorites] = useState<FavoriteRestaurant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
      setFavorites((data as FavoriteRestaurant[]) ?? []);
    } catch (err: unknown) {
      console.error(err);
      setError(err instanceof Error ? err.message : t('error.genericBody'));
    } finally {
      setLoading(false);
    }
  }, [user, t]);

  useEffect(() => { void loadFavorites(); }, [loadFavorites]);

  const removeFavorite = async (favoriteId: string) => {
    setFavorites(prev => prev.filter(f => f.id !== favoriteId));
    await supabase.from('customer_favorites').delete().eq('id', favoriteId);
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
          <div className="kiyo-card flex flex-col items-center gap-3 py-12 text-center">
            <Heart className="h-10 w-10 text-ink-200" />
            <p className="text-sm text-ink-500">{t('favorites.none')}</p>
            <Link to="/restaurants" className="kiyo-btn-primary text-sm">
              {t('market.browse')}
            </Link>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {favorites.map((fav) => (
              <div key={fav.id} className="kiyo-card group relative overflow-hidden">
                <Link to={`/restaurant/${fav.restaurants.id}`} className="block">
                  {fav.restaurants.image_url && (
                    <RestaurantImage
                      src={fav.restaurants.image_url}
                      alt={fav.restaurants.name}
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
                          <span className="text-amber-500">★</span>
                          {fav.restaurants.rating.toFixed(1)}
                        </span>
                      )}
                    </div>
                    {fav.restaurants.cuisine && fav.restaurants.cuisine.length > 0 && (
                      <p className="mt-1 text-xs text-ink-400">
                        {fav.restaurants.cuisine.slice(0, 3).join(' • ')}
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
                  className="absolute right-2 top-2 rounded-lg bg-white/90 p-2 text-ink-400 opacity-0 shadow-sm transition-opacity hover:text-error-600 group-hover:opacity-100"
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
