/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { APIProvider, Map, AdvancedMarker, useMap, useMapsLibrary } from '@vis.gl/react-google-maps';
import { MapPin, Locate, Search, AlertTriangle, CheckCircle, Crosshair } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { formatDistanceKm, haversineKm, isCoordinateInAlgeria, type LiveGeoPoint } from '../lib/geo';
import { useT } from '../lib/i18n-react';

const API_KEY =
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  process.env.GOOGLE_MAPS_PLATFORM_KEY ||
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (import.meta as any).env?.VITE_GOOGLE_MAPS_PLATFORM_KEY ||
  (globalThis as any).GOOGLE_MAPS_PLATFORM_KEY ||
  '';
const hasValidKey = Boolean(API_KEY) && API_KEY !== 'YOUR_API_KEY';

export type DeliveryMapLocation = {
  lat: number;
  lng: number;
  address: string;
  accuracy: number | null;
  source: LiveGeoPoint['source'] | 'search' | 'manual';
  confirmed: boolean;
};

type Props = {
  restaurantLat?: number | null;
  restaurantLng?: number | null;
  maxDeliveryKm?: number;
  initialAddress?: string;
  purpose?: 'customer' | 'restaurant' | 'driver';
  onLocationChange: (loc: DeliveryMapLocation) => void;
};

function MapCircle({ center, radius, color }: { center: { lat: number; lng: number }; radius: number; color: string }) {
  const map = useMap();
  useEffect(() => {
    if (!map) return;
    const circle = new google.maps.Circle({
      strokeColor: color,
      strokeOpacity: 0.8,
      strokeWeight: 2,
      fillColor: color,
      fillOpacity: 0.15,
      map,
      center,
      radius,
    });
    return () => circle.setMap(null);
  }, [map, center, radius, color]);
  return null;
}

