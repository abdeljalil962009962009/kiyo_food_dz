import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { AdvancedMarker, Map, useMap, useMapsLibrary } from '@vis.gl/react-google-maps';
import {
  AlertTriangle,
  CheckCircle2,
  Crosshair,
  Layers3,
  LocateFixed,
  MapPin,
  Navigation,
  Search,
} from 'lucide-react';
import {
  GEOLOCATION_DEFAULT_OPTIONS,
  formatDistanceKm,
  haversineKm,
  isCoordinateInAlgeria,
  requestBestCurrentPosition,
  type AddressParts,
  type LiveGeoPoint,
} from '../lib/geo';
import {
  ALGERIA_MAP_BOUNDS,
  ALGIERS_MAP_CENTER,
  isValidMapCoordinate,
} from '../lib/googleMaps';
import { useT } from '../lib/i18n-react';
import type { TranslationKey } from '../lib/i18n';
import { GoogleMapShell, GOOGLE_MAPS_MAP_ID, MapCircle, MapMarkerBadge } from './GoogleMapShell';

export type DeliveryMapLocation = {
  lat: number;
  lng: number;
  address: string;
  accuracy: number | null;
  source: LiveGeoPoint['source'] | 'search' | 'manual';
  confirmed: boolean;
  placeId: string | null;
  addressQuality: 'precise' | 'approximate' | 'manual';
  addressParts: AddressParts | null;
  requiresManualAdjustment: boolean;
};

