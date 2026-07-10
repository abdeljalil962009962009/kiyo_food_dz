import { useEffect, useState, type ReactNode } from 'react';
import { APIProvider, useMap } from '@vis.gl/react-google-maps';
import { AlertTriangle, Bike, Home, MapPin, RefreshCw, Store } from 'lucide-react';
import { useT } from '../lib/i18n-react';
import {
  GOOGLE_MAPS_API_KEY,
  GOOGLE_MAPS_MAP_ID,
  GOOGLE_MAPS_REGION,
  hasGoogleMapsKey,
  mapLanguage,
} from '../lib/googleMaps';

type GoogleMapShellProps = {
  children: ReactNode;
  fallbackHeightClass?: string;
};

export function GoogleMapShell({ children, fallbackHeightClass = 'h-[360px]' }: GoogleMapShellProps) {
  const { t, locale } = useT();
  const [loadFailed, setLoadFailed] = useState(false);

  if (!hasGoogleMapsKey() || loadFailed) {
    return (
      <div className={`flex ${fallbackHeightClass} min-h-64 flex-col items-center justify-center rounded-xl border border-ink-200 bg-ink-50 px-6 text-center`}>
        <span className="flex h-11 w-11 items-center justify-center rounded-full bg-warning-500/10 text-warning-600">
          <AlertTriangle className="h-5 w-5" />
        </span>
        <p className="mt-3 text-sm font-bold text-ink-900">
          {loadFailed ? t('map.loadFailedTitle') : t('map.configurationMissingTitle')}
        </p>
        <p className="mt-1 max-w-sm text-xs leading-5 text-ink-500">
          {loadFailed ? t('map.loadFailedBody') : t('map.configurationMissingBody')}
        </p>
        {loadFailed && (
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="kiyo-btn-secondary mt-4 px-4 py-2 text-xs"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            {t('error.retry')}
          </button>
        )}
      </div>
    );
  }

  return (
    <APIProvider
      apiKey={GOOGLE_MAPS_API_KEY}
      version="weekly"
      language={mapLanguage(locale)}
      region={GOOGLE_MAPS_REGION}
      onError={(error) => {
        console.error('[Kiyo Maps] Google Maps failed to load', error);
        setLoadFailed(true);
      }}
    >
      {children}
    </APIProvider>
  );
}

export function MapCircle({
  center,
  radius,
  color,
  fillOpacity = 0.12,
}: {
  center: google.maps.LatLngLiteral;
  radius: number;
  color: string;
  fillOpacity?: number;
}) {
  const map = useMap();

  useEffect(() => {
    if (!map || !Number.isFinite(radius) || radius <= 0) return;
    const circle = new google.maps.Circle({
      map,
      center,
      radius,
      strokeColor: color,
      strokeOpacity: 0.75,
      strokeWeight: 1.5,
      fillColor: color,
      fillOpacity,
      clickable: false,
    });
    return () => circle.setMap(null);
  }, [center, color, fillOpacity, map, radius]);

  return null;
}

export type MapMarkerKind = 'restaurant' | 'customer' | 'driver' | 'pin';

export function MapMarkerBadge({ kind }: { kind: MapMarkerKind }) {
  const Icon = kind === 'restaurant'
    ? Store
    : kind === 'customer'
      ? Home
      : kind === 'driver'
        ? Bike
        : MapPin;
  const colors = kind === 'restaurant'
    ? 'bg-ink-900 text-white'
    : kind === 'customer'
      ? 'bg-ember-600 text-white'
      : kind === 'driver'
        ? 'bg-sage-600 text-white'
        : 'bg-ember-600 text-white';

  return (
    <span className={`flex h-9 w-9 items-center justify-center rounded-full border-[3px] border-white shadow-card-lg ${colors}`}>
      <Icon className="h-4 w-4" aria-hidden="true" />
    </span>
  );
}

export { GOOGLE_MAPS_MAP_ID };
