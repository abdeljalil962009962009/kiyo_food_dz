import { useEffect, useMemo, useState } from 'react';
import { Circle, MapContainer, Marker, TileLayer, useMap } from 'react-leaflet';
import L from 'leaflet';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import 'leaflet/dist/leaflet.css';
import { useT } from '../lib/i18n-react';
import {
  ALGERIA_LEAFLET_BOUNDS,
  CONSTANTINE_LEAFLET_CENTER,
  MAP_TILE_PROVIDERS,
  nextTileProvider,
  type MapTileProviderKey,
} from '../lib/mapConfig';

export type BackupMapPoint = {
  lat: number;
  lng: number;
  kind: 'restaurant' | 'customer' | 'driver';
  title: string;
};

type Props = {
  points: BackupMapPoint[];
  radiusMeters?: number | null;
  heightClass?: string;
};

const markerIcons: Record<BackupMapPoint['kind'], L.DivIcon> = {
  restaurant: createIcon('#1a1a17', '10px'),
  customer: createIcon('#dc2f02', '999px'),
  driver: createIcon('#2f855a', '999px'),
};

export default function OpenStreetMapDisplay({ points, radiusMeters, heightClass = 'h-[320px]' }: Props) {
  const { t } = useT();
  const validPoints = useMemo(() => points.filter((point) => (
    Number.isFinite(point.lat) && Number.isFinite(point.lng)
  )), [points]);
  const center: [number, number] = validPoints[0]
    ? [validPoints[0].lat, validPoints[0].lng]
    : CONSTANTINE_LEAFLET_CENTER;
  const [tileProvider, setTileProvider] = useState<MapTileProviderKey>('carto');
  const [, setTileErrors] = useState(0);
  const [tilesReady, setTilesReady] = useState(false);
  const [tilesUnavailable, setTilesUnavailable] = useState(false);

  const retry = () => {
    setTileProvider((current) => nextTileProvider(current));
    setTileErrors(0);
    setTilesReady(false);
    setTilesUnavailable(false);
  };

  return (
    <div className={`relative ${heightClass} min-h-56 w-full overflow-hidden rounded-xl border border-ink-200 bg-ink-100 shadow-card`} data-testid="backup-readonly-map">
      <MapContainer
        center={center}
        zoom={validPoints.length > 1 ? 12 : 14}
        minZoom={5}
        maxZoom={20}
        maxBounds={ALGERIA_LEAFLET_BOUNDS}
        maxBoundsViscosity={0.7}
        zoomControl
        scrollWheelZoom
        className="h-full w-full"
      >
        <TileLayer
          key={tileProvider}
          attribution={MAP_TILE_PROVIDERS[tileProvider].attribution}
          url={MAP_TILE_PROVIDERS[tileProvider].url}
          eventHandlers={{
            tileload: () => {
              setTilesReady(true);
              setTilesUnavailable(false);
            },
            tileerror: () => {
              setTileErrors((current) => {
                const next = current + 1;
                if (next === 2 && tileProvider === 'carto') {
                  setTileProvider('osm');
                  setTilesReady(false);
                }
                if (next >= 5 && tileProvider === 'osm') setTilesUnavailable(true);
                return next;
              });
            },
          }}
        />
        <FitBackupBounds points={validPoints} />
        {validPoints.map((point, index) => (
          <Marker
            key={`${point.kind}-${point.lat}-${point.lng}-${index}`}
            position={[point.lat, point.lng]}
            icon={markerIcons[point.kind]}
            title={point.title}
          />
        ))}
        {validPoints[0] && radiusMeters != null && radiusMeters > 0 && (
          <Circle
            center={[validPoints[0].lat, validPoints[0].lng]}
            radius={radiusMeters}
            pathOptions={{ color: '#dc2f02', fillColor: '#dc2f02', fillOpacity: 0.07, weight: 1.5 }}
          />
        )}
      </MapContainer>

      {!tilesReady && !tilesUnavailable && (
        <div className="pointer-events-none absolute inset-0 z-[900] flex items-center justify-center bg-ink-50/80 text-xs font-semibold text-ink-500">
          <span className="flex items-center gap-2"><span className="h-2.5 w-2.5 animate-pulse rounded-full bg-ember-500" />{t('map.loading')}</span>
        </div>
      )}
      {tilesUnavailable && (
        <div className="absolute inset-0 z-[950] flex flex-col items-center justify-center bg-ink-50/95 px-6 text-center">
          <AlertTriangle className="h-6 w-6 text-warning-600" />
          <p className="mt-2 text-sm font-bold text-ink-900">{t('map.loadFailedTitle')}</p>
          <button type="button" onClick={retry} className="kiyo-btn-secondary mt-3 min-h-11 px-4 text-xs">
            <RefreshCw className="h-4 w-4" />{t('error.retry')}
          </button>
        </div>
      )}
      <span className="pointer-events-none absolute bottom-2 right-2 z-[900] rounded-md border border-white/80 bg-white/95 px-2 py-1 text-[10px] font-semibold text-ink-600 shadow-sm">
        {t('map.tileFallbackActive')}
      </span>
    </div>
  );
}

function FitBackupBounds({ points }: { points: BackupMapPoint[] }) {
  const map = useMap();
  useEffect(() => {
    map.invalidateSize({ pan: false });
    if (points.length > 1) {
      map.fitBounds(points.map((point) => [point.lat, point.lng] as [number, number]), { padding: [44, 44], maxZoom: 16 });
    }
  }, [map, points]);
  return null;
}

function createIcon(color: string, radius: string) {
  return L.divIcon({
    className: 'kiyo-leaflet-readonly-marker',
    html: `<span style="display:block;height:34px;width:34px;border:4px solid white;border-radius:${radius};background:${color};box-shadow:0 8px 20px rgba(26,26,23,.25)"></span>`,
    iconSize: [34, 34],
    iconAnchor: [17, 17],
  });
}
