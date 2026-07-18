import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import {
  Circle,
  MapContainer,
  Marker,
  TileLayer,
  useMap,
  useMapEvents,
} from 'react-leaflet';
import L from 'leaflet';
import { AlertTriangle, CheckCircle2, LocateFixed, MapPin, Navigation, RefreshCw, Search } from 'lucide-react';
import 'leaflet/dist/leaflet.css';
import {
  GEOLOCATION_DEFAULT_OPTIONS,
  classifyGeolocationError,
  formatDistanceKm,
  getAccuracyQuality,
  haversineKm,
  isCoordinateInAlgeria,
  isUsableAccuracy,
  requestBestCurrentPosition,
  reverseGeocode,
  searchAddresses,
  type GeoSearchResult,
  type LiveGeoPoint,
} from '../lib/geo';
import { useT } from '../lib/i18n-react';
import type { TranslationKey } from '../lib/i18n';
import {
  LAST_MAP_STATE_STORAGE_KEY,
  restoreLastMapState,
  saveLastMapState,
  type DeliveryLocation,
} from '../lib/location';
import {
  ALGERIA_LEAFLET_BOUNDS,
  CONSTANTINE_LEAFLET_CENTER,
  MAP_TILE_PROVIDERS,
  nextTileProvider,
  type MapTileProviderKey,
} from '../lib/mapConfig';

export type OpenStreetMapPickerProps = {
  restaurantLat?: number | null;
  restaurantLng?: number | null;
  maxDeliveryKm?: number;
  initialAddress?: string;
  initialLocation?: DeliveryLocation | null;
  purpose?: 'customer' | 'restaurant' | 'driver';
  gpsFirst?: boolean;
  onLocationChange: (location: DeliveryLocation) => void;
};

type ViewTarget = {
  center: [number, number];
  zoom: number;
  nonce: number;
};

const selectionIcon = L.divIcon({
  className: 'kiyo-leaflet-pin',
  html: '<div style="display:flex;height:42px;width:42px;align-items:center;justify-content:center;border:4px solid white;border-radius:999px;background:#dc2f02;color:white;box-shadow:0 8px 22px rgba(26,26,23,.28)"><span style="height:10px;width:10px;border:2px solid white;border-radius:999px"></span></div>',
  iconSize: [42, 42],
  iconAnchor: [21, 21],
});

const restaurantIcon = L.divIcon({
  className: 'kiyo-leaflet-restaurant',
  html: '<div style="height:34px;width:34px;border:4px solid white;border-radius:10px;background:#1a1a17;box-shadow:0 8px 20px rgba(26,26,23,.25)"></div>',
  iconSize: [34, 34],
  iconAnchor: [17, 17],
});

