import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from 'react-leaflet';
import L from 'leaflet';
import { MapPin, Locate, Search, AlertTriangle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import {
  formatDistanceKm,
  getGpsAccuracyMessage,
  haversineKm,
  isCoordinateInAlgeria,
  reverseGeocode,
  searchAddresses,
  watchCurrentPosition,
  type GeoSearchResult,
  type LiveGeoPoint,
} from '../lib/geo';

// Fix default marker icons under bundlers (Leaflet expects CDN assets by default).
const blueIcon = L.divIcon({
  className: 'kiyo-map-pin',
  html: '<div style="background:#ea580c;border:2px solid white;border-radius:50%;width:22px;height:22px;box-shadow:0 2px 8px rgba(0,0,0,.35)"></div>',
  iconSize: [22, 22],
  iconAnchor: [11, 11],
});
const restaurantIcon = L.divIcon({
  className: 'kiyo-map-pin-restaurant',
  html: '<div style="background:#0f172a;border:2px solid white;border-radius:6px;width:22px;height:22px;box-shadow:0 2px 8px rgba(0,0,0,.35)"></div>',
  iconSize: [22, 22],
  iconAnchor: [11, 11],
});
const liveLocationIcon = L.divIcon({
  className: 'kiyo-map-pin-live',
  html: '<div style="position:relative;width:24px;height:24px"><div style="position:absolute;inset:0;border-radius:999px;background:#2563eb;box-shadow:0 0 0 7px rgba(37,99,235,.16)"></div><div style="position:absolute;left:9px;top:-6px;width:0;height:0;border-left:3px solid transparent;border-right:3px solid transparent;border-bottom:11px solid #2563eb;transform-origin:50% 16px"></div><div style="position:absolute;inset:7px;border-radius:999px;background:white"></div></div>',
  iconSize: [24, 24],
  iconAnchor: [12, 12],
});

const ALGERIA_CENTER: [number, number] = [28.0, 2.0];
const ALGERIA_BOUNDS: [[number, number], [number, number]] = [[18.5, -9.0], [37.6, 12.2]];
const GPS_DELIVERY_ACCURACY_LIMIT_METERS = 250;

const TILE_PROVIDERS = {
  osm: {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
  },
  carto: {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
    url: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
  },
};

type Props = {
  restaurantLat?: number | null;
  restaurantLng?: number | null;
  maxDeliveryKm?: number;
  initialAddress?: string;
  onLocationChange: (loc: { lat: number; lng: number; address: string }) => void;
};

export default function DeliveryMap({
  restaurantLat,
  restaurantLng,
  maxDeliveryKm,
  initialAddress,
  onLocationChange,
}: Props) {
  const [pin, setPin] = useState<[number, number] | null>(null);
  const [addressText, setAddressText] = useState(initialAddress ?? '');
  const [search, setSearch] = useState('');
  const [searching, setSearching] = useState(false);
  const [suggestions, setSuggestions] = useState<GeoSearchResult[]>([]);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [gpsWarning, setGpsWarning] = useState<string | null>(null);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [livePosition, setLivePosition] = useState<LiveGeoPoint | null>(null);
  const [tileProvider, setTileProvider] = useState<keyof typeof TILE_PROVIDERS>('osm');
  const [tileErrorCount, setTileErrorCount] = useState(0);
  const mapRef = useRef<L.Map | null>(null);
  const stopWatchingRef = useRef<(() => void) | null>(null);

  const distanceKm = useMemo(() => {
    if (!pin || !restaurantLat || !restaurantLng) return null;
    return haversineKm({ lat: pin[0], lng: pin[1] }, { lat: restaurantLat, lng: restaurantLng });
  }, [pin, restaurantLat, restaurantLng]);

  const outOfZone = !!distanceKm && !!maxDeliveryKm && distanceKm > maxDeliveryKm;

  const setLocation = useCallback(async (lat: number, lng: number, address?: string) => {
    if (!isCoordinateInAlgeria(lat, lng)) {
      setGpsWarning('This location is outside Algeria. Please search or place the pin inside the service area.');
      return;
    }

    setGpsWarning(null);
    setPin([lat, lng]);
    const resolvedAddress = address ?? (await reverseGeocode(lat, lng, document.documentElement.lang || 'fr')).displayName;
    setAddressText(resolvedAddress);
    onLocationChange({ lat, lng, address: resolvedAddress });
  }, [onLocationChange]);

  useEffect(() => {
    const term = search.trim();
    if (term.length < 2) {
      setSuggestions([]);
      return;
    }
    const timer = window.setTimeout(() => {
      setSearching(true);
      searchAddresses(term, document.documentElement.lang || 'fr')
        .then(setSuggestions)
        .finally(() => setSearching(false));
    }, 350);
    return () => window.clearTimeout(timer);
  }, [search]);

  useEffect(() => () => {
    stopWatchingRef.current?.();
  }, []);

  const useGps = () => {
    stopWatchingRef.current?.();
    setGpsLoading(true);
    stopWatchingRef.current = watchCurrentPosition(
      async (pos) => {
        setLivePosition(pos);
        const accuracyWarning = getGpsAccuracyMessage(pos.accuracy);
        setGpsWarning(accuracyWarning);

        if (!pos.accuracy || pos.accuracy <= GPS_DELIVERY_ACCURACY_LIMIT_METERS) {
          await setLocation(pos.lat, pos.lng);
          setGpsWarning(accuracyWarning);
        }

        setGpsLoading(false);
        mapRef.current?.flyTo([pos.lat, pos.lng], 16, { duration: 0.75 });
      },
      () => {
        setPermissionDenied(true);
        setGpsLoading(false);
      },
    );
  };

  function MapClickHandler() {
    useMapEvents({
      click: async (e) => {
        const { lat, lng } = e.latlng;
        await setLocation(lat, lng);
      },
    });
    return null;
  }

  function MapResizeFix() {
    const map = useMap();
    useEffect(() => {
      const timers = [100, 450, 1000].map((delay) =>
        window.setTimeout(() => map.invalidateSize(), delay),
      );
      return () => timers.forEach((timer) => window.clearTimeout(timer));
    }, [map]);
    return null;
  }

  function RestaurantFlyTo() {
    const map = useMap();
    useEffect(() => {
      if (restaurantLat && restaurantLng) {
        map.setView([restaurantLat, restaurantLng], 13);
      }
    }, [map]);
    return null;
  }

  const doSearch = async () => {
    if (!search.trim()) return;
    setSearching(true);
    try {
      const [first] = suggestions.length > 0
        ? suggestions
        : await searchAddresses(search.trim(), document.documentElement.lang || 'fr', 1);
      if (first) {
        await setLocation(first.lat, first.lng, first.label);
        setSuggestions([]);
        mapRef.current?.flyTo([first.lat, first.lng], 15, { duration: 0.75 });
      }
    } finally {
      setSearching(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && doSearch()}
            placeholder="Search address, neighborhood, city..."
            className="kiyo-input pl-10"
            autoComplete="off"
          />
          {suggestions.length > 0 && (
            <div className="absolute z-[1000] mt-1 max-h-56 w-full overflow-auto rounded-xl border border-ink-100 bg-white py-1 shadow-xl">
              {suggestions.map((item) => (
                <button
                  key={`${item.provider}-${item.placeId ?? item.label}`}
                  type="button"
                  onClick={async () => {
                    await setLocation(item.lat, item.lng, item.label);
                    setSearch(item.label);
                    setSuggestions([]);
                    mapRef.current?.flyTo([item.lat, item.lng], 15, { duration: 0.75 });
                  }}
                  className="block w-full px-3 py-2 text-left text-xs text-ink-700 hover:bg-ember-50"
                >
                  {item.label}
                </button>
              ))}
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={useGps}
          disabled={gpsLoading}
          className="kiyo-btn-secondary whitespace-nowrap"
          title="Use current location"
        >
          <Locate className="h-4 w-4" />
          <span className="hidden sm:inline">{gpsLoading ? 'Locating...' : 'GPS'}</span>
        </button>
      </div>

      {searching && (
        <p className="text-xs font-medium text-ink-400">Searching addresses...</p>
      )}

      {permissionDenied && (
        <div className="rounded-lg bg-warning-500/10 px-3 py-2 text-xs text-warning-600">
          Location is unavailable. You can still search or tap the map to pick a delivery point.
        </div>
      )}

      {gpsWarning && (
        <div className="flex items-start gap-2 rounded-lg bg-warning-500/10 px-3 py-2 text-xs text-warning-700">
          <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
          <span>{gpsWarning}</span>
        </div>
      )}

      <div className="relative h-72 w-full overflow-hidden rounded-xl border border-ink-200 sm:h-80">
        <MapContainer
          center={restaurantLat && restaurantLng ? [restaurantLat, restaurantLng] : ALGERIA_CENTER}
          zoom={13}
          minZoom={5}
          maxBounds={ALGERIA_BOUNDS}
          maxBoundsViscosity={0.7}
          scrollWheelZoom={false}
          className="h-full w-full"
          ref={(m) => { mapRef.current = m; }}
        >
          <TileLayer
            attribution={TILE_PROVIDERS[tileProvider].attribution}
            url={TILE_PROVIDERS[tileProvider].url}
            eventHandlers={{
              tileerror: () => {
                setTileErrorCount((count) => {
                  const next = count + 1;
                  if (next >= 3) setTileProvider('carto');
                  return next;
                });
              },
            }}
          />
          <MapResizeFix />
          <MapClickHandler />
          <RestaurantFlyTo />
          {pin && <Marker position={pin} icon={blueIcon} />}
          {livePosition && (
            <>
              <Marker position={[livePosition.lat, livePosition.lng]} icon={liveLocationIcon} />
              {livePosition.accuracy && (
                <Circle center={[livePosition.lat, livePosition.lng]} radius={livePosition.accuracy} kind="accuracy" />
              )}
            </>
          )}
          {restaurantLat && restaurantLng && (
            <Marker position={[restaurantLat, restaurantLng]} icon={restaurantIcon} />
          )}
          {restaurantLat && restaurantLng && maxDeliveryKm && (
            <Circle center={[restaurantLat, restaurantLng]} radius={maxDeliveryKm * 1000} kind="delivery" />
          )}
        </MapContainer>
        {tileErrorCount > 0 && (
          <div className="absolute bottom-2 left-2 z-[1000] max-w-[85%] rounded-lg bg-white/95 px-3 py-2 text-[11px] font-medium text-ink-600 shadow">
            {tileProvider === 'carto'
              ? 'Map fallback is active because the primary tiles were slow.'
              : 'Map tiles are reconnecting. Your selected pin remains safe.'}
          </div>
        )}
      </div>

      {addressText && (
        <div className="rounded-lg bg-ink-50 px-3 py-2 text-xs">
          <div className="flex items-start gap-2">
            <MapPin className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-ember-500" />
            <div className="flex-1">
              <p className="font-medium text-ink-900">{addressText}</p>
              {distanceKm !== null && (
                <p className="mt-0.5 text-ink-500">
                  Distance: {formatDistanceKm(distanceKm)}
                  {maxDeliveryKm ? ` - max ${maxDeliveryKm} km` : ''}
                </p>
              )}
              {livePosition?.accuracy && (
                <p className="mt-0.5 text-ink-400">
                  GPS accuracy: {Math.round(livePosition.accuracy)} m
                  {livePosition.heading != null ? ` - heading ${Math.round(livePosition.heading)} deg` : ''}
                </p>
              )}
            </div>
          </div>
        </div>
      )}
      {outOfZone && (
        <div className="flex items-start gap-2 rounded-lg bg-error-500/10 px-3 py-2 text-xs text-error-600">
          <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
          <span className="font-medium">
            This address is outside the restaurant's delivery zone
            ({distanceKm?.toFixed(1)} km &gt; {maxDeliveryKm} km max). The restaurant may refuse this order.
          </span>
        </div>
      )}
    </div>
  );
}

function Circle(props: { center: [number, number]; radius: number; kind: 'delivery' | 'accuracy' }) {
  const map = useMap();
  useEffect(() => {
    const c = L.circle(props.center, {
      radius: props.radius,
      color: props.kind === 'accuracy' ? '#2563eb' : '#ea580c',
      fillColor: props.kind === 'accuracy' ? '#2563eb' : '#ea580c',
      fillOpacity: props.kind === 'accuracy' ? 0.12 : 0.08,
      weight: 1,
    }).addTo(map);
    return () => { map.removeLayer(c); };
  }, [map, props.center, props.kind, props.radius]);
  return null;
}

export async function saveAddressIfNew(
  loc: { lat: number; lng: number; address: string },
  label: 'home' | 'work' | 'family' | 'other' = 'other',
): Promise<{ ok: true; skipped?: true } | { ok: false; error: string }> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { ok: true, skipped: true };
    const { error } = await supabase.from('saved_addresses').insert({
      customer_id: user.id,
      label,
      address: loc.address,
      latitude: loc.lat,
      longitude: loc.lng,
      is_default: false,
    });
    if (error) throw error;
    return { ok: true };
  } catch (err) {
    console.error('[Kiyo] Failed to save delivery address:', err);
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Address could not be saved.',
    };
  }
}
