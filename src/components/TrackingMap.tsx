/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useMemo } from 'react';
import { APIProvider, Map, AdvancedMarker, useMap, useMapsLibrary } from '@vis.gl/react-google-maps';
import { useT } from '../lib/i18n-react';
import { AlertTriangle } from 'lucide-react';

const API_KEY =
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  process.env.GOOGLE_MAPS_PLATFORM_KEY ||
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (import.meta as any).env?.VITE_GOOGLE_MAPS_PLATFORM_KEY ||
  (globalThis as any).GOOGLE_MAPS_PLATFORM_KEY ||
  '';
const hasValidKey = Boolean(API_KEY) && API_KEY !== 'YOUR_API_KEY';

type TrackingMapProps = {
  restaurantLat: number;
  restaurantLng: number;
  deliveryLat: number;
  deliveryLng: number;
  driverLat?: number | null;
  driverLng?: number | null;
  status: string;
};

// Auto-fit bounds logic
function FitMapBounds({ points }: { points: [number, number][] }) {
  const map = useMap();
  const maps = useMapsLibrary('core');
  
  useEffect(() => {
    if (!map || !maps || points.length === 0) return;
    
    const validPoints = points.filter(p => !isNaN(p[0]) && !isNaN(p[1]) && p[0] !== 0);
    if (validPoints.length === 0) return;
    
    const bounds = new maps.LatLngBounds();
    validPoints.forEach(p => {
      bounds.extend({ lat: p[0], lng: p[1] });
    });
    
    map.fitBounds(bounds, 40); // 40px padding
  }, [map, maps, points]);
  return null;
}

export default function TrackingMapWrapper(props: TrackingMapProps) {
  if (!hasValidKey) {
    return (
      <div className="flex h-[280px] flex-col items-center justify-center rounded-xl border border-warning-200 bg-warning-50 px-4 text-center">
        <AlertTriangle className="mb-2 h-6 w-6 text-warning-500" />
        <p className="text-sm text-warning-700">Google Maps API key missing.</p>
      </div>
    );
  }

  return (
    <APIProvider apiKey={API_KEY} version="weekly">
      <TrackingMapInner {...props} />
    </APIProvider>
  );
}

function TrackingMapInner({
  restaurantLat,
  restaurantLng,
  deliveryLat,
  deliveryLng,
  driverLat,
  driverLng,
  status
}: TrackingMapProps) {
  const { t } = useT();
  
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
  const center = useMemo(() => {
    if (driverLat != null && driverLng != null && driverLat !== 0) {
      return { lat: driverLat, lng: driverLng };
    }
    return { lat: restaurantLat || 36.3650, lng: restaurantLng || 6.6147 };
  }, [restaurantLat, restaurantLng, driverLat, driverLng]);

  return (
    <div className="relative h-[280px] w-full overflow-hidden rounded-xl border border-ink-100 bg-ink-50 shadow-sm">
      <Map
        defaultCenter={center}
        defaultZoom={14}
        mapId="TRACKING_MAP_ID"
        gestureHandling="greedy"
        disableDefaultUI
        internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
        style={{ width: '100%', height: '100%' }}
      >
        {/* Restaurant Pin */}
        <AdvancedMarker position={{ lat: restaurantLat, lng: restaurantLng }} title="Restaurant" zIndex={1}>
          <div className="flex h-7 w-7 items-center justify-center rounded-lg border-2 border-white bg-slate-900 text-[11px] text-white shadow-md">
            🍳
          </div>
        </AdvancedMarker>
        
        {/* Customer Delivery Pin */}
        <AdvancedMarker position={{ lat: deliveryLat, lng: deliveryLng }} title="Delivery" zIndex={2}>
          <div className="relative flex items-center justify-center">
            <div className="absolute h-8 w-8 animate-ping rounded-full bg-ember-500/30" />
            <div className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-white bg-ember-600 text-[11px] text-white shadow-lg">
              🏠
            </div>
          </div>
        </AdvancedMarker>
        
        {/* Driver Pin (Show only if assigned or en route) */}
        {driverLat != null && driverLng != null && driverLat !== 0 && (
          <AdvancedMarker position={{ lat: driverLat, lng: driverLng }} title="Rider" zIndex={3}>
            <div className="relative flex items-center justify-center transition-all duration-500">
              <div className="absolute h-10 w-10 animate-pulse rounded-full bg-emerald-500/40" />
              <div className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-white bg-emerald-500 text-sm text-white shadow-lg">
                🛵
              </div>
            </div>
          </AdvancedMarker>
        )}
        
        {/* Auto fit layout to show all active objects */}
        <FitMapBounds points={mapPoints} />
      </Map>
      
      {/* Small floating HUD */}
      <div className="absolute bottom-2 left-2 z-20 flex items-center gap-1.5 rounded-lg border border-ink-100 bg-white/95 px-2.5 py-1 text-[10px] font-bold text-ink-800 shadow-md backdrop-blur-sm">
        <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" />
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