export default function DeliveryMapWrapper(props: Props) {
   
  if (!hasValidKey) {
    return (
      <div className="flex h-[400px] flex-col items-center justify-center rounded-xl border border-warning-200 bg-warning-50 px-6 text-center shadow-sm">
        <AlertTriangle className="mb-3 h-8 w-8 text-warning-500" />
        <h3 className="mb-2 font-display text-lg font-bold text-warning-900">Google Maps API Key Required</h3>
        <p className="mb-4 text-sm text-warning-700">
          Please add <code className="rounded bg-warning-100 px-1 py-0.5 font-mono">GOOGLE_MAPS_PLATFORM_KEY</code> to your AI Studio Secrets (⚙️ Settings &gt; Secrets). The app will automatically rebuild.
        </p>
        <a 
          href="https://console.cloud.google.com/google/maps-apis/start?utm_campaign=gmp-code-assist-ais" 
          target="_blank" 
          rel="noopener noreferrer"
          className="kiyo-btn-primary"
        >
          Get API Key
        </a>
      </div>
    );
  }

  return (
    <APIProvider apiKey={API_KEY} version="weekly">
      <DeliveryMapInner {...props} />
    </APIProvider>
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
  
  const map = useMap();
  const placesLib = useMapsLibrary('places');
  const geocodingLib = useMapsLibrary('geocoding');
  
  const [center, setCenter] = useState({ lat: 36.7538, lng: 3.0588 }); // Algiers default
  const [addressText, setAddressText] = useState(initialAddress ?? '');
  const [search, setSearch] = useState('');
  const [suggestions, setSuggestions] = useState<google.maps.places.AutocompletePrediction[]>([]);
  const [searching, setSearching] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  
  const [currentLocation, setCurrentLocation] = useState<DeliveryMapLocation | null>(null);
  const [gpsWarning, setGpsWarning] = useState<string | null>(null);
  const [gpsLoading, setGpsLoading] = useState(false);
  
  const autocompleteService = useRef<google.maps.places.AutocompleteService | null>(null);
  const geocoder = useRef<google.maps.Geocoder | null>(null);
  
  useEffect(() => {
    if (placesLib && !autocompleteService.current) {
      autocompleteService.current = new placesLib.AutocompleteService();
    }
    if (geocodingLib && !geocoder.current) {
      geocoder.current = new geocodingLib.Geocoder();
    }
  }, [placesLib, geocodingLib]);

  // Initial location set if restaurant coordinates are provided
  useEffect(() => {
    if (purpose === 'restaurant' && restaurantLat && restaurantLng) {
      setCenter({ lat: restaurantLat, lng: restaurantLng });
    }
  }, [restaurantLat, restaurantLng, purpose]);

  const reverseGeocode = useCallback((lat: number, lng: number) => {
    if (!geocoder.current) return;
    setSearching(true);
    geocoder.current.geocode({ location: { lat, lng }, language: document.documentElement.lang || 'fr' }, (results, status) => {
      setSearching(false);
      if (status === 'OK' && results && results[0]) {
        setAddressText(results[0].formatted_address);
        const loc: DeliveryMapLocation = {
          lat,
          lng,
          address: results[0].formatted_address,
          accuracy: null,
          source: 'manual',
          confirmed: false,
        };
        setCurrentLocation(loc);
        onLocationChange(loc);
        setGpsWarning(t('map.confirmDraggedPin'));
      }
    });
  }, [onLocationChange, t]);

  const handleIdle = () => {
    setIsDragging(false);
    if (!map) return;
    const pos = map.getCenter();
    if (pos) {
      const lat = pos.lat();
      const lng = pos.lng();
      setCenter({ lat, lng });
      if (!isCoordinateInAlgeria(lat, lng)) {
        setGpsWarning(t('map.locationOutsideAlgeria'));
        return;
      }
      reverseGeocode(lat, lng);
    }
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setSearch(val);
    if (!val.trim() || !autocompleteService.current) {
      setSuggestions([]);
      return;
    }
    autocompleteService.current.getPlacePredictions({
      input: val,
      componentRestrictions: { country: 'dz' },
      language: document.documentElement.lang || 'fr'
    }, (preds, status) => {
      if (status === 'OK' && preds) {
        setSuggestions(preds);
      } else {
        setSuggestions([]);
      }
    });
  };

  const handleSelectPlace = (placeId: string, description: string) => {
    setSearch(description);
    setSuggestions([]);
    if (!geocoder.current) return;
    setSearching(true);
    geocoder.current.geocode({ placeId, language: document.documentElement.lang || 'fr' }, (results, status) => {
      setSearching(false);
      if (status === 'OK' && results && results[0]) {
        const loc = results[0].geometry.location;
        const lat = loc.lat();
        const lng = loc.lng();
        map?.panTo({ lat, lng });
        map?.setZoom(16);
        setAddressText(description);
        const newLoc: DeliveryMapLocation = {
          lat,
          lng,
          address: description,
          accuracy: null,
          source: 'search',
          confirmed: false,
        };
        setCurrentLocation(newLoc);
        onLocationChange(newLoc);
        setGpsWarning(t('map.confirmSearchPin'));
      }
    });
  };

  const useGps = () => {
    if (!navigator.geolocation) return;
    setGpsLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGpsLoading(false);
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        const acc = pos.coords.accuracy;
        map?.panTo({ lat, lng });
        map?.setZoom(17);
        if (!geocoder.current) return;
        geocoder.current.geocode({ location: { lat, lng }, language: document.documentElement.lang || 'fr' }, (results, status) => {
          if (status === 'OK' && results && results[0]) {
            const addr = results[0].formatted_address;
            setAddressText(addr);
            const newLoc: DeliveryMapLocation = {
              lat,
              lng,
              address: addr,
              accuracy: acc,
              source: 'gps',
              confirmed: true, // GPS is usually accurate enough to auto-confirm, but we can ask user.
            };
            setCurrentLocation(newLoc);
            onLocationChange(newLoc);
            if (acc > 100) {
              setGpsWarning(t('map.gpsApproximate'));
              setCurrentLocation({ ...newLoc, confirmed: false });
            } else {
              setGpsWarning(null);
            }
          }
        });
      },
      () => {
        setGpsLoading(false);
        setGpsWarning(t('map.locationUnavailable'));
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  const confirmPin = () => {
    if (!currentLocation) return;
    const confirmed = { ...currentLocation, confirmed: true };
    setCurrentLocation(confirmed);
    onLocationChange(confirmed);
    setGpsWarning(null);
  };

  const distanceKm = useMemo(() => {
    if (!currentLocation || !restaurantLat || !restaurantLng) return null;
    return haversineKm({ lat: currentLocation.lat, lng: currentLocation.lng }, { lat: restaurantLat, lng: restaurantLng });
  }, [currentLocation, restaurantLat, restaurantLng]);

  const outOfZone = !!distanceKm && !!maxDeliveryKm && distanceKm > maxDeliveryKm;

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className={`pointer-events-none absolute top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400 ${isRtl ? 'right-3' : 'left-3'}`} />
          <input
            value={search}
            onChange={handleSearchChange}
            placeholder={t('map.searchPlaceholder')}
            className={`kiyo-input ${isRtl ? 'pr-10 text-right' : 'pl-10'}`}
            autoComplete="off"
            dir={isRtl ? 'rtl' : 'ltr'}
          />
          {suggestions.length > 0 && (
            <div className="absolute z-[1000] mt-1 max-h-56 w-full overflow-auto rounded-xl border border-ink-100 bg-white py-1 shadow-xl">
              {suggestions.map((item) => (
                <button
                  key={item.place_id}
                  type="button"
                  onClick={() => handleSelectPlace(item.place_id, item.description)}
                  className={`block w-full px-3 py-2 text-xs text-ink-700 hover:bg-ember-50 ${isRtl ? 'text-right' : 'text-left'}`}
                >
                  <strong className="font-semibold">{item.structured_formatting.main_text}</strong>
                  <span className="ml-1 text-ink-500">{item.structured_formatting.secondary_text}</span>
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

      {searching && <p className="text-xs font-medium text-ink-400">{t('map.searching')}</p>}

      {gpsWarning && (
        <div className="flex items-start gap-2 rounded-lg bg-warning-500/10 px-3 py-2 text-xs text-warning-700">
          <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
          <span>{gpsWarning}</span>
        </div>
      )}

      <div className="relative h-[360px] w-full overflow-hidden rounded-xl border border-ink-200 shadow-sm sm:h-[420px]">
        <Map
          defaultCenter={center}
          defaultZoom={15}
          mapId="DEMO_MAP_ID"
          internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
          gestureHandling="greedy"
          disableDefaultUI
          onDragstart={() => setIsDragging(true)}
          onIdle={handleIdle}
          style={{ width: '100%', height: '100%' }}
        >
          {restaurantLat && restaurantLng && (
            <AdvancedMarker position={{ lat: restaurantLat, lng: restaurantLng }} title="Restaurant">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg border-2 border-white bg-slate-900 text-white shadow-lg">
                🍳
              </div>
            </AdvancedMarker>
          )}
          
          {restaurantLat && restaurantLng && maxDeliveryKm && (
            <MapCircle center={{ lat: restaurantLat, lng: restaurantLng }} radius={maxDeliveryKm * 1000} color="#ea580c" />
          )}
          
          {currentLocation?.accuracy && currentLocation.accuracy > 0 && (
            <MapCircle center={{ lat: currentLocation.lat, lng: currentLocation.lng }} radius={currentLocation.accuracy} color="#2563eb" />
          )}
        </Map>
        
        {/* Fixed Center Pin (Uber style) */}
        <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
          <div className={`relative flex flex-col items-center justify-center transition-transform duration-200 ${isDragging ? '-translate-y-4 scale-110' : ''}`}>
            <div className="flex items-center justify-center rounded-full bg-ember-600 p-2 text-white shadow-xl ring-4 ring-white">
              <Crosshair className="h-5 w-5" />
            </div>
            <div className="mt-1 h-2 w-2 rounded-full bg-ink-900/20 blur-[2px]" />
          </div>
        </div>
      </div>

      {addressText && (
        <div className="rounded-xl border border-ink-100 bg-white p-4 shadow-sm">
          <div className="flex items-start gap-3">
            <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-ember-50 text-ember-600">
              <MapPin className="h-4 w-4" />
            </div>
            <div className="flex-1">
              <p className="font-semibold text-ink-900">{addressText}</p>
              {distanceKm !== null && (
                <p className="mt-1 flex items-center gap-1.5 text-sm font-medium text-ink-600">
                  <span className={outOfZone ? 'text-error-600' : 'text-sage-600'}>
                    {formatDistanceKm(distanceKm)}
                  </span>
                  <span className="text-ink-400">away</span>
                  {maxDeliveryKm ? <span className="text-ink-400">({maxDeliveryKm} km max)</span> : null}
                </p>
              )}
            </div>
          </div>
          
          {currentLocation && !currentLocation.confirmed && !outOfZone && (
            <button
              type="button"
              onClick={confirmPin}
              className="mt-4 w-full rounded-xl bg-ink-900 py-3 text-sm font-bold text-white transition-all hover:bg-ink-800 active:scale-[0.98]"
            >
              {t('map.confirmPin')}
            </button>
          )}
          
          {currentLocation?.confirmed && !outOfZone && (
            <div className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-sage-50 py-3 text-sm font-bold text-sage-700">
              <CheckCircle className="h-4 w-4" />
              Location Confirmed
            </div>
          )}
        </div>
      )}

      {outOfZone && (
        <div className="flex items-start gap-3 rounded-xl bg-error-50 p-4 text-error-700">
          <AlertTriangle className="mt-0.5 h-5 w-5 flex-shrink-0" />
          <div>
            <p className="font-bold">Outside Delivery Zone</p>
            <p className="mt-1 text-sm text-error-600">
              This location is {distanceKm?.toFixed(1)} km away, which exceeds the restaurant's maximum delivery distance of {maxDeliveryKm} km.
            </p>
          </div>
        </div>
      )}
    </div>
  );
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
