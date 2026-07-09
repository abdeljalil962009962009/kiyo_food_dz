import { useEffect, useMemo, useState } from 'react';
import { MapContainer, TileLayer, Marker, useMap } from 'react-leaflet';
import L from 'leaflet';
import { useT } from '../lib/i18n-react';
import { MAP_TILE_PROVIDERS, nextTileProvider, type MapTileProviderKey } from '../lib/mapConfig';

// Custom high-contrast marker icons for the tracking experience
const customerIcon = L.divIcon({
  className: 'kiyo-map-pin-customer',
  html: `
    <div class="relative flex items-center justify-center">
      <div class="absolute animate-ping h-8 w-8 rounded-full bg-orange-500/30"></div>
      <div class="h-6 w-6 rounded-full bg-orange-600 border-2 border-white shadow-lg flex items-center justify-center text-white text-[10px] font-bold">
        🏠
      </div>
    </div>
  `,
  iconSize: [32, 32],
  iconAnchor: [16, 16],
});

const restaurantIcon = L.divIcon({
  className: 'kiyo-map-pin-restaurant',
  html: `
    <div class="h-6 w-6 rounded-full bg-slate-900 border-2 border-white shadow-lg flex items-center justify-center text-white text-[10px] font-bold">
      🍳
    </div>
  `,
  iconSize: [24, 24],
  iconAnchor: [12, 12],
});

const riderIcon = L.divIcon({
  className: 'kiyo-map-pin-rider',
  html: `
    <div class="relative flex items-center justify-center">
      <div class="absolute animate-pulse h-10 w-10 rounded-full bg-emerald-500/40"></div>
      <div class="h-7 w-7 rounded-full bg-emerald-500 border-2 border-white shadow-lg flex items-center justify-center text-white text-xs font-bold transform transition-all duration-300">
        🛵
      </div>
    </div>
  `,
  iconSize: [36, 36],
  iconAnchor: [18, 18],
});

// Helper component to auto-pan and zoom map to fit all markers elegantly
function FitMapBounds({ points }: { points: [number, number][] }) {
  const map = useMap();
  useEffect(() => {
    if (points.length === 0) return;
    // Filter out invalid coords
    const validPoints = points.filter(p => !isNaN(p[0]) && !isNaN(p[1]) && p[0] !== 0);
    if (validPoints.length === 0) return;
    
    const bounds = L.latLngBounds(validPoints);
    map.fitBounds(bounds, {
      padding: [40, 40],
      maxZoom: 16,
      animate: true,
      duration: 1.2
    });
  }, [map, points]);
  return null;
}

function MapResizeFix() {
  const map = useMap();
  useEffect(() => {
    const timers = [100, 450, 1000].map((delay) => window.setTimeout(() => map.invalidateSize(), delay));
    return () => timers.forEach((timer) => window.clearTimeout(timer));
  }, [map]);
  return null;
}

type TrackingMapProps = {
  restaurantLat: number;
  restaurantLng: number;
  deliveryLat: number;
  deliveryLng: number;
  driverLat?: number | null;
  driverLng?: number | null;
  status: string;
};

export default function TrackingMap({
  restaurantLat,
  restaurantLng,
  deliveryLat,
  deliveryLng,
  driverLat,
  driverLng,
  status
}: TrackingMapProps) {
  const { t } = useT();
  const [tileProvider, setTileProvider] = useState<MapTileProviderKey>('carto');
  const [tilesReady, setTilesReady] = useState(false);
  
  // Collect all coordinates for the map bounds
  const mapPoints = useMemo(() => {
    const pts: [number, number][] = [
      [restaurantLat, restaurantLng],
      [deliveryLat, deliveryLng]
    ];
    if (driverLat != null && driverLng != null && driverLat !== 0) {
      pts.push([driverLat, driverLng]);
    }
    return pts;
  }, [restaurantLat, restaurantLng, deliveryLat, deliveryLng, driverLat, driverLng]);

  // Fallback default center is Constantine, Algeria
  const center: [number, number] = useMemo(() => {
    if (driverLat != null && driverLng != null && driverLat !== 0) {
      return [driverLat, driverLng];
    }
    return [restaurantLat || 36.3650, restaurantLng || 6.6147];
  }, [restaurantLat, restaurantLng, driverLat, driverLng]);

  return (
    <div className="relative h-[280px] w-full overflow-hidden rounded-xl border border-ink-100 shadow-sm bg-ink-50">
      <MapContainer
        center={center}
        zoom={14}
        scrollWheelZoom={false}
        className="h-full w-full z-10"
      >
        <TileLayer
          attribution={MAP_TILE_PROVIDERS[tileProvider].attribution}
          url={MAP_TILE_PROVIDERS[tileProvider].url}
          eventHandlers={{
            tileload: () => setTilesReady(true),
            tileerror: () => setTileProvider(nextTileProvider),
          }}
        />
        <MapResizeFix />
        
        {/* Restaurant Pin */}
        <Marker position={[restaurantLat, restaurantLng]} icon={restaurantIcon} />
        
        {/* Customer Delivery Pin */}
        <Marker position={[deliveryLat, deliveryLng]} icon={customerIcon} />
        
        {/* Driver Pin (Show only if assigned or en route) */}
        {driverLat != null && driverLng != null && driverLat !== 0 && (
          <Marker position={[driverLat, driverLng]} icon={riderIcon} />
        )}
        
        {/* Auto fit layout to show all active objects */}
        <FitMapBounds points={mapPoints} />
      </MapContainer>
      {!tilesReady && (
        <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center bg-ink-50/80 text-xs font-semibold text-ink-500">
          {t('map.loading')}
        </div>
      )}
      
      {/* Small floating HUD */}
      <div className="absolute bottom-2 left-2 z-20 rounded-lg bg-white/95 backdrop-blur-sm px-2.5 py-1 text-[10px] font-bold text-ink-800 shadow-md border border-ink-100 flex items-center gap-1.5">
        <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
        <span>
          {status === 'out_for_delivery' || status === 'delivering'
            ? t('map.trackingRiderEnRoute')
            : status === 'preparing'
            ? t('map.trackingPreparing')
            : t('map.trackingLive')}
        </span>
      </div>
    </div>
  );
}
