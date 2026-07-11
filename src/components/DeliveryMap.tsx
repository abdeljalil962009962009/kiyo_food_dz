import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { AdvancedMarker, ControlPosition, Map, MapControl, useMap, useMapsLibrary } from '@vis.gl/react-google-maps';
import {
  AlertTriangle,
  CheckCircle2,
  Crosshair,
  Layers3,
  LocateFixed,
  MapPin,
  Navigation,
  Minus,
  Plus,
  Search,
} from 'lucide-react';
import {
  GEOLOCATION_DEFAULT_OPTIONS,
  LOCATION_ACCURACY_METERS,
  formatDistanceKm,
  getAccuracyQuality,
  haversineKm,
  isCoordinateInAlgeria,
  isUsableAccuracy,
  requestBestCurrentPosition,
  type AddressParts,
  type LiveGeoPoint,
} from '../lib/geo';
import {
  ALGERIA_MAP_BOUNDS,
  CONSTANTINE_MAP_CENTER,
  isValidMapCoordinate,
  parseGoogleAddressComponents,
} from '../lib/googleMaps';
import { useT } from '../lib/i18n-react';
import type { TranslationKey } from '../lib/i18n';
import {
  LAST_MAP_STATE_STORAGE_KEY,
  restoreLastMapState,
  saveLastMapState,
  type DeliveryLocation,
} from '../lib/location';
import { withExponentialBackoff } from '../lib/locationNetwork';
import { GoogleMapShell, GOOGLE_MAPS_MAP_ID, MapCircle, MapMarkerBadge } from './GoogleMapShell';

export type DeliveryMapLocation = DeliveryLocation;

type Props = {
  restaurantLat?: number | null;
  restaurantLng?: number | null;
  maxDeliveryKm?: number;
  initialAddress?: string;
  initialLocation?: DeliveryMapLocation | null;
  purpose?: 'customer' | 'restaurant' | 'driver';
  gpsFirst?: boolean;
  onLocationChange: (location: DeliveryMapLocation) => void;
};

type SearchSuggestion = {
  id: string;
  mainText: string;
  secondaryText: string;
  label: string;
  prediction: google.maps.places.PlacePrediction;
};

type CameraTarget = {
  center: google.maps.LatLngLiteral;
  zoom: number;
  nonce: number;
};

const PRECISE_ADDRESS_TYPES = new Set([
  'street_address',
  'premise',
  'subpremise',
  'establishment',
  'point_of_interest',
  'route',
  'intersection',
]);

export default function DeliveryMap(props: Props) {
  return (
    <GoogleMapShell fallbackHeightClass="h-[440px]">
      <DeliveryMapInner {...props} />
    </GoogleMapShell>
  );
}

