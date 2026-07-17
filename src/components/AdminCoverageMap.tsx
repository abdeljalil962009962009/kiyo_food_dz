import { useEffect, useMemo, useState } from 'react';
import { Map, useMap } from '@vis.gl/react-google-maps';
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
      ) : loading ? (
        <div className="relative flex h-[400px] w-full items-center justify-center overflow-hidden bg-ink-50">
          <div className="absolute inset-0 opacity-70" aria-hidden="true">
            <div className="h-full w-full bg-[linear-gradient(90deg,rgba(255,255,255,0.7)_1px,transparent_1px),linear-gradient(180deg,rgba(255,255,255,0.7)_1px,transparent_1px)] bg-[size:28px_28px]" />
          </div>
          <span className="relative z-10 flex items-center gap-2 rounded-full border border-ink-100 bg-white px-4 py-2 text-sm font-semibold text-ink-600 shadow-card">
            <Activity className="h-4 w-4 animate-pulse text-ember-600" />
            {t('map.coverageAnalyzing')}
          </span>
        </div>
      ) : filteredPoints.length === 0 ? (
        <div className="flex h-[400px] flex-col items-center justify-center bg-ink-50 px-5 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-ember-50 text-ember-600">
            <Layers3 className="h-5 w-5" />
          </span>
          <p className="mt-3 max-w-md text-sm font-semibold text-ink-800">{t('map.coverageEmpty')}</p>
          <p className="mt-1 max-w-md text-xs leading-5 text-ink-500">{t('map.coverageSummary')}</p>
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
    const overlay = new google.maps.OverlayView();
    let canvas: HTMLCanvasElement | null = null;

    overlay.onAdd = () => {
      canvas = document.createElement('canvas');
      canvas.style.position = 'absolute';
      canvas.style.pointerEvents = 'none';
      overlay.getPanes()?.overlayLayer.appendChild(canvas);
    };

    overlay.draw = () => {
      if (!canvas) return;
      const projection = overlay.getProjection();
      const mapElement = map.getDiv();
      const width = mapElement.clientWidth;
      const height = mapElement.clientHeight;
      const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.max(1, Math.round(width * pixelRatio));
      canvas.height = Math.max(1, Math.round(height * pixelRatio));
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      canvas.style.left = '0';
      canvas.style.top = '0';

      const context = canvas.getContext('2d');
      if (!context) return;
      context.scale(pixelRatio, pixelRatio);
      context.clearRect(0, 0, width, height);

      for (const point of points) {
        const pixel = projection.fromLatLngToDivPixel(new google.maps.LatLng(point.lat, point.lng));
        if (!pixel || pixel.x < -20 || pixel.y < -20 || pixel.x > width + 20 || pixel.y > height + 20) continue;
        context.beginPath();
        context.arc(pixel.x, pixel.y, point.type === 'restaurant' ? 7 : 5, 0, Math.PI * 2);
        context.fillStyle = point.type === 'restaurant' ? 'rgba(26,26,23,0.72)' : 'rgba(251,79,10,0.38)';
        context.fill();
        context.lineWidth = 1;
        context.strokeStyle = 'rgba(255,255,255,0.75)';
        context.stroke();
      }
    };

    overlay.onRemove = () => {
      canvas?.remove();
      canvas = null;
    };
    overlay.setMap(map);
    return () => overlay.setMap(null);
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