type Props = {
  restaurantLat?: number | null;
  restaurantLng?: number | null;
  maxDeliveryKm?: number;
  initialAddress?: string;
  purpose?: 'customer' | 'restaurant' | 'driver';
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
  purpose = 'customer',
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

  const initialCenter = restaurantPosition ?? ALGIERS_MAP_CENTER;
  const [cameraTarget, setCameraTarget] = useState<CameraTarget>({
    center: initialCenter,
    zoom: restaurantPosition ? 15 : 11,
    nonce: 0,
  });
  const mapCenterRef = useRef(initialCenter);
  const [mapType, setMapType] = useState<'roadmap' | 'satellite'>('roadmap');
  const [tilesReady, setTilesReady] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const [search, setSearch] = useState('');
  const [suggestions, setSuggestions] = useState<SearchSuggestion[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  const [selectedLocation, setSelectedLocation] = useState<DeliveryMapLocation | null>(null);
  const [addressText, setAddressText] = useState(initialAddress?.trim() ?? '');
  const [livePosition, setLivePosition] = useState<LiveGeoPoint | null>(null);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [improvingGps, setImprovingGps] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const geocoderRef = useRef<google.maps.Geocoder | null>(null);
  const sessionTokenRef = useRef<google.maps.places.AutocompleteSessionToken | null>(null);
  const latestSearchRequestRef = useRef(0);
  const latestGeocodeRequestRef = useRef(0);
  const cancelGpsRef = useRef<(() => void) | null>(null);

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
    const query = search.trim();
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
        const response = await placesLibrary.AutocompleteSuggestion.fetchAutocompleteSuggestions({
          input: query,
          includedRegionCodes: ['dz'],
          language: locale,
          region: 'dz',
          locationRestriction: ALGERIA_MAP_BOUNDS,
          origin: mapCenterRef.current,
          sessionToken: sessionTokenRef.current,
        });
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
    onLocationChange(location);
  }, [onLocationChange]);

  const reverseGeocodePoint = useCallback(async ({
    lat,
    lng,
    accuracy,
    source,
    autoConfirm,
  }: {
    lat: number;
    lng: number;
    accuracy: number | null;
    source: DeliveryMapLocation['source'];
    autoConfirm: boolean;
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
      const response = await geocoder.geocode({
        location: { lat, lng },
        language: locale,
        region: 'DZ',
      });
      if (requestId !== latestGeocodeRequestRef.current) return;
      const result = pickBestGeocodeResult(response.results);
      if (!result) {
        setNotice(t('map.addressNotFound'));
        return;
      }

      const quality = isPreciseGeocodeResult(result) ? 'precise' : 'approximate';
      const needsManualAdjustment = source !== 'manual' && (quality !== 'precise' || !autoConfirm);
      const confirmed = autoConfirm && !needsManualAdjustment;
      const location: DeliveryMapLocation = {
        lat,
        lng,
        address: result.formatted_address,
        accuracy,
        source,
        confirmed,
        placeId: result.place_id || null,
        addressQuality: source === 'manual' ? 'manual' : quality,
        addressParts: addressPartsFromGeocoder(result),
        requiresManualAdjustment: needsManualAdjustment,
      };
      publishLocation(location);

      if (confirmed) {
        setNotice(null);
      } else if (needsManualAdjustment) {
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
    setSearching(true);
    setSearchError(null);
    setSuggestions([]);
    setSearch(suggestion.label);
    try {
      const place = suggestion.prediction.toPlace();
      await place.fetchFields({
        fields: ['id', 'formattedAddress', 'location', 'viewport', 'addressComponents', 'types'],
      });
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
    try {
      const response = await geocoder.geocode({
        address: query,
        componentRestrictions: { country: 'DZ' },
        region: 'DZ',
        language: locale,
        bounds: ALGERIA_MAP_BOUNDS,
      });
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
      setNotice(precise ? t('map.confirmSearchPin') : t('map.addressApproximate'));
    } catch (error) {
      console.error('[Kiyo Maps] Address search failed', error);
      setSearchError(t('map.addressNotFound'));
    } finally {
      setSearching(false);
    }
  }, [locale, moveCamera, publishLocation, search, selectSuggestion, suggestions, t]);

  const useGps = useCallback(() => {
    cancelGpsRef.current?.();
    setGpsLoading(true);
    setImprovingGps(true);
    setNotice(t('map.improvingAccuracy'));
    setSearchError(null);

    cancelGpsRef.current = requestBestCurrentPosition({
      purpose,
      waitMs: purpose === 'restaurant' ? 12000 : 10000,
      options: GEOLOCATION_DEFAULT_OPTIONS,
      onCandidate: (point) => {
        setLivePosition(point);
        moveCamera({ lat: point.lat, lng: point.lng }, point.accuracy != null && point.accuracy < 100 ? 18 : 16);
      },
      onResult: ({ point, accepted }) => {
        cancelGpsRef.current = null;
        setGpsLoading(false);
        setImprovingGps(false);
        setLivePosition(point);
        const center = { lat: point.lat, lng: point.lng };
        moveCamera(center, point.accuracy != null && point.accuracy < 100 ? 18 : 16);
        void reverseGeocodePoint({
          ...center,
          accuracy: point.accuracy,
          source: point.source,
          autoConfirm: accepted,
        });
      },
      onError: (error) => {
        cancelGpsRef.current = null;
        setGpsLoading(false);
        setImprovingGps(false);
        setNotice(geolocationErrorMessage(error, t));
      },
    });
  }, [moveCamera, purpose, reverseGeocodePoint, t]);

  const handleMapDragEnd = useCallback((event: { map: google.maps.Map }) => {
    setIsDragging(false);
    const center = event.map.getCenter();
    if (!center) return;
    const next = { lat: center.lat(), lng: center.lng() };
    mapCenterRef.current = next;
    void reverseGeocodePoint({
      ...next,
      accuracy: null,
      source: 'manual',
      autoConfirm: false,
    });
  }, [reverseGeocodePoint]);

  const handleMapClick = useCallback((event: { detail: { latLng: google.maps.LatLngLiteral | null } }) => {
    const point = event.detail.latLng;
    if (!point) return;
    moveCamera(point, 18);
    void reverseGeocodePoint({
      ...point,
      accuracy: null,
      source: 'manual',
      autoConfirm: false,
    });
  }, [moveCamera, reverseGeocodePoint]);

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
  const requiresMapAdjustment = selectedLocation?.requiresManualAdjustment === true;
  const canConfirm = selectedLocation != null && !outOfZone && !requiresMapAdjustment;

  const accuracyLabel = livePosition?.accuracy != null
    ? `${t('map.gpsAccuracy')}: ${Math.round(livePosition.accuracy).toLocaleString(locale)} m`
    : null;

  return (
    <section className="overflow-hidden rounded-xl border border-ink-200 bg-white shadow-card" aria-label={t('map.locationSelector')}>
      <div className="border-b border-ink-100 bg-white p-3 sm:p-4">
        <form onSubmit={submitSearch} className="flex flex-col gap-2 sm:flex-row">
          <div className="relative min-w-0 flex-1">
            <Search className={`pointer-events-none absolute top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-ink-400 ${isRtl ? 'right-3.5' : 'left-3.5'}`} />
            <input
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setSearchError(null);
              }}
              placeholder={t('map.searchPlaceholder')}
              aria-label={t('map.searchPlaceholder')}
              autoComplete="off"
              dir={isRtl ? 'rtl' : 'ltr'}
              className={`kiyo-input h-12 py-2.5 ${isRtl ? 'pr-10 text-right' : 'pl-10'}`}
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
          <button
            type="button"
            onClick={useGps}
            disabled={gpsLoading}
            className="kiyo-btn-primary h-12 shrink-0 px-4 sm:min-w-44"
          >
            <LocateFixed className={`h-4 w-4 ${gpsLoading ? 'animate-pulse' : ''}`} />
            {gpsLoading ? t('map.locating') : t('map.useCurrentLocation')}
          </button>
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
            {searchError && <span className="font-medium text-error-600">{searchError}</span>}
          </div>
        )}
      </div>

      <div className="relative h-[380px] w-full bg-ink-100 sm:h-[440px]">
        <Map
          defaultCenter={initialCenter}
          defaultZoom={restaurantPosition ? 15 : 11}
          mapId={GOOGLE_MAPS_MAP_ID}
          mapTypeId={mapType}
          gestureHandling="greedy"
          disableDefaultUI
          zoomControl
          fullscreenControl
          streetViewControl={false}
          minZoom={5}
          maxZoom={20}
          restriction={{ latLngBounds: ALGERIA_MAP_BOUNDS, strictBounds: false }}
          reuseMaps
          onTilesLoaded={() => setTilesReady(true)}
          onCameraChanged={(event) => { mapCenterRef.current = event.detail.center; }}
          onClick={handleMapClick}
          onDragstart={() => setIsDragging(true)}
          onDragend={handleMapDragEnd}
          style={{ width: '100%', height: '100%' }}
        >
          <MapCamera target={cameraTarget} />
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
                  color="#2563eb"
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
              {t('map.loading')}
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
          onClick={() => setMapType((current) => current === 'roadmap' ? 'satellite' : 'roadmap')}
          className={`absolute top-3 z-30 flex h-11 w-11 items-center justify-center rounded-lg border border-ink-200 bg-white text-ink-700 shadow-card transition-colors hover:bg-ink-50 ${isRtl ? 'left-3' : 'right-3'}`}
          title={mapType === 'roadmap' ? t('map.satelliteView') : t('map.standardView')}
          aria-label={mapType === 'roadmap' ? t('map.satelliteView') : t('map.standardView')}
        >
          <Layers3 className="h-5 w-5" />
        </button>

        {accuracyLabel && (
          <div className={`absolute top-3 z-30 rounded-full border border-blue-100 bg-white/95 px-3 py-1.5 text-[11px] font-bold text-blue-700 shadow-card backdrop-blur ${isRtl ? 'right-3' : 'left-3'}`}>
            {accuracyLabel}
          </div>
        )}

        {isDragging && (
          <div className="pointer-events-none absolute inset-x-3 bottom-3 z-30 mx-auto max-w-xs rounded-lg bg-ink-900/90 px-3 py-2 text-center text-xs font-semibold text-white shadow-card-lg backdrop-blur">
            {t('map.releaseToSelect')}
          </div>
        )}
      </div>

      <div className="border-t border-ink-100 bg-white p-3 sm:p-4">
        {notice && (
          <div className="mb-3 flex items-start gap-2 rounded-lg border border-warning-500/20 bg-warning-500/10 px-3 py-2.5 text-xs font-medium leading-5 text-warning-700">
            <AlertTriangle className="mt-0.5 h-4 w-4 flex-none" />
            <span>{notice}</span>
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
          <div className="mt-3 rounded-lg bg-error-50 px-3 py-2.5 text-xs font-medium leading-5 text-error-700">
            {t('map.outsideZone')} ({formatDistanceKm(distanceKm)} / {maxDeliveryKm} km {t('map.max')}).
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
  }, [map, target]);

  return null;
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
  const component = (type: string) => result.address_components.find((item) => item.types.includes(type))?.long_name;
  return {
    displayName: result.formatted_address,
    street: [component('street_number'), component('route')].filter(Boolean).join(' ') || undefined,
    neighborhood: component('neighborhood') || component('sublocality') || undefined,
    commune: component('locality') || component('administrative_area_level_2') || undefined,
    city: component('locality') || component('administrative_area_level_2') || undefined,
    province: component('administrative_area_level_1') || undefined,
    postalCode: component('postal_code') || undefined,
    country: component('country') || 'Algeria',
    placeId: result.place_id || undefined,
    provider: 'google',
  };
}

function addressPartsFromPlace(place: google.maps.places.Place, fallback: string): AddressParts {
  const components = place.addressComponents ?? [];
  const component = (type: string) => components.find((item) => item.types.includes(type))?.longText;
  return {
    displayName: place.formattedAddress || fallback,
    street: [component('street_number'), component('route')].filter(Boolean).join(' ') || undefined,
    neighborhood: component('neighborhood') || component('sublocality') || undefined,
    commune: component('locality') || component('administrative_area_level_2') || undefined,
    city: component('locality') || component('administrative_area_level_2') || undefined,
    province: component('administrative_area_level_1') || undefined,
    postalCode: component('postal_code') || undefined,
    country: component('country') || 'Algeria',
    placeId: place.id || undefined,
    provider: 'google',
  };
}

function outOfAlgeria(location: DeliveryMapLocation): boolean {
  return !isCoordinateInAlgeria(location.lat, location.lng);
}

function geolocationErrorMessage(
  error: GeolocationPositionError | Error,
  t: (key: TranslationKey) => string,
): string {
  if ('code' in error) {
    if (error.code === 1) return t('map.permissionDenied');
    if (error.code === 3) return t('map.locationTimeout');
  }
  return t('map.locationUnavailable');
}
