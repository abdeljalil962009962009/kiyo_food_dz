import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from 'react-leaflet';
import L from 'leaflet';
import { MapPin, Locate, Search, AlertTriangle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import {
  formatDistanceKm,
  haversineKm,
  isCoordinateInAlgeria,
  isUsableAccuracy,
  requestBestCurrentPosition,
  reverseGeocode,
  searchAddresses,
  type GeoSearchResult,
  type LocationCapturePurpose,
  type LiveGeoPoint,
} from '../lib/geo';
import { useT } from '../lib/i18n-react';
import { ALGERIA_MAP_BOUNDS, ALGERIA_MAP_CENTER, MAP_TILE_PROVIDERS, nextTileProvider, type MapTileProviderKey } from '../lib/mapConfig';

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

type Props = {
  restaurantLat?: number | null;
  restaurantLng?: number | null;
  maxDeliveryKm?: number;
  initialAddress?: string;
  purpose?: LocationCapturePurpose;
  onLocationChange: (loc: DeliveryMapLocation) => void;
};

export type DeliveryMapLocation = {
  lat: number;
  lng: number;
  address: string;
  accuracy: number | null;
  source: LiveGeoPoint['source'] | 'search' | 'manual';
  confirmed: boolean;
};

export default function DeliveryMap({
  restaurantLat,
  restaurantLng,
  maxDeliveryKm,
  initialAddress,
  purpose = 'customer',
  onLocationChange,
}: Props) {
  const { t, locale } = useT();
  const isRtl = locale === 'ar';
  const [pin, setPin] = useState<[number, number] | null>(null);
  const [addressText, setAddressText] = useState(initialAddress ?? '');
  const [search, setSearch] = useState('');
  const [searching, setSearching] = useState(false);
  const [suggestions, setSuggestions] = useState<GeoSearchResult[]>([]);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [gpsWarning, setGpsWarning] = useState<string | null>(null);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [improvingGps, setImprovingGps] = useState(false);
  const [livePosition, setLivePosition] = useState<LiveGeoPoint | null>(null);
  const [currentLocation, setCurrentLocation] = useState<DeliveryMapLocation | null>(null);
  const [tileProvider, setTileProvider] = useState<MapTileProviderKey>('carto');
  const [tilesReady, setTilesReady] = useState(false);
  const [tileErrorCount, setTileErrorCount] = useState(0);
  const mapRef = useRef<L.Map | null>(null);
  const stopWatchingRef = useRef<(() => void) | null>(null);

  const distanceKm = useMemo(() => {
    if (!pin || !restaurantLat || !restaurantLng) return null;
    return haversineKm({ lat: pin[0], lng: pin[1] }, { lat: restaurantLat, lng: restaurantLng });
  }, [pin, restaurantLat, restaurantLng]);

  const outOfZone = !!distanceKm && !!maxDeliveryKm && distanceKm > maxDeliveryKm;

  const setLocation = useCallback(async (
    lat: number,
    lng: number,
    address?: string,
    meta: {
      accuracy?: number | null;
      source?: DeliveryMapLocation['source'];
      confirmed?: boolean;
    } = {},
  ) => {
    if (!isCoordinateInAlgeria(lat, lng)) {
      setGpsWarning(t('map.locationOutsideAlgeria'));
      return;
    }

    setGpsWarning(null);
    setPin([lat, lng]);
    const resolvedAddress = address ?? (await reverseGeocode(lat, lng, document.documentElement.lang || 'fr')).displayName;
    const next: DeliveryMapLocation = {
      lat,
      lng,
      address: resolvedAddress,
      accuracy: meta.accuracy ?? null,
      source: meta.source ?? 'manual',
      confirmed: meta.confirmed ?? false,
    };
    setAddressText(resolvedAddress);
    setCurrentLocation(next);
    onLocationChange(next);
  }, [onLocationChange, t]);

  const getAccuracyWarning = useCallback((accuracy: number | null | undefined) => {
    if (!accuracy || accuracy <= 80) return null;
    if (accuracy <= 250) return t('map.gpsWeak');
    return t('map.gpsApproximate');
  }, [t]);

  const confirmPin = () => {
    if (!currentLocation) return;
    if (
      purpose === 'restaurant' &&
      currentLocation.source !== 'manual' &&
      !isUsableAccuracy(currentLocation.accuracy, 'restaurant')
    ) {
      setGpsWarning(t('map.restaurantConfirmRequired'));
      return;
    }
    const confirmed = {
      ...currentLocation,
      confirmed: true,
      accuracy: currentLocation.source === 'manual' ? null : currentLocation.accuracy ?? livePosition?.accuracy ?? null,
    };
    setCurrentLocation(confirmed);
    setGpsWarning(null);
    onLocationChange(confirmed);
  };

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
    setImprovingGps(true);
    setPermissionDenied(false);
    stopWatchingRef.current = requestBestCurrentPosition({
      purpose,
      onCandidate: (pos) => {
        setLivePosition(pos);
        setGpsWarning(getAccuracyWarning(pos.accuracy) ?? t('map.improvingAccuracy'));
        mapRef.current?.flyTo([pos.lat, pos.lng], 16, { duration: 0.75 });
      },
      onResult: async ({ point, accepted }) => {
        setLivePosition(point);
        const confirmed = accepted && purpose !== 'restaurant';
        await setLocation(point.lat, point.lng, undefined, {
          accuracy: point.accuracy,
          source: point.source,
          confirmed,
        });
        setGpsWarning(accepted
          ? (confirmed ? null : t('map.restaurantConfirmRequired'))
          : t('map.confirmWeakGps'));
        setGpsLoading(false);
        setImprovingGps(false);
        mapRef.current?.flyTo([point.lat, point.lng], 16, { duration: 0.75 });
      },
      onError: () => {
        setPermissionDenied(true);
        setGpsLoading(false);
        setImprovingGps(false);
      },
    });
  };

  const updateDraggedPin = async (marker: L.Marker) => {
    const { lat, lng } = marker.getLatLng();
    await setLocation(lat, lng, undefined, { source: 'manual', accuracy: null, confirmed: false });
    setGpsWarning(t('map.confirmDraggedPin'));
  };

  function MapClickHandler() {
    useMapEvents({
      click: async (e) => {
        const { lat, lng } = e.latlng;
        await setLocation(lat, lng, undefined, { source: 'manual', confirmed: false });
        setGpsWarning(t('map.confirmDraggedPin'));
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
        await setLocation(first.lat, first.lng, first.label, { source: 'search', confirmed: false });
        setGpsWarning(t('map.confirmSearchPin'));
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
          <Search className={`pointer-events-none absolute top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400 ${isRtl ? 'right-3' : 'left-3'}`} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && doSearch()}
            placeholder={t('map.searchPlaceholder')}
            className={`kiyo-input ${isRtl ? 'pr-10 text-right' : 'pl-10'}`}
            autoComplete="off"
            dir={isRtl ? 'rtl' : 'ltr'}
          />
          {suggestions.length > 0 && (
            <div className="absolute z-[1000] mt-1 max-h-56 w-full overflow-auto rounded-xl border border-ink-100 bg-white py-1 shadow-xl">
              {suggestions.map((item) => (
                <button
                  key={`${item.provider}-${item.placeId ?? item.label}`}
                  type="button"
                  onClick={async () => {
                    await setLocation(item.lat, item.lng, item.label, { source: 'search', confirmed: false });
                    setGpsWarning(t('map.confirmSearchPin'));
                    setSearch(item.label);
                    setSuggestions([]);
                    mapRef.current?.flyTo([item.lat, item.lng], 15, { duration: 0.75 });
                  }}
                  className={`block w-full px-3 py-2 text-xs text-ink-700 hover:bg-ember-50 ${isRtl ? 'text-right' : 'text-left'}`}
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
          title={t('map.useCurrentLocation')}
        >
          <Locate className="h-4 w-4" />
          <span className="hidden sm:inline">{gpsLoading ? t('map.locating') : t('map.gps')}</span>
        </button>
      </div>

      {searching && (
        <p className="text-xs font-medium text-ink-400">{t('map.searching')}</p>
      )}
      {improvingGps && (
        <p className="text-xs font-medium text-sage-700">{t('map.improvingAccuracy')}</p>
      )}

      {permissionDenied && (
        <div className="rounded-lg bg-warning-500/10 px-3 py-2 text-xs text-warning-600">
          {t('map.locationUnavailable')}
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
          center={restaurantLat && restaurantLng ? [restaurantLat, restaurantLng] : ALGERIA_MAP_CENTER}
          zoom={restaurantLat && restaurantLng ? 13 : 5}
          minZoom={5}
          maxBounds={ALGERIA_MAP_BOUNDS}
          maxBoundsViscosity={0.7}
          scrollWheelZoom={false}
          className="h-full w-full"
          ref={(m) => { mapRef.current = m; }}
        >
          <TileLayer
            attribution={MAP_TILE_PROVIDERS[tileProvider].attribution}
            url={MAP_TILE_PROVIDERS[tileProvider].url}
            eventHandlers={{
              tileload: () => setTilesReady(true),
              tileerror: () => {
                setTileErrorCount((count) => {
                  const next = count + 1;
                  if (next >= 2) setTileProvider(nextTileProvider);
                  return next;
                });
              },
            }}
          />
          <MapResizeFix />
          <MapClickHandler />
          <RestaurantFlyTo />
          {pin && (
            <Marker
              position={pin}
              icon={blueIcon}
              draggable
              eventHandlers={{
                dragend: (event) => {
                  void updateDraggedPin(event.target as L.Marker);
                },
              }}
            />
          )}
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
        {!tilesReady && (
          <div className="pointer-events-none absolute inset-0 z-[900] flex items-center justify-center bg-ink-50/80 text-xs font-semibold text-ink-500">
            {t('map.loading')}
          </div>
        )}
        {tileErrorCount > 0 && (
          <div className="absolute bottom-2 left-2 z-[1000] max-w-[85%] rounded-lg bg-white/95 px-3 py-2 text-[11px] font-medium text-ink-600 shadow">
            {tileProvider === 'carto'
              ? t('map.tileFallbackActive')
              : t('map.tileReconnecting')}
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
                  {t('map.distance')}: {formatDistanceKm(distanceKm)}
                  {maxDeliveryKm ? ` - ${t('map.max')} ${maxDeliveryKm} km` : ''}
                </p>
              )}
              {livePosition?.accuracy && (
                <p className="mt-0.5 text-ink-400">
                  {t('map.gpsAccuracy')}: {Math.round(livePosition.accuracy)} m
                  {livePosition.heading != null ? ` - ${t('map.heading')} ${Math.round(livePosition.heading)} deg` : ''}
                </p>
              )}
              {currentLocation && (
                <p className={`mt-0.5 font-semibold ${currentLocation.confirmed ? 'text-sage-700' : 'text-warning-700'}`}>
                  {currentLocation.confirmed ? t('map.pinConfirmed') : t('map.pinNeedsConfirmation')}
                </p>
              )}
            </div>
          </div>
          {currentLocation && !currentLocation.confirmed && (
            <button
              type="button"
              onClick={confirmPin}
              className="mt-3 w-full rounded-lg bg-ink-900 px-3 py-2 text-xs font-bold text-white transition-colors hover:bg-ink-700"
            >
              {t('map.confirmPin')}
            </button>
          )}
        </div>
      )}
      {outOfZone && (
        <div className="flex items-start gap-2 rounded-lg bg-error-500/10 px-3 py-2 text-xs text-error-600">
          <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
          <span className="font-medium">
            {t('map.outsideZone')} ({distanceKm?.toFixed(1)} km &gt; {maxDeliveryKm} km {t('map.max')}).
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
  loc: { lat: number; lng: number; address: string; accuracy?: number | null },
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
      accuracy_m: loc.accuracy ?? null,
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
