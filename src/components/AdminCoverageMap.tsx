import { useEffect, useMemo, useState } from 'react';
import { Map, useMap } from '@vis.gl/react-google-maps';
import { GoogleMapsOverlay } from '@deck.gl/google-maps';
import { ScatterplotLayer } from '@deck.gl/layers';
import { Activity, AlertTriangle, Layers3 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useT } from '../lib/i18n-react';
import { ALGERIA_MAP_BOUNDS, ALGERIA_MAP_CENTER, isValidMapCoordinate } from '../lib/googleMaps';
import { GoogleMapShell, GOOGLE_MAPS_MAP_ID } from './GoogleMapShell';

type LocationPoint = {
  id: string;
  lat: number;
  lng: number;
  type: 'customer' | 'restaurant';
};

type CoverageFilter = 'all' | 'customer' | 'restaurant';

export default function AdminCoverageMap() {
  const { t, locale } = useT();
  const [points, setPoints] = useState<LocationPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<CoverageFilter>('all');

  useEffect(() => {
    let active = true;
    async function loadCoverage() {
      setLoading(true);
      setError(null);
      try {
        const [restaurants, addresses] = await Promise.all([
          supabase.from('restaurants').select('id, latitude, longitude').eq('status', 'published').limit(5000),
          supabase.from('saved_addresses').select('id, latitude, longitude').not('latitude', 'is', null).limit(5000),
        ]);
        if (restaurants.error) throw restaurants.error;
        if (addresses.error) throw addresses.error;
        if (!active) return;

        const restaurantPoints = (restaurants.data ?? []).flatMap((restaurant) => (
          isValidMapCoordinate(restaurant.latitude, restaurant.longitude)
            ? [{
                id: `restaurant-${restaurant.id}`,
                lat: restaurant.latitude as number,
                lng: restaurant.longitude as number,
                type: 'restaurant' as const,
              }]
            : []
        ));
        const customerPoints = (addresses.data ?? []).flatMap((address) => (
          isValidMapCoordinate(address.latitude, address.longitude)
            ? [{
                id: `customer-${address.id}`,
                lat: address.latitude as number,
                lng: address.longitude as number,
                type: 'customer' as const,
              }]
            : []
        ));
        setPoints([...restaurantPoints, ...customerPoints]);
      } catch (loadError) {
        console.error('[Kiyo Maps] Coverage data failed to load', loadError);
        if (active) setError(t('map.coverageLoadFailed'));
      } finally {
        if (active) setLoading(false);
      }
    }
    void loadCoverage();
    return () => { active = false; };
  }, [t]);

  const filteredPoints = useMemo(
    () => points.filter((point) => filter === 'all' || point.type === filter),
    [filter, points],
  );

  const filters: Array<{ id: CoverageFilter; label: string }> = [
    { id: 'all', label: t('map.coverageAll') },
    { id: 'customer', label: t('map.coverageDestinations') },
    { id: 'restaurant', label: t('map.coverageRestaurants') },
  ];

  return (
    <section className="overflow-hidden rounded-xl border border-ink-100 bg-white shadow-card">
      <header className="flex flex-col gap-3 border-b border-ink-100 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <Layers3 className="h-4 w-4 text-ember-600" />
          <h3 className="font-display text-sm font-bold text-ink-900">{t('map.coverageTitle')}</h3>
        </div>
        <div className="flex max-w-full overflow-x-auto rounded-lg bg-ink-100 p-1" role="group" aria-label={t('map.coverageFilter')}>
          {filters.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setFilter(item.id)}
              className={`whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${filter === item.id ? 'bg-white text-ink-900 shadow-sm' : 'text-ink-500 hover:text-ink-800'}`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </header>

      {error ? (
        <div className="flex h-[400px] flex-col items-center justify-center bg-ink-50 px-5 text-center">
          <AlertTriangle className="h-6 w-6 text-error-600" />
          <p className="mt-2 text-sm font-semibold text-error-700">{error}</p>
        </div>
      ) : (
        <GoogleMapShell fallbackHeightClass="h-[400px]">
          <div className="relative h-[400px] w-full bg-ink-100">
            <Map
              defaultBounds={{ ...ALGERIA_MAP_BOUNDS, padding: 36 }}
              defaultCenter={ALGERIA_MAP_CENTER}
              defaultZoom={5}
              mapId={GOOGLE_MAPS_MAP_ID}
              gestureHandling="cooperative"
              disableDefaultUI
              zoomControl
              fullscreenControl
              minZoom={4}
              maxZoom={18}
              reuseMaps
              style={{ width: '100%', height: '100%' }}
            >
              <CoverageOverlay points={filteredPoints} />
              {filteredPoints.length > 0 && <FitCoverageBounds points={filteredPoints} />}
            </Map>

            {loading && (
              <div className="absolute inset-0 z-20 flex items-center justify-center bg-white/85 backdrop-blur-sm">
                <span className="flex items-center gap-2 text-sm font-semibold text-ink-600">
                  <Activity className="h-4 w-4 animate-pulse text-ember-600" />
                  {t('map.coverageAnalyzing')}
                </span>
              </div>
            )}
            {!loading && filteredPoints.length === 0 && (
              <div className="pointer-events-none absolute inset-x-4 bottom-4 z-20 rounded-lg bg-white/95 px-4 py-3 text-center text-xs font-medium text-ink-600 shadow-card backdrop-blur">
                {t('map.coverageEmpty')}
              </div>
            )}
          </div>
        </GoogleMapShell>
      )}

      <footer className="border-t border-ink-100 bg-ink-50 px-4 py-3 text-xs text-ink-500">
        <span className="font-semibold text-ink-700">{filteredPoints.length.toLocaleString(locale)}</span>{' '}
        {t('map.coverageSummary')}
      </footer>
    </section>
  );
}

function CoverageOverlay({ points }: { points: LocationPoint[] }) {
  const map = useMap();

  useEffect(() => {
    if (!map) return;
    const overlay = new GoogleMapsOverlay({ interleaved: true });
    overlay.setProps({
      layers: [
        new ScatterplotLayer<LocationPoint>({
          id: 'kiyo-coverage-points',
          data: points,
          getPosition: (point) => [point.lng, point.lat],
          getFillColor: (point) => point.type === 'restaurant'
            ? [26, 26, 23, 190]
            : [251, 79, 10, 120],
          getLineColor: [255, 255, 255, 220],
          getRadius: (point) => point.type === 'restaurant' ? 220 : 130,
          radiusMinPixels: 4,
          radiusMaxPixels: 24,
          lineWidthMinPixels: 1,
          stroked: true,
          pickable: false,
        }),
      ],
    });
    overlay.setMap(map);
    return () => {
      overlay.setMap(null);
      overlay.finalize();
    };
  }, [map, points]);

  return null;
}

function FitCoverageBounds({ points }: { points: LocationPoint[] }) {
  const map = useMap();

  useEffect(() => {
    if (!map || points.length === 0) return;
    const bounds = new google.maps.LatLngBounds();
    points.forEach((point) => bounds.extend({ lat: point.lat, lng: point.lng }));
    map.fitBounds(bounds, 52);
  }, [map, points]);

  return null;
}