export default function OpenStreetMapPicker({
  restaurantLat,
  restaurantLng,
  maxDeliveryKm,
  initialAddress,
  initialLocation,
  purpose = 'customer',
  gpsFirst = false,
  onLocationChange,
}: OpenStreetMapPickerProps) {
  const { t, locale } = useT();
  const isRtl = locale === 'ar';
  const [initialSnapshot] = useState<DeliveryLocation | null>(() => {
    if (initialLocation) return initialLocation;
    if (typeof window === 'undefined') return null;
    return restoreLastMapState(localStorage.getItem(LAST_MAP_STATE_STORAGE_KEY));
  });
  const restaurantPosition = useMemo<[number, number] | null>(() => (
    Number.isFinite(restaurantLat) && Number.isFinite(restaurantLng)
      ? [restaurantLat as number, restaurantLng as number]
      : null
  ), [restaurantLat, restaurantLng]);
  const initialCenter: [number, number] = initialSnapshot
    ? [initialSnapshot.lat, initialSnapshot.lng]
    : restaurantPosition ?? CONSTANTINE_LEAFLET_CENTER;

  const [selectedLocation, setSelectedLocation] = useState<DeliveryLocation | null>(initialLocation ?? initialSnapshot);
  const [pin, setPin] = useState<[number, number] | null>(initialSnapshot ? [initialSnapshot.lat, initialSnapshot.lng] : null);
  const [livePosition, setLivePosition] = useState<LiveGeoPoint | null>(null);
  const [viewTarget, setViewTarget] = useState<ViewTarget>({ center: initialCenter, zoom: initialSnapshot ? 17 : 12, nonce: 0 });
  const [search, setSearch] = useState('');
  const [suggestions, setSuggestions] = useState<GeoSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [tileProvider, setTileProvider] = useState<MapTileProviderKey>('carto');
  const [, setTileErrors] = useState(0);
  const [tilesReady, setTilesReady] = useState(false);
  const [tilesUnavailable, setTilesUnavailable] = useState(false);
  const cancelGpsRef = useRef<(() => void) | null>(null);
  const gestureVersionRef = useRef(0);
  const selectedSearchRef = useRef<string | null>(null);

  const publishLocation = useCallback((location: DeliveryLocation) => {
    setSelectedLocation(location);
    setPin([location.lat, location.lng]);
    saveLastMapState(location);
    onLocationChange(location);
  }, [onLocationChange]);

  const resolveLocation = useCallback(async ({
    lat,
    lng,
    source,
    accuracy,
    address,
    placeId,
  }: {
    lat: number;
    lng: number;
    source: DeliveryLocation['source'];
    accuracy: number | null;
    address?: string;
    placeId?: string | null;
  }) => {
    if (!isCoordinateInAlgeria(lat, lng)) {
      setNotice(t('map.locationOutsideAlgeria'));
      return;
    }
    setSearching(true);
    try {
      const parts = await reverseGeocode(lat, lng, locale);
      const weakGps = (source === 'gps' || source === 'network') && !isUsableAccuracy(accuracy, purpose);
      const requiresManualAdjustment = source === 'search' || weakGps;
      const location: DeliveryLocation = {
        lat,
        lng,
        address: address || parts.displayName,
        accuracy,
        source,
        confirmed: false,
        placeId: placeId ?? parts.placeId ?? null,
        addressQuality: source === 'manual' ? 'manual' : 'approximate',
        addressParts: parts,
        requiresManualAdjustment,
      };
      publishLocation(location);
      setNotice(requiresManualAdjustment
        ? source === 'search' ? t('map.addressApproximate') : t('map.gpsWeakAction')
        : source === 'manual' ? t('map.confirmDraggedPin') : t('map.confirmGpsPin'));
    } catch {
      setNotice(t('map.addressNotFound'));
    } finally {
      setSearching(false);
    }
  }, [locale, publishLocation, purpose, t]);

  useEffect(() => () => cancelGpsRef.current?.(), []);

  useEffect(() => {
    const query = search.trim();
    if (selectedSearchRef.current === query || query.length < 2) {
      setSuggestions([]);
      return;
    }
    const timer = window.setTimeout(async () => {
      setSearching(true);
      setSearchError(null);
      try {
        const results = await searchAddresses(query, locale, 6);
        setSuggestions(results);
        if (results.length === 0) setSearchError(t('map.addressNotFound'));
      } catch {
        setSuggestions([]);
        setSearchError(t('map.searchUnavailable'));
      } finally {
        setSearching(false);
      }
    }, 360);
    return () => window.clearTimeout(timer);
  }, [locale, search, t]);

  const stopForManualInteraction = useCallback(() => {
    gestureVersionRef.current += 1;
    cancelGpsRef.current?.();
    cancelGpsRef.current = null;
    setGpsLoading(false);
  }, []);

  const selectManualPoint = useCallback((lat: number, lng: number) => {
    stopForManualInteraction();
    void resolveLocation({ lat, lng, source: 'manual', accuracy: null });
  }, [resolveLocation, stopForManualInteraction]);

  const selectSearchResult = useCallback((result: GeoSearchResult) => {
    selectedSearchRef.current = result.label;
    setSearch(result.label);
    setSuggestions([]);
    void resolveLocation({
      lat: result.lat,
      lng: result.lng,
      source: 'search',
      accuracy: null,
      address: result.label,
      placeId: result.placeId ?? null,
    });
    setViewTarget((current) => ({ center: [result.lat, result.lng], zoom: 17, nonce: current.nonce + 1 }));
  }, [resolveLocation]);

  const submitSearch = useCallback(async (event: FormEvent) => {
    event.preventDefault();
    if (suggestions[0]) {
      selectSearchResult(suggestions[0]);
      return;
    }
    const query = search.trim();
    if (query.length < 2) return;
    setSearching(true);
    setSearchError(null);
    try {
      const [result] = await searchAddresses(query, locale, 1);
      if (!result) {
        setSearchError(t('map.addressNotFound'));
        return;
      }
      selectSearchResult(result);
    } catch {
      setSearchError(t('map.searchUnavailable'));
    } finally {
      setSearching(false);
    }
  }, [locale, search, selectSearchResult, suggestions, t]);

  const locateWithGps = useCallback(() => {
    const gestureVersion = gestureVersionRef.current;
    cancelGpsRef.current?.();
    setGpsLoading(true);
    setNotice(t('map.improvingAccuracy'));
    cancelGpsRef.current = requestBestCurrentPosition({
      purpose,
      waitMs: purpose === 'restaurant' ? 18000 : 15000,
      options: GEOLOCATION_DEFAULT_OPTIONS,
      onCandidate: setLivePosition,
      onResult: ({ point, accepted }) => {
        cancelGpsRef.current = null;
        setGpsLoading(false);
        setLivePosition(point);
        if (gestureVersion !== gestureVersionRef.current) return;
        void resolveLocation({
          lat: point.lat,
          lng: point.lng,
          source: point.source,
          accuracy: point.accuracy,
        });
        setViewTarget((current) => ({
          center: [point.lat, point.lng],
          zoom: accepted ? 17 : point.accuracy != null && point.accuracy > 1000 ? 12 : 14,
          nonce: current.nonce + 1,
        }));
      },
      onError: (error) => {
        cancelGpsRef.current = null;
        setGpsLoading(false);
        setNotice(fallbackGeolocationMessage(error, t));
      },
    });
  }, [purpose, resolveLocation, t]);

  const confirmPin = useCallback(() => {
    if (!selectedLocation || selectedLocation.requiresManualAdjustment) return;
    const confirmed: DeliveryLocation = {
      ...selectedLocation,
      confirmed: true,
      confirmedAt: new Date().toISOString(),
    };
    setSelectedLocation(confirmed);
    onLocationChange(confirmed);
    setNotice(null);
  }, [onLocationChange, selectedLocation]);

  const distanceKm = useMemo(() => (
    selectedLocation && restaurantPosition
      ? haversineKm(selectedLocation, { lat: restaurantPosition[0], lng: restaurantPosition[1] })
      : null
  ), [restaurantPosition, selectedLocation]);
  const accuracyPoint = livePosition ?? (
    selectedLocation && (selectedLocation.source === 'gps' || selectedLocation.source === 'network')
      ? { lat: selectedLocation.lat, lng: selectedLocation.lng, accuracy: selectedLocation.accuracy }
      : null
  );
  const outOfZone = distanceKm != null && maxDeliveryKm != null && distanceKm > maxDeliveryKm;
  const canConfirm = selectedLocation != null && !selectedLocation.requiresManualAdjustment && !outOfZone;
  const accuracyQuality = getAccuracyQuality(accuracyPoint?.accuracy);

  const retryTiles = () => {
    setTileProvider((current) => nextTileProvider(current));
    setTileErrors(0);
    setTilesReady(false);
    setTilesUnavailable(false);
  };

  return (
    <section className="overflow-hidden rounded-xl border border-warning-200 bg-white shadow-card" aria-label={t('map.locationSelector')} data-testid="backup-location-picker">
      <div className="flex min-h-11 items-center gap-2 border-b border-warning-200 bg-warning-50 px-3 py-2 text-xs font-semibold text-warning-800" role="status">
        <AlertTriangle className="h-4 w-4 flex-none" />
        <span>{t('map.tileFallbackActive')}</span>
      </div>

      <div className="border-b border-ink-100 p-3 sm:p-4">
        {gpsFirst && (
          <button type="button" onClick={locateWithGps} disabled={gpsLoading} className="kiyo-btn-primary mb-2 min-h-12 w-full sm:hidden">
            <LocateFixed className={`h-4 w-4 ${gpsLoading ? 'animate-pulse' : ''}`} />
            {gpsLoading ? t('map.locating') : t('map.useCurrentLocation')}
          </button>
        )}
        <form onSubmit={submitSearch} className="flex gap-2">
          <div className="relative min-w-0 flex-1">
            <Search className={`pointer-events-none absolute top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-ink-400 ${isRtl ? 'right-3.5' : 'left-3.5'}`} />
            <input
              value={search}
              onChange={(event) => {
                selectedSearchRef.current = null;
                setSearch(event.target.value);
                setSearchError(null);
              }}
              placeholder={t('map.searchPlaceholder')}
              aria-label={t('map.searchPlaceholder')}
              dir={isRtl ? 'rtl' : 'ltr'}
              autoComplete="off"
              className={`kiyo-input h-12 py-2.5 ${isRtl ? 'pr-10 text-right' : 'pl-10'}`}
            />
            {suggestions.length > 0 && (
              <div className="absolute inset-x-0 top-full z-[1200] mt-1 max-h-64 overflow-y-auto rounded-lg border border-ink-100 bg-white p-1 shadow-card-lg" role="listbox">
                {suggestions.map((result) => (
                  <button
                    key={`${result.provider}-${result.placeId ?? result.label}`}
                    type="button"
                    onClick={() => selectSearchResult(result)}
                    className={`flex min-h-11 w-full items-start gap-2 rounded-md px-3 py-3 text-sm hover:bg-ink-50 ${isRtl ? 'text-right' : 'text-left'}`}
                    role="option"
                    aria-selected="false"
                  >
                    <MapPin className="mt-0.5 h-4 w-4 flex-none text-ember-600" />
                    <span className="line-clamp-2">{result.label}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
          <button type="button" onClick={locateWithGps} disabled={gpsLoading} className={`kiyo-btn-secondary h-12 min-h-12 w-12 shrink-0 px-0 sm:w-auto sm:min-w-44 sm:px-4 ${gpsFirst ? 'hidden sm:inline-flex' : ''}`} aria-label={t('map.useCurrentLocation')}>
            <LocateFixed className={`h-4 w-4 ${gpsLoading ? 'animate-pulse' : ''}`} />
            <span className="hidden sm:inline">{gpsLoading ? t('map.locating') : t('map.useCurrentLocation')}</span>
          </button>
        </form>
        {(searching || searchError) && (
          <p className={`mt-2 text-xs font-medium ${searchError ? 'text-error-600' : 'text-ink-500'}`} role="status">
            {searchError || t('map.searching')}
          </p>
        )}
      </div>

      <div className="relative h-[clamp(220px,42dvh,440px)] min-h-[220px] w-full bg-ink-100 [@media(max-height:650px)]:h-[150px] [@media(max-height:650px)]:min-h-[150px] sm:h-[440px]" data-testid="backup-map-canvas">
        <MapContainer
          center={initialCenter}
          zoom={initialSnapshot ? 17 : 12}
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
          <FallbackMapResize />
          <FallbackMapView target={viewTarget} />
          <FallbackMapEvents onManualPoint={selectManualPoint} onInteractionStart={stopForManualInteraction} />
          {pin && (
            <Marker
              position={pin}
              icon={selectionIcon}
              draggable
              eventHandlers={{
                dragstart: stopForManualInteraction,
                dragend: (event) => {
                  const point = (event.target as L.Marker).getLatLng();
                  selectManualPoint(point.lat, point.lng);
                },
              }}
            />
          )}
          {accuracyPoint && (
            <Circle center={[accuracyPoint.lat, accuracyPoint.lng]} radius={Math.max(accuracyPoint.accuracy ?? 0, 1)} pathOptions={{ color: '#dc2f02', fillColor: '#dc2f02', fillOpacity: 0.11, weight: 1.5 }} />
          )}
          {restaurantPosition && <Marker position={restaurantPosition} icon={restaurantIcon} interactive={false} />}
          {restaurantPosition && maxDeliveryKm != null && maxDeliveryKm > 0 && (
            <Circle center={restaurantPosition} radius={maxDeliveryKm * 1000} pathOptions={{ color: '#dc2f02', fillColor: '#dc2f02', fillOpacity: 0.06, weight: 1.5 }} />
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
            <p className="mt-1 max-w-sm text-xs leading-5 text-ink-500">{t('map.loadFailedBody')}</p>
            <button type="button" onClick={retryTiles} className="kiyo-btn-secondary mt-3 min-h-11 px-4 text-xs"><RefreshCw className="h-4 w-4" />{t('error.retry')}</button>
          </div>
        )}
        {accuracyPoint && (
          <button
            type="button"
            onClick={() => setViewTarget((current) => ({ center: [accuracyPoint.lat, accuracyPoint.lng], zoom: 17, nonce: current.nonce + 1 }))}
            className="absolute bottom-[max(3.25rem,env(safe-area-inset-bottom))] right-[max(0.75rem,env(safe-area-inset-right))] z-[1000] flex h-11 w-11 items-center justify-center rounded-lg border border-ink-200 bg-white text-ink-700 shadow-card"
            aria-label={t('map.recenter')}
            title={t('map.recenter')}
          >
            <LocateFixed className="h-5 w-5" />
          </button>
        )}
        {accuracyPoint?.accuracy != null && (
          <div className="absolute left-1/2 top-[max(0.75rem,env(safe-area-inset-top))] z-[1000] max-w-[calc(100%-8rem)] -translate-x-1/2 truncate rounded-full border border-warning-200 bg-white/95 px-3 py-1.5 text-[11px] font-bold text-warning-800 shadow-card" role="status">
            {t('map.gpsAccuracy')}: {Math.round(accuracyPoint.accuracy).toLocaleString(locale)} m | {t(`map.accuracy.${accuracyQuality}` as TranslationKey)}
          </div>
        )}
      </div>

      <div className="border-t border-ink-100 p-3 sm:p-4">
        {notice && (
          <div className="mb-3 flex items-start gap-2 rounded-lg border border-warning-200 bg-warning-50 px-3 py-2.5 text-xs font-medium leading-5 text-warning-800" role="alert">
            <AlertTriangle className="mt-0.5 h-4 w-4 flex-none" />
            <span>{notice}</span>
          </div>
        )}
        {selectedLocation ? (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <span className="flex h-10 w-10 flex-none items-center justify-center rounded-full bg-ember-50 text-ember-600"><MapPin className="h-5 w-5" /></span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold leading-5 text-ink-900">{selectedLocation.address || initialAddress}</p>
              <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-ink-500">
                <span dir="ltr">{selectedLocation.lat.toFixed(6)}, {selectedLocation.lng.toFixed(6)}</span>
                {distanceKm != null && <span className={outOfZone ? 'font-bold text-error-600' : 'font-semibold text-sage-700'}>{t('map.distance')}: {formatDistanceKm(distanceKm)}</span>}
              </div>
            </div>
            {selectedLocation.confirmed ? (
              <span className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-sage-50 px-4 text-xs font-bold text-sage-700"><CheckCircle2 className="h-4 w-4" />{t('map.pinConfirmed')}</span>
            ) : canConfirm ? (
              <button type="button" onClick={confirmPin} className="kiyo-btn-primary h-11 px-4"><Navigation className="h-4 w-4" />{t('map.confirmPin')}</button>
            ) : (
              <span className="inline-flex min-h-11 items-center justify-center rounded-lg bg-warning-50 px-4 text-xs font-bold text-warning-800">{outOfZone ? t('map.outsideZoneShort') : t('map.movePinRequired')}</span>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-3 text-sm text-ink-500"><MapPin className="h-5 w-5 flex-none text-ember-600" /><span>{t('map.selectionHelp')}</span></div>
        )}
      </div>
    </section>
  );
}

function FallbackMapEvents({
  onManualPoint,
  onInteractionStart,
}: {
  onManualPoint: (lat: number, lng: number) => void;
  onInteractionStart: () => void;
}) {
  useMapEvents({
    click: (event) => onManualPoint(event.latlng.lat, event.latlng.lng),
    dragstart: onInteractionStart,
    zoomstart: onInteractionStart,
  });
  return null;
}

function FallbackMapView({ target }: { target: ViewTarget }) {
  const map = useMap();
  useEffect(() => {
    if (target.nonce === 0) return;
    map.flyTo(target.center, target.zoom, { duration: 0.45 });
  }, [map, target.center, target.nonce, target.zoom]);
  return null;
}

function FallbackMapResize() {
  const map = useMap();
  useEffect(() => {
    const container = map.getContainer();
    const resize = () => map.invalidateSize({ pan: false });
    resize();
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(resize);
    observer?.observe(container);
    window.addEventListener('orientationchange', resize);
    return () => {
      observer?.disconnect();
      window.removeEventListener('orientationchange', resize);
    };
  }, [map]);
  return null;
}

function fallbackGeolocationMessage(
  error: GeolocationPositionError | Error,
  t: (key: TranslationKey) => string,
): string {
  switch (classifyGeolocationError(error)) {
    case 'permission_denied': return t('map.permissionDenied');
    case 'position_unavailable': return t('map.positionUnavailable');
    case 'timeout': return t('map.locationTimeout');
    case 'unsupported': return t('map.locationUnsupported');
    case 'outside_algeria': return t('map.locationOutsideAlgeria');
    default: return t('map.locationUnavailable');
  }
}
