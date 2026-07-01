import { useEffect, useMemo, useRef, useState } from 'react';
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from 'react-leaflet';
import L from 'leaflet';
import { MapPin, Locate, Search, AlertTriangle } from 'lucide-react';
import { supabase } from '../lib/supabase';

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

const CONSTANTINE: [number, number] = [36.365, 6.6147];

/**
 * Haversine distance in km between two [lat,lng] points.
 * Used to check if a delivery address is inside the restaurant's max zone.
 */
function haversineKm(a: [number, number], b: [number, number]): number {
  const R = 6371;
  const dLat = ((b[0] - a[0]) * Math.PI) / 180;
  const dLng = ((b[1] - a[1]) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a[0] * Math.PI) / 180) *
      Math.cos((b[0] * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
}

type Props = {
  restaurantLat?: number | null;
  restaurantLng?: number | null;
  maxDeliveryKm?: number;
  initialAddress?: string;
  onLocationChange: (loc: { lat: number; lng: number; address: string }) => void;
};

/**
 * DeliveryMap — interactive Leaflet map.
 *
 * Handles GPS permission gracefully (try/catch around geolocation),
 * supports tap-to-drop-pin, and reverse-geocodes via OSM Nominatim (free,
 * no API key). Falls back to a sensible default if GPS is refused or fails.
 */
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
  void searching; // reserved for a future loading indicator
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [gpsLoading, setGpsLoading] = useState(false);
  const mapRef = useRef<L.Map | null>(null);

  const distanceKm = useMemo(() => {
    if (!pin || !restaurantLat || !restaurantLng) return null;
    return haversineKm(pin, [restaurantLat, restaurantLng]);
  }, [pin, restaurantLat, restaurantLng]);

  const outOfZone = !!distanceKm && !!maxDeliveryKm && distanceKm > maxDeliveryKm;

  // Reverse-geocode a [lat,lng] to a readable address (free Nominatim).
  const reverseGeocode = async (lat: number, lng: number): Promise<string> => {
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`,
        { headers: { 'Accept-Language': 'en' } },
      );
      if (!res.ok) throw new Error('geocode failed');
      const data = await res.json();
      return data.display_name || `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
    } catch {
      return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
    }
  };

  // Forward-geocode a typed address to [lat,lng] (free Nominatim).
  const forwardGeocode = async (query: string): Promise<[number, number] | null> => {
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=jsonv2&q=${encodeURIComponent(query)}&limit=1`,
        { headers: { 'Accept-Language': 'en' } },
      );
      if (!res.ok) return null;
      const items = await res.json();
      if (!Array.isArray(items) || items.length === 0) return null;
      return [parseFloat(items[0].lat), parseFloat(items[0].lon)];
    } catch {
      return null;
    }
  };

  // Locate user via GPS. Gracefully handles permission denial or unsupported devices.
  const useGps = () => {
    if (!('geolocation' in navigator)) {
      setPermissionDenied(true);
      return;
    }
    setGpsLoading(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        setPin([latitude, longitude]);
        const addr = await reverseGeocode(latitude, longitude);
        setAddressText(addr);
        onLocationChange({ lat: latitude, lng: longitude, address: addr });
        setGpsLoading(false);
        mapRef.current?.flyTo([latitude, longitude], 15);
      },
      () => {
        setPermissionDenied(true);
        setGpsLoading(false);
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 30000 },
    );
  };

  // Map click → drop pin → reverse geocode.
  function MapClickHandler() {
    useMapEvents({
      click: async (e) => {
        const { lat, lng } = e.latlng;
        setPin([lat, lng]);
        const addr = await reverseGeocode(lat, lng);
        setAddressText(addr);
        onLocationChange({ lat, lng, address: addr });
      },
    });
    return null;
  }

  // Fly to restaurant when its coords load.
  function RestaurantFlyTo() {
    const map = useMap();
    useEffect(() => {
      if (restaurantLat && restaurantLng) {
        map.setView([restaurantLat, restaurantLng], 13);
      }
    }, [restaurantLat, restaurantLng, map]);
    return null;
  }

  const doSearch = async () => {
    if (!search.trim()) return;
    setSearching(true);
    try {
      const ll = await forwardGeocode(search.trim());
      if (ll) {
        setPin(ll);
        const addr = await reverseGeocode(ll[0], ll[1]);
        setAddressText(addr);
        onLocationChange({ lat: ll[0], lng: ll[1], address: addr });
        mapRef.current?.flyTo(ll, 15);
      }
    } finally {
      setSearching(false);
    }
  };

  return (
    <div className="space-y-3">
      {/* Search bar */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && doSearch()}
            placeholder="Search address, neighborhood, city…"
            className="kiyo-input pl-10"
            autoComplete="off"
          />
        </div>
        <button
          type="button"
          onClick={useGps}
          disabled={gpsLoading}
          className="kiyo-btn-secondary whitespace-nowrap"
          title="Use current location"
        >
          <Locate className="h-4 w-4" />
          <span className="hidden sm:inline">{gpsLoading ? 'Locating…' : 'GPS'}</span>
        </button>
      </div>

      {permissionDenied && (
        <div className="rounded-lg bg-warning-500/10 px-3 py-2 text-xs text-warning-600">
          Location permission denied — you can still search or tap the map to pick a delivery point.
        </div>
      )}

      {/* The map */}
      <div className="relative h-72 w-full overflow-hidden rounded-xl border border-ink-200 sm:h-80">
        <MapContainer
          center={restaurantLat && restaurantLng ? [restaurantLat, restaurantLng] : CONSTANTINE}
          zoom={13}
          scrollWheelZoom={false}
          className="h-full w-full"
          ref={(m) => { mapRef.current = m; }}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <MapClickHandler />
          <RestaurantFlyTo />
          {pin && <Marker position={pin} icon={blueIcon} />}
          {restaurantLat && restaurantLng && (
            <Marker position={[restaurantLat, restaurantLng]} icon={restaurantIcon} />
          )}
          {restaurantLat && restaurantLng && maxDeliveryKm && (
            <Circle center={[restaurantLat, restaurantLng]} radius={maxDeliveryKm * 1000} />
          )}
        </MapContainer>
      </div>

      {/* Address preview + out-of-zone warning */}
      {addressText && (
        <div className="rounded-lg bg-ink-50 px-3 py-2 text-xs">
          <div className="flex items-start gap-2">
            <MapPin className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-ember-500" />
            <div className="flex-1">
              <p className="font-medium text-ink-900">{addressText}</p>
              {distanceKm !== null && (
                <p className="mt-0.5 text-ink-500">
                  Distance: {distanceKm.toFixed(1)} km
                  {maxDeliveryKm ? ` · max ${maxDeliveryKm} km` : ''}
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

// Avoid importing the full react-leaflet Circle separately (re-export from main)
function Circle(props: { center: [number, number]; radius: number }) {
  const map = useMap();
  useEffect(() => {
    const c = L.circle(props.center, {
      radius: props.radius,
      color: '#ea580c',
      fillColor: '#ea580c',
      fillOpacity: 0.08,
      weight: 1,
    }).addTo(map);
    return () => { map.removeLayer(c); };
  }, [map, props.center, props.radius]);
  return null;
}

// Persist last-used delivery address to saved_addresses (no-op if not authed).
export async function saveAddressIfNew(loc: { lat: number; lng: number; address: string }, label: 'home' | 'work' | 'family' | 'other' = 'other') {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from('saved_addresses').insert({
      customer_id: user.id,
      label,
      address: loc.address,
      latitude: loc.lat,
      longitude: loc.lng,
      is_default: false,
    });
  } catch {
    // non-fatal
  }
}
