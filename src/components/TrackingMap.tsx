import { useEffect, useMemo, useState } from 'react';
import { AdvancedMarker, Map, useMap, useMapsLibrary } from '@vis.gl/react-google-maps';
import { Clock3, Navigation } from 'lucide-react';
import { useT } from '../lib/i18n-react';
import { isValidMapCoordinate } from '../lib/googleMaps';
import { GoogleMapShell, GOOGLE_MAPS_MAP_ID, MapMarkerBadge } from './GoogleMapShell';

type TrackingMapProps = {
  restaurantLat: number;
  restaurantLng: number;
  deliveryLat: number;
  deliveryLng: number;
  driverLat?: number | null;
  driverLng?: number | null;
  status: string;
};

type RouteSummary = {
  distance: string;
  duration: string;
};

export default function TrackingMap(props: TrackingMapProps) {
  return (
    <GoogleMapShell fallbackHeightClass="h-[320px]">
      <TrackingMapInner {...props} />
    </GoogleMapShell>
  );
}

function TrackingMapInner({
  restaurantLat,
  restaurantLng,
  deliveryLat,
  deliveryLng,
  driverLat,
  driverLng,
  status,
}: TrackingMapProps) {
  const { t } = useT();
  const [tilesReady, setTilesReady] = useState(false);
  const [routeSummary, setRouteSummary] = useState<RouteSummary | null>(null);

  const restaurant = useMemo(() => ({ lat: restaurantLat, lng: restaurantLng }), [restaurantLat, restaurantLng]);
  const delivery = useMemo(() => ({ lat: deliveryLat, lng: deliveryLng }), [deliveryLat, deliveryLng]);
  const driver = useMemo(() => (
    isValidMapCoordinate(driverLat, driverLng)
      ? { lat: driverLat as number, lng: driverLng as number }
      : null
  ), [driverLat, driverLng]);

  const hasRequiredCoordinates = isValidMapCoordinate(restaurant.lat, restaurant.lng)
    && isValidMapCoordinate(delivery.lat, delivery.lng);
  const points = useMemo(
    () => driver ? [restaurant, delivery, driver] : [restaurant, delivery],
    [delivery, driver, restaurant],
  );

  if (!hasRequiredCoordinates) {
    return (
      <div className="flex h-[320px] items-center justify-center rounded-xl border border-ink-200 bg-ink-50 px-5 text-center text-sm text-ink-500">
        {t('map.locationUnavailableShort')}
      </div>
    );
  }

  const routeOrigin = driver ?? restaurant;

  return (
    <div className="relative h-[320px] w-full overflow-hidden rounded-xl border border-ink-200 bg-ink-100 shadow-card sm:h-[360px]">
      <Map
        defaultCenter={driver ?? restaurant}
        defaultZoom={14}
        mapId={GOOGLE_MAPS_MAP_ID}
        gestureHandling="cooperative"
        disableDefaultUI
        zoomControl
        fullscreenControl
        minZoom={5}
        maxZoom={20}
        reuseMaps
        onTilesLoaded={() => setTilesReady(true)}
        style={{ width: '100%', height: '100%' }}
      >
        <AdvancedMarker position={restaurant} title={t('map.restaurantMarker')} zIndex={1}>
          <MapMarkerBadge kind="restaurant" />
        </AdvancedMarker>
        <AdvancedMarker position={delivery} title={t('map.customerMarker')} zIndex={2}>
          <MapMarkerBadge kind="customer" />
        </AdvancedMarker>
        {driver && (
          <AdvancedMarker position={driver} title={t('map.driverMarker')} zIndex={3}>
            <span className="relative flex items-center justify-center">
              <span className="absolute h-12 w-12 animate-pulse rounded-full bg-sage-500/25" />
              <MapMarkerBadge kind="driver" />
            </span>
          </AdvancedMarker>
        )}
        <FitMapBounds points={points} />
        <DeliveryRoute origin={routeOrigin} destination={delivery} onSummary={setRouteSummary} />
      </Map>

      {!tilesReady && (
        <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center bg-ink-50/90 text-xs font-semibold text-ink-500">
          <span className="mr-2 h-2.5 w-2.5 animate-pulse rounded-full bg-ember-500" />
          {t('map.loading')}
        </div>
      )}

      <div className="absolute inset-x-3 bottom-3 z-20 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 rounded-lg border border-white/70 bg-white/95 px-3 py-2 text-[11px] font-bold text-ink-800 shadow-card backdrop-blur">
          <span className="h-2 w-2 animate-pulse rounded-full bg-sage-500" />
          {trackingStatusLabel(status, t)}
        </div>
        {routeSummary && (
          <div className="flex items-center gap-2 rounded-lg border border-white/70 bg-white/95 px-3 py-2 text-[11px] font-semibold text-ink-700 shadow-card backdrop-blur" dir="ltr">
            <Navigation className="h-3.5 w-3.5 text-ember-600" />
            <span>{routeSummary.distance}</span>
            <Clock3 className="h-3.5 w-3.5 text-ink-400" />
            <span>{routeSummary.duration}</span>
          </div>
        )}
      </div>
    </div>
  );
}

function FitMapBounds({ points }: { points: google.maps.LatLngLiteral[] }) {
  const map = useMap();

  useEffect(() => {
    if (!map || points.length === 0) return;
    const bounds = new google.maps.LatLngBounds();
    points.forEach((point) => bounds.extend(point));
    map.fitBounds(bounds, 64);
  }, [map, points]);

  return null;
}

function DeliveryRoute({
  origin,
  destination,
  onSummary,
}: {
  origin: google.maps.LatLngLiteral;
  destination: google.maps.LatLngLiteral;
  onSummary: (summary: RouteSummary | null) => void;
}) {
  const map = useMap();
  const routesLibrary = useMapsLibrary('routes');

  useEffect(() => {
    if (!map || !routesLibrary) return;
    const service = new routesLibrary.DirectionsService();
    const renderer = new routesLibrary.DirectionsRenderer({
      map,
      suppressMarkers: true,
      preserveViewport: true,
      polylineOptions: {
        strokeColor: '#ec3804',
        strokeOpacity: 0.9,
        strokeWeight: 5,
      },
    });
    let active = true;

    service.route({
      origin,
      destination,
      travelMode: google.maps.TravelMode.DRIVING,
      provideRouteAlternatives: false,
    }).then((result) => {
      if (!active) return;
      renderer.setDirections(result);
      const leg = result.routes[0]?.legs[0];
      onSummary(leg?.distance?.text && leg?.duration?.text
        ? { distance: leg.distance.text, duration: leg.duration.text }
        : null);
    }).catch((error) => {
      console.warn('[Kiyo Maps] Route is temporarily unavailable', error);
      if (active) onSummary(null);
    });

    return () => {
      active = false;
      renderer.setMap(null);
    };
  }, [destination, map, onSummary, origin, routesLibrary]);

  return null;
}

function trackingStatusLabel(
  status: string,
  t: ReturnType<typeof useT>['t'],
): string {
  if (['out_for_delivery', 'delivering', 'en_route'].includes(status)) return t('map.trackingRiderEnRoute');
  if (['preparing', 'accepted'].includes(status)) return t('map.trackingPreparing');
  return t('map.trackingLive');
}