function DeliveryMapInner({
  restaurantLat,
  restaurantLng,
  maxDeliveryKm,
  initialAddress,
  initialLocation,
  purpose = 'customer',
  gpsFirst = false,
  onLocationChange,
}: Props) {
  const { t, locale } = useT();
  const isRtl = locale === 'ar';
  const placesLibrary = useMapsLibrary('places');
  const geocodingLibrary = useMapsLibrary('geocoding');

  const restaurantPosition = useMemo(() => (
    isValidMapCoordinate(restaurantLat, restaurantLng)
      ? { lat: restaurantLat as number, lng: restaurantLng as number }
      : null
  ), [restaurantLat, restaurantLng]);

  const [initialSnapshot] = useState<DeliveryMapLocation | null>(() => {
    if (initialLocation) return initialLocation;
    if (typeof window === 'undefined') return null;
    return restoreLastMapState(localStorage.getItem(LAST_MAP_STATE_STORAGE_KEY));
  });
  const initialCenter = initialSnapshot
    ? { lat: initialSnapshot.lat, lng: initialSnapshot.lng }
    : restaurantPosition ?? CONSTANTINE_MAP_CENTER;
  const [cameraTarget, setCameraTarget] = useState<CameraTarget>({
    center: initialCenter,
    zoom: initialSnapshot ? 17 : restaurantPosition ? 15 : 12,
    nonce: 0,
  });
  const mapCenterRef = useRef(initialCenter);
  const [mapType, setMapType] = useState<'roadmap' | 'satellite'>('roadmap');
  const [tilesReady, setTilesReady] = useState(false);
  const [tilesSlow, setTilesSlow] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const [search, setSearch] = useState('');
  const [suggestions, setSuggestions] = useState<SearchSuggestion[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  const [selectedLocation, setSelectedLocation] = useState<DeliveryMapLocation | null>(initialLocation ?? null);
  const [addressText, setAddressText] = useState(initialLocation?.address ?? initialAddress?.trim() ?? '');
  const [livePosition, setLivePosition] = useState<LiveGeoPoint | null>(null);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [improvingGps, setImprovingGps] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [gpsRecovery, setGpsRecovery] = useState<'weak' | 'permission' | 'timeout' | 'unavailable' | null>(null);

  const geocoderRef = useRef<google.maps.Geocoder | null>(null);
  const sessionTokenRef = useRef<google.maps.places.AutocompleteSessionToken | null>(null);
  const latestSearchRequestRef = useRef(0);
  const latestGeocodeRequestRef = useRef(0);
  const selectedSearchLabelRef = useRef<string | null>(null);
  const cancelGpsRef = useRef<(() => void) | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const manualGestureVersionRef = useRef(0);

  useEffect(() => {
    if (geocodingLibrary && !geocoderRef.current) {
      geocoderRef.current = new geocodingLibrary.Geocoder();
    }
  }, [geocodingLibrary]);

  useEffect(() => {
    if (placesLibrary && !sessionTokenRef.current) {
      sessionTokenRef.current = new placesLibrary.AutocompleteSessionToken();
    }
  }, [placesLibrary]);

  useEffect(() => () => cancelGpsRef.current?.(), []);

  useEffect(() => {
    if (tilesReady) {
      setTilesSlow(false);
      return;
    }
    const timer = window.setTimeout(() => setTilesSlow(true), 8000);
    return () => window.clearTimeout(timer);
  }, [tilesReady, cameraTarget.nonce, mapType]);

  useEffect(() => {
    const query = search.trim();
    if (selectedSearchLabelRef.current === query) {
      setSuggestions([]);
      setSearching(false);
      return;
    }
    if (query.length < 2 || !placesLibrary) {
      setSuggestions([]);
      setSearching(false);
      return;
    }

    const requestId = ++latestSearchRequestRef.current;
    const timer = window.setTimeout(async () => {
      setSearching(true);
      setSearchError(null);
      try {
        if (!sessionTokenRef.current) {
          sessionTokenRef.current = new placesLibrary.AutocompleteSessionToken();
        }
        const response = await withExponentialBackoff(() => (
          placesLibrary.AutocompleteSuggestion.fetchAutocompleteSuggestions({
            input: query,
            includedRegionCodes: ['dz'],
            language: locale,
            region: 'dz',
            locationRestriction: ALGERIA_MAP_BOUNDS,
            origin: mapCenterRef.current,
            sessionToken: sessionTokenRef.current!,
          })
        ));
        if (requestId !== latestSearchRequestRef.current) return;
        setSuggestions(response.suggestions.flatMap((suggestion) => {
          const prediction = suggestion.placePrediction;
          if (!prediction) return [];
          return [{
            id: prediction.placeId,
            mainText: prediction.mainText?.text ?? prediction.text.text,
            secondaryText: prediction.secondaryText?.text ?? '',
            label: prediction.text.text,
            prediction,
          }];
        }));
      } catch (error) {
        if (requestId !== latestSearchRequestRef.current) return;
        console.error('[Kiyo Maps] Address autocomplete failed', error);
        setSuggestions([]);
        setSearchError(t('map.searchUnavailable'));
      } finally {
        if (requestId === latestSearchRequestRef.current) setSearching(false);
      }
    }, 320);

    return () => window.clearTimeout(timer);
  }, [locale, placesLibrary, search, t]);

  const moveCamera = useCallback((center: google.maps.LatLngLiteral, zoom = 17) => {
    mapCenterRef.current = center;
    setCameraTarget((current) => ({ center, zoom, nonce: current.nonce + 1 }));
  }, []);

  const publishLocation = useCallback((location: DeliveryMapLocation) => {
    setSelectedLocation(location);
    setAddressText(location.address);
    saveLastMapState(location);
    onLocationChange(location);
  }, [onLocationChange]);

  const reverseGeocodePoint = useCallback(async ({
    lat,
    lng,
    accuracy,
    source,
  }: {
    lat: number;
    lng: number;
    accuracy: number | null;
    source: DeliveryMapLocation['source'];
  }) => {
    if (!isCoordinateInAlgeria(lat, lng)) {
      setNotice(t('map.locationOutsideAlgeria'));
      return;
    }

    const geocoder = geocoderRef.current;
    if (!geocoder) {
      setNotice(t('map.addressStillLoading'));
      return;
    }

    const requestId = ++latestGeocodeRequestRef.current;
    setSearching(true);
    setSearchError(null);
    try {
      const response = await withExponentialBackoff(() => geocoder.geocode({
          location: { lat, lng },
          language: locale,
          region: 'DZ',
        }));
      if (requestId !== latestGeocodeRequestRef.current) return;
      const result = pickBestGeocodeResult(response.results);
      if (!result) {
        setNotice(t('map.addressNotFound'));
        return;
      }

      const quality = isPreciseGeocodeResult(result) ? 'precise' : 'approximate';
      const weakGps = (source === 'gps' || source === 'network')
        && (accuracy == null || accuracy > LOCATION_ACCURACY_METERS.confirmable);
      const needsManualAdjustment = source !== 'manual' && (quality !== 'precise' || weakGps);
      const location: DeliveryMapLocation = {
        lat,
        lng,
        address: result.formatted_address,
        accuracy,
        source,
        confirmed: false,
        placeId: result.place_id || null,
        addressQuality: source === 'manual' ? 'manual' : quality,
        addressParts: addressPartsFromGeocoder(result),
        requiresManualAdjustment: needsManualAdjustment,
      };
      publishLocation(location);

      if (needsManualAdjustment) {
        setNotice(t('map.addressApproximate'));
      } else if (source === 'manual') {
        setNotice(t('map.confirmDraggedPin'));
      } else {
        setNotice(t('map.confirmWeakGps'));
      }
    } catch (error) {
      console.error('[Kiyo Maps] Reverse geocoding failed', error);
      if (requestId === latestGeocodeRequestRef.current) {
        setNotice(t('map.addressNotFound'));
      }
    } finally {
      if (requestId === latestGeocodeRequestRef.current) setSearching(false);
    }
  }, [locale, publishLocation, t]);

  const selectSuggestion = useCallback(async (suggestion: SearchSuggestion) => {
    const gestureVersion = manualGestureVersionRef.current;
    setSearching(true);
    setSearchError(null);
    setSuggestions([]);
    selectedSearchLabelRef.current = suggestion.label;
    setSearch(suggestion.label);
    try {
      const place = suggestion.prediction.toPlace();
      await withExponentialBackoff(() => place.fetchFields({
          fields: ['id', 'formattedAddress', 'location', 'viewport', 'addressComponents', 'types'],
        }));
      if (gestureVersion !== manualGestureVersionRef.current) return;
      if (!place.location) throw new Error('Place has no coordinates');

      const lat = place.location.lat();
      const lng = place.location.lng();
      if (!isCoordinateInAlgeria(lat, lng)) {
        setNotice(t('map.locationOutsideAlgeria'));
        return;
      }

      const address = place.formattedAddress || suggestion.label;
      const precise = (place.types ?? suggestion.prediction.types).some((type) => PRECISE_ADDRESS_TYPES.has(type));
      const location: DeliveryMapLocation = {
        lat,
        lng,
        address,
        accuracy: null,
        source: 'search',
        confirmed: false,
        placeId: place.id || suggestion.id,
        addressQuality: precise ? 'precise' : 'approximate',
        addressParts: addressPartsFromPlace(place, address),
        requiresManualAdjustment: !precise,
      };
      publishLocation(location);
      moveCamera({ lat, lng }, precise ? 18 : 16);
      setNotice(precise ? t('map.confirmSearchPin') : t('map.addressApproximate'));
      sessionTokenRef.current = placesLibrary ? new placesLibrary.AutocompleteSessionToken() : null;
    } catch (error) {
      console.error('[Kiyo Maps] Place details failed', error);
      setSearchError(t('map.searchUnavailable'));
    } finally {
      setSearching(false);
    }
  }, [moveCamera, placesLibrary, publishLocation, t]);

  const submitSearch = useCallback(async (event: FormEvent) => {
    event.preventDefault();
    if (suggestions.length > 0) {
      await selectSuggestion(suggestions[0]);
      return;
    }
    const geocoder = geocoderRef.current;
    const query = search.trim();
    if (!geocoder || query.length < 2) return;

    setSearching(true);
    setSearchError(null);
    const gestureVersion = manualGestureVersionRef.current;
    try {
      const response = await withExponentialBackoff(() => geocoder.geocode({
          address: query,
          componentRestrictions: { country: 'DZ' },
          region: 'DZ',
          language: locale,
          bounds: ALGERIA_MAP_BOUNDS,
        }));
      if (gestureVersion !== manualGestureVersionRef.current) return;
      const result = pickBestGeocodeResult(response.results);
      if (!result) throw new Error('No matching address');
      const lat = result.geometry.location.lat();
      const lng = result.geometry.location.lng();
      const precise = isPreciseGeocodeResult(result);
      const location: DeliveryMapLocation = {
        lat,
        lng,
        address: result.formatted_address,
        accuracy: null,
        source: 'search',
        confirmed: false,
        placeId: result.place_id || null,
        addressQuality: precise ? 'precise' : 'approximate',
        addressParts: addressPartsFromGeocoder(result),
        requiresManualAdjustment: !precise,
      };
      publishLocation(location);
      moveCamera({ lat, lng }, precise ? 18 : 16);
      setSearch(result.formatted_address);
      selectedSearchLabelRef.current = result.formatted_address;
      setNotice(precise ? t('map.confirmSearchPin') : t('map.addressApproximate'));
    } catch (error) {
      console.error('[Kiyo Maps] Address search failed', error);
      setSearchError(t('map.addressNotFound'));
    } finally {
      setSearching(false);
    }
  }, [locale, moveCamera, publishLocation, search, selectSuggestion, suggestions, t]);

  const locateWithGps = useCallback(() => {
    const gestureVersion = manualGestureVersionRef.current;
    cancelGpsRef.current?.();
    setGpsLoading(true);
    setImprovingGps(true);
    setGpsRecovery(null);
    setNotice(t('map.improvingAccuracy'));
    setSearchError(null);

    cancelGpsRef.current = requestBestCurrentPosition({
      purpose,
      waitMs: purpose === 'restaurant' ? 18000 : 15000,
      options: GEOLOCATION_DEFAULT_OPTIONS,
      onCandidate: (point) => {
        setLivePosition(point);
      },
      onResult: ({ point, accepted }) => {
        cancelGpsRef.current = null;
        setGpsLoading(false);
        setImprovingGps(false);
        setLivePosition(point);
        if (gestureVersion !== manualGestureVersionRef.current) return;
        if (!accepted || !isUsableAccuracy(point.accuracy, purpose)) {
          setGpsRecovery('weak');
          setNotice(`${t('map.gpsWeakMeasured')} ${Math.round(point.accuracy ?? 0).toLocaleString(locale)} m. ${t('map.gpsWeakAction')}`);
          return;
        }
        setGpsRecovery(null);
        const center = { lat: point.lat, lng: point.lng };
        moveCamera(center, point.accuracy != null && point.accuracy < 100 ? 18 : 16);
        void reverseGeocodePoint({
          ...center,
          accuracy: point.accuracy,
          source: point.source,
        });
      },
      onError: (error) => {
        cancelGpsRef.current = null;
        setGpsLoading(false);
        setImprovingGps(false);
        setGpsRecovery(geolocationErrorKind(error));
        setNotice(geolocationErrorMessage(error, t));
      },
    });
  }, [locale, moveCamera, purpose, reverseGeocodePoint, t]);

  const handleMapDragEnd = useCallback((event: { map: google.maps.Map }) => {
    setIsDragging(false);
    setGpsRecovery(null);
    const center = event.map.getCenter();
    if (!center) return;
    const next = { lat: center.lat(), lng: center.lng() };
    mapCenterRef.current = next;
    void reverseGeocodePoint({
      ...next,
      accuracy: null,
      source: 'manual',
    });
  }, [reverseGeocodePoint]);

  const handleMapDragStart = useCallback(() => {
    manualGestureVersionRef.current += 1;
    cancelGpsRef.current?.();
    cancelGpsRef.current = null;
    setGpsLoading(false);
    setImprovingGps(false);
    setGpsRecovery(null);
    setSuggestions([]);
    setIsDragging(true);
  }, []);

  const confirmPin = useCallback(() => {
    if (!selectedLocation || outOfAlgeria(selectedLocation)) return;
    const confirmed = { ...selectedLocation, confirmed: true, requiresManualAdjustment: false };
    setSelectedLocation(confirmed);
    onLocationChange(confirmed);
    setNotice(null);
  }, [onLocationChange, selectedLocation]);

  const distanceKm = useMemo(() => {
    if (purpose === 'restaurant' || purpose === 'driver' || !selectedLocation || !restaurantPosition) return null;
    return haversineKm(selectedLocation, restaurantPosition);
  }, [purpose, restaurantPosition, selectedLocation]);
  const outOfZone = distanceKm != null && maxDeliveryKm != null && distanceKm > maxDeliveryKm;
  const outsideByKm = outOfZone && distanceKm != null && maxDeliveryKm != null
    ? Math.max(0, distanceKm - maxDeliveryKm)
    : null;
  const requiresMapAdjustment = selectedLocation?.requiresManualAdjustment === true;
  const canConfirm = selectedLocation != null && !outOfZone && !requiresMapAdjustment;

  const accuracyLabel = livePosition?.accuracy != null
    ? `${t('map.gpsAccuracy')}: ${Math.round(livePosition.accuracy).toLocaleString(locale)} m | ${t(`map.accuracy.${getAccuracyQuality(livePosition.accuracy)}` as TranslationKey)}`
    : null;
  const accuracyQuality = getAccuracyQuality(livePosition?.accuracy);
  const accuracyClass = accuracyQuality === 'excellent' || accuracyQuality === 'good'
    ? 'border-sage-200 text-sage-700'
    : accuracyQuality === 'acceptable'
      ? 'border-warning-200 text-warning-700'
      : 'border-error-200 text-error-700';

  return (
    <section className="overflow-hidden rounded-xl border border-ink-200 bg-white shadow-card" aria-label={t('map.locationSelector')}>
      <div className="border-b border-ink-100 bg-white p-3 sm:p-4">
        <form onSubmit={submitSearch} className={`flex gap-2 ${gpsFirst ? 'flex-col' : 'flex-row'}`}>
          {gpsFirst && (
            <button
              type="button"
              onClick={locateWithGps}
              disabled={gpsLoading}
              className="kiyo-btn-primary min-h-12 w-full px-4 text-sm"
              data-testid="primary-gps-action"
            >
              <LocateFixed className={`h-4 w-4 ${gpsLoading ? 'animate-pulse' : ''}`} />
              {gpsLoading ? t('map.locating') : t('map.useCurrentLocation')}
            </button>
          )}
          <div className="relative min-w-0 flex-1">
            <Search className={`pointer-events-none absolute top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-ink-400 ${isRtl ? 'right-3.5' : 'left-3.5'}`} />
            <input
              ref={searchInputRef}
              value={search}
              onChange={(event) => {
                selectedSearchLabelRef.current = null;
                setSearch(event.target.value);
                setSearchError(null);
              }}
              placeholder={t('map.searchPlaceholder')}
              aria-label={t('map.searchPlaceholder')}
              autoComplete="off"
              dir={isRtl ? 'rtl' : 'ltr'}
              className={`kiyo-input h-12 py-2.5 ${gpsFirst ? 'border-ink-200 bg-ink-50' : ''} ${isRtl ? 'pr-10 text-right' : 'pl-10'}`}
            />
            {suggestions.length > 0 && (
              <div className="absolute inset-x-0 top-full z-[1001] mt-1 max-h-72 overflow-y-auto rounded-lg border border-ink-100 bg-white p-1 shadow-card-lg" role="listbox">
                {suggestions.map((suggestion) => (
                  <button
                    key={suggestion.id}
                    type="button"
                    onClick={() => void selectSuggestion(suggestion)}
                    className={`flex w-full items-start gap-2 rounded-md px-3 py-3 text-sm transition-colors hover:bg-ink-50 ${isRtl ? 'text-right' : 'text-left'}`}
                    role="option"
                    aria-selected="false"
                  >
                    <MapPin className="mt-0.5 h-4 w-4 flex-none text-ember-600" />
                    <span className="min-w-0">
                      <span className="block truncate font-semibold text-ink-900">{suggestion.mainText}</span>
                      {suggestion.secondaryText && (
                        <span className="mt-0.5 block truncate text-xs text-ink-500">{suggestion.secondaryText}</span>
                      )}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
          {!gpsFirst && (
            <button
              type="button"
              onClick={locateWithGps}
              disabled={gpsLoading}
              className="kiyo-btn-primary h-12 min-h-12 w-12 shrink-0 px-0 sm:w-auto sm:min-w-44 sm:px-4"
            >
              <LocateFixed className={`h-4 w-4 ${gpsLoading ? 'animate-pulse' : ''}`} />
              <span className="hidden sm:inline">{gpsLoading ? t('map.locating') : t('map.useCurrentLocation')}</span>
            </button>
          )}
        </form>

        {(searching || improvingGps || searchError) && (
          <div className="mt-2 flex min-h-5 items-center gap-2 text-xs">
            {(searching || improvingGps) && (
              <>
                <span className="h-2 w-2 animate-pulse rounded-full bg-ember-500" />
                <span className="font-medium text-ink-500">
                  {improvingGps ? t('map.improvingAccuracy') : t('map.searching')}
                </span>
              </>
            )}
            {searchError && (
              <span className="flex flex-wrap items-center gap-2 font-medium text-error-600">
                <span>{searchError}</span>
                <button type="button" onClick={() => searchInputRef.current?.focus()} className="min-h-11 rounded-md px-2 font-bold underline underline-offset-2">
                  {t('map.enterManually')}
                </button>
              </span>
            )}
          </div>
        )}
      </div>

      <div
        className="relative h-[clamp(220px,42dvh,440px)] min-h-[220px] w-full bg-ink-100 [@media(max-height:650px)]:h-[150px] [@media(max-height:650px)]:min-h-[150px] sm:h-[440px]"
        data-testid="delivery-map-canvas"
      >
        <Map
          defaultCenter={initialCenter}
          defaultZoom={initialLocation ? 18 : restaurantPosition ? 15 : 12}
          mapId={GOOGLE_MAPS_MAP_ID}
          mapTypeId={mapType}
          gestureHandling="greedy"
          disableDefaultUI
          zoomControl={false}
          fullscreenControl
          fullscreenControlOptions={{ position: ControlPosition.LEFT_TOP }}
          streetViewControl={false}
          minZoom={5}
          maxZoom={20}
          restriction={{ latLngBounds: ALGERIA_MAP_BOUNDS, strictBounds: false }}
          reuseMaps
          onTilesLoaded={() => {
            setTilesReady(true);
            setTilesSlow(false);
          }}
          onCameraChanged={(event) => { mapCenterRef.current = event.detail.center; }}
          onDragstart={handleMapDragStart}
          onDragend={handleMapDragEnd}
          style={{ width: '100%', height: '100%' }}
        >
          <MapCamera target={cameraTarget} />
          <MapZoomControls zoomInLabel={t('map.zoomIn')} zoomOutLabel={t('map.zoomOut')} />
          {restaurantPosition && (
            <AdvancedMarker position={restaurantPosition} title={t('map.restaurantMarker')} zIndex={2}>
              <MapMarkerBadge kind="restaurant" />
            </AdvancedMarker>
          )}
          {restaurantPosition && maxDeliveryKm != null && maxDeliveryKm > 0 && (
            <MapCircle center={restaurantPosition} radius={maxDeliveryKm * 1000} color="#ec3804" fillOpacity={0.07} />
          )}
          {livePosition && (
            <>
              <AdvancedMarker position={{ lat: livePosition.lat, lng: livePosition.lng }} title={t('map.currentPosition')} zIndex={3}>
                <span className="relative flex h-5 w-5 items-center justify-center">
                  <span className="absolute h-5 w-5 animate-ping rounded-full bg-blue-500/30" />
                  <span className="relative h-3.5 w-3.5 rounded-full border-[3px] border-white bg-blue-600 shadow" />
                </span>
              </AdvancedMarker>
              {livePosition.accuracy != null && livePosition.accuracy > 0 && (
                <MapCircle
                  center={{ lat: livePosition.lat, lng: livePosition.lng }}
                  radius={livePosition.accuracy}
                  color="#ec3804"
                  fillOpacity={0.1}
                />
              )}
            </>
          )}
        </Map>

        {!tilesReady && (
          <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center bg-ink-50/90">
            <span className="flex items-center gap-2 text-xs font-semibold text-ink-500">
              <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-ember-500" />
              {tilesSlow ? t('map.tilesSlow') : t('map.loading')}
            </span>
          </div>
        )}

        <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center" aria-hidden="true">
          <div className={`relative -mt-8 flex flex-col items-center transition-transform duration-200 ${isDragging ? '-translate-y-2 scale-110' : ''}`}>
            <span className="flex h-11 w-11 items-center justify-center rounded-full border-[4px] border-white bg-ember-600 text-white shadow-card-lg">
              <Crosshair className="h-5 w-5" />
            </span>
            <span className="mt-1 h-2 w-4 rounded-full bg-ink-900/20 blur-[2px]" />
          </div>
        </div>

        <button
          type="button"
          onClick={() => {
            setTilesReady(false);
            setTilesSlow(false);
            setMapType((current) => current === 'roadmap' ? 'satellite' : 'roadmap');
          }}
          className="absolute right-[max(0.75rem,env(safe-area-inset-right))] top-[max(0.75rem,env(safe-area-inset-top))] z-30 flex h-11 w-11 items-center justify-center rounded-lg border border-ink-200 bg-white text-ink-700 shadow-card transition-colors hover:bg-ink-50"
          title={mapType === 'roadmap' ? t('map.satelliteView') : t('map.standardView')}
          aria-label={mapType === 'roadmap' ? t('map.satelliteView') : t('map.standardView')}
          data-testid="map-layer-control"
        >
          <Layers3 className="h-5 w-5" />
        </button>

        <button
          type="button"
          onClick={() => {
            if (livePosition) moveCamera({ lat: livePosition.lat, lng: livePosition.lng }, 18);
            else locateWithGps();
          }}
          className="absolute bottom-[max(2.25rem,env(safe-area-inset-bottom))] right-[max(0.75rem,env(safe-area-inset-right))] z-30 flex h-11 w-11 items-center justify-center rounded-lg border border-ink-200 bg-white text-ink-700 shadow-card transition-colors hover:bg-ink-50"
          title={t('map.recenter')}
          aria-label={t('map.recenter')}
          data-testid="map-recenter-control"
        >
          <LocateFixed className="h-5 w-5" />
        </button>

        {accuracyLabel && (
          <div className={`absolute left-1/2 top-[max(0.75rem,env(safe-area-inset-top))] z-30 max-w-[calc(100%-8rem)] -translate-x-1/2 truncate rounded-full border bg-white/95 px-3 py-1.5 text-[11px] font-bold shadow-card backdrop-blur ${accuracyClass}`} role="status">
            {accuracyLabel}
          </div>
        )}

        {isDragging && (
          <div className="pointer-events-none absolute left-1/2 top-16 z-30 w-[min(18rem,calc(100%-6rem))] -translate-x-1/2 rounded-lg bg-ink-900/90 px-3 py-2 text-center text-xs font-semibold text-white shadow-card-lg backdrop-blur">
            {t('map.releaseToSelect')}
          </div>
        )}
      </div>

      <div className="border-t border-ink-100 bg-white p-3 sm:p-4">
        {notice && (
          <div className="mb-3 flex flex-wrap items-start gap-2 rounded-lg border border-warning-500/20 bg-warning-500/10 px-3 py-2.5 text-xs font-medium leading-5 text-warning-700" role="alert">
            <AlertTriangle className="mt-0.5 h-4 w-4 flex-none" />
            <span className="min-w-0 flex-1">{notice}</span>
            {gpsRecovery && (
              <span className="flex w-full flex-wrap gap-2 ps-6">
                <button type="button" onClick={locateWithGps} className="min-h-11 rounded-md bg-white px-3 font-bold text-ink-800 shadow-sm">
                  {t('map.retryGps')}
                </button>
                <button type="button" onClick={() => searchInputRef.current?.focus()} className="min-h-11 rounded-md px-3 font-bold underline underline-offset-2">
                  {t('map.enterManually')}
                </button>
              </span>
            )}
          </div>
        )}

        {selectedLocation ? (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <span className="flex h-10 w-10 flex-none items-center justify-center rounded-full bg-ember-50 text-ember-600">
              <MapPin className="h-5 w-5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold leading-5 text-ink-900">{addressText}</p>
              <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-ink-500">
                <span dir="ltr">{selectedLocation.lat.toFixed(6)}, {selectedLocation.lng.toFixed(6)}</span>
                {selectedLocation.accuracy != null && (
                  <span>{t('map.gpsAccuracy')}: {Math.round(selectedLocation.accuracy).toLocaleString(locale)} m</span>
                )}
                {distanceKm != null && (
                  <span className={outOfZone ? 'font-bold text-error-600' : 'font-semibold text-sage-700'}>
                    {t('map.distance')}: {formatDistanceKm(distanceKm)}
                    {maxDeliveryKm != null ? ` / ${maxDeliveryKm} km ${t('map.max')}` : ''}
                  </span>
                )}
              </div>
            </div>

            {selectedLocation.confirmed && !outOfZone ? (
              <span className="inline-flex h-11 flex-none items-center justify-center gap-2 rounded-lg bg-sage-50 px-4 text-xs font-bold text-sage-700">
                <CheckCircle2 className="h-4 w-4" />
                {t('map.pinConfirmed')}
              </span>
            ) : canConfirm ? (
              <button type="button" onClick={confirmPin} className="kiyo-btn-primary h-11 flex-none px-4">
                <Navigation className="h-4 w-4" />
                {t('map.confirmPin')}
              </button>
            ) : (
              <span className="inline-flex h-11 flex-none items-center justify-center rounded-lg bg-warning-500/10 px-4 text-xs font-bold text-warning-700">
                {outOfZone ? t('map.outsideZoneShort') : t('map.movePinRequired')}
              </span>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-3 text-sm text-ink-500">
            <Crosshair className="h-5 w-5 flex-none text-ember-600" />
            <span>{t('map.selectionHelp')}</span>
          </div>
        )}

        {outOfZone && distanceKm != null && (
          <div className="mt-3 flex flex-wrap items-center gap-2 rounded-lg bg-error-50 px-3 py-2.5 text-xs font-medium leading-5 text-error-700">
            <span className="min-w-0 flex-1">
              {t('map.outsideZone')} ({outsideByKm != null ? `${formatDistanceKm(outsideByKm)} ${t('map.outsideBy')}` : `${formatDistanceKm(distanceKm)} / ${maxDeliveryKm} km ${t('map.max')}`}).
            </span>
            <a href="/restaurants" className="inline-flex min-h-11 items-center rounded-md bg-white px-3 font-bold text-error-700 shadow-sm">
              {t('map.findAvailableRestaurants')}
            </a>
          </div>
        )}
      </div>
    </section>
  );
}

function MapCamera({ target }: { target: CameraTarget }) {
  const map = useMap();

  useEffect(() => {
    if (!map) return;
    map.panTo(target.center);
    map.setZoom(target.zoom);
  }, [map, target.center, target.nonce, target.zoom]);

  return null;
}

function MapZoomControls({ zoomInLabel, zoomOutLabel }: { zoomInLabel: string; zoomOutLabel: string }) {
  const map = useMap();
  const adjustZoom = (delta: number) => {
    if (!map) return;
    const currentZoom = map.getZoom() ?? 12;
    map.setZoom(Math.max(5, Math.min(20, currentZoom + delta)));
  };

  return (
    <MapControl position={ControlPosition.LEFT_CENTER}>
      <div className="ms-3 overflow-hidden rounded-lg border border-ink-200 bg-white shadow-card" data-testid="map-zoom-controls">
        <button type="button" onClick={() => adjustZoom(1)} className="flex h-11 w-11 items-center justify-center text-ink-700 hover:bg-ink-50" aria-label={zoomInLabel}>
          <Plus className="h-5 w-5" />
        </button>
        <span className="block h-px bg-ink-200" />
        <button type="button" onClick={() => adjustZoom(-1)} className="flex h-11 w-11 items-center justify-center text-ink-700 hover:bg-ink-50" aria-label={zoomOutLabel}>
          <Minus className="h-5 w-5" />
        </button>
      </div>
    </MapControl>
  );
}

function pickBestGeocodeResult(results: google.maps.GeocoderResult[]): google.maps.GeocoderResult | null {
  if (results.length === 0) return null;
  return [...results].sort((a, b) => geocodeScore(b) - geocodeScore(a))[0] ?? null;
}

function geocodeScore(result: google.maps.GeocoderResult): number {
  const typeScore = result.types.reduce((score, type) => {
    if (type === 'street_address' || type === 'premise' || type === 'subpremise') return Math.max(score, 100);
    if (type === 'establishment' || type === 'point_of_interest') return Math.max(score, 90);
    if (type === 'route' || type === 'intersection') return Math.max(score, 80);
    if (type === 'neighborhood' || type === 'sublocality') return Math.max(score, 50);
    if (type === 'locality') return Math.max(score, 30);
    return score;
  }, 0);
  const locationScore = result.geometry.location_type === 'ROOFTOP'
    ? 20
    : result.geometry.location_type === 'RANGE_INTERPOLATED'
      ? 12
      : 0;
  return typeScore + locationScore - (result.partial_match ? 30 : 0);
}

function isPreciseGeocodeResult(result: google.maps.GeocoderResult): boolean {
  return !result.partial_match && result.types.some((type) => PRECISE_ADDRESS_TYPES.has(type));
}

function addressPartsFromGeocoder(result: google.maps.GeocoderResult): AddressParts {
  return parseGoogleAddressComponents({
    components: result.address_components,
    displayName: result.formatted_address,
    placeId: result.place_id,
  });
}

function addressPartsFromPlace(place: google.maps.places.Place, fallback: string): AddressParts {
  return parseGoogleAddressComponents({
    components: place.addressComponents ?? [],
    displayName: place.formattedAddress || fallback,
    placeId: place.id,
  });
}

function outOfAlgeria(location: DeliveryMapLocation): boolean {
  return !isCoordinateInAlgeria(location.lat, location.lng);
}

function geolocationErrorMessage(
  error: GeolocationPositionError | Error,
  t: (key: TranslationKey) => string,
): string {
  if (error instanceof Error && error.message === 'location_timeout') return t('map.locationTimeout');
  if ('code' in error) {
    if (error.code === 1) return t('map.permissionDenied');
    if (error.code === 3) return t('map.locationTimeout');
  }
  return t('map.locationUnavailable');
}

function geolocationErrorKind(
  error: GeolocationPositionError | Error,
): 'permission' | 'timeout' | 'unavailable' {
  if (error instanceof Error && error.message === 'location_timeout') return 'timeout';
  if ('code' in error) {
    if (error.code === 1) return 'permission';
    if (error.code === 3) return 'timeout';
  }
  return 'unavailable';
}
