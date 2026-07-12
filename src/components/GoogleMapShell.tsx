import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { APIProvider, useMap } from '@vis.gl/react-google-maps';
import { AlertTriangle, Bike, Home, MapPin, RefreshCw, SignalLow, Store } from 'lucide-react';
import { useT } from '../lib/i18n-react';
import {
  GOOGLE_MAPS_API_KEY,
  GOOGLE_MAPS_MAP_ID,
  GOOGLE_MAPS_REGION,
  hasGoogleMapsKey,
  mapLanguage,
} from '../lib/googleMaps';
import { getConnectionQuality, type NetworkInformationLike } from '../lib/locationNetwork';

type GoogleMapShellProps = {
  children: ReactNode;
  fallbackHeightClass?: string;
};

type MapReadinessState = 'loading' | 'revealed' | 'slow' | 'ready';

export function useMapReadiness(resetKey: string | number = 'default') {
  const [state, setState] = useState<MapReadinessState>('loading');

  useEffect(() => {
    setState('loading');
    const revealTimer = window.setTimeout(() => {
      setState((current) => current === 'loading' ? 'revealed' : current);
    }, 2500);
    const slowTimer = window.setTimeout(() => {
      setState((current) => current === 'ready' ? current : 'slow');
    }, 8000);
    return () => {
      window.clearTimeout(revealTimer);
      window.clearTimeout(slowTimer);
    };
  }, [resetKey]);

  const markReady = useCallback(() => setState('ready'), []);

  return {
    isBlocking: state === 'loading',
    isSlow: state === 'slow',
    markReady,
  };
}

export function GoogleMapShell({ children, fallbackHeightClass = 'h-[360px]' }: GoogleMapShellProps) {
  const { t, locale } = useT();
  const [loadFailed, setLoadFailed] = useState(false);
  const [online, setOnline] = useState(() => navigator.onLine);
  const [attempt, setAttempt] = useState(0);
  const [automaticRetries, setAutomaticRetries] = useState(0);
  const [connectionQuality, setConnectionQuality] = useState(() => readConnectionQuality());

  useEffect(() => {
    const connection = getNetworkInformation();
    const updateConnection = () => {
      setOnline(navigator.onLine);
      setConnectionQuality(readConnectionQuality());
    };
    const handleOnline = () => updateConnection();
    const handleOffline = () => updateConnection();
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    connection?.addEventListener?.('change', updateConnection);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      connection?.removeEventListener?.('change', updateConnection);
    };
  }, []);

  useEffect(() => {
    if (!loadFailed || !online || automaticRetries >= 3) return;
    const delay = 1500 * 2 ** automaticRetries;
    const timer = window.setTimeout(() => {
      setAutomaticRetries((value) => value + 1);
      setLoadFailed(false);
      setAttempt((value) => value + 1);
    }, delay);
    return () => window.clearTimeout(timer);
  }, [automaticRetries, loadFailed, online]);

  if (!hasGoogleMapsKey() || loadFailed || !online) {
    const title = !online
      ? t('map.offlineTitle')
      : loadFailed
        ? t('map.loadFailedTitle')
        : t('map.configurationMissingTitle');
    const body = !online
      ? t('map.offlineBody')
      : loadFailed
        ? t('map.loadFailedBody')
        : t('map.configurationMissingBody');
    return (
      <div className={`flex ${fallbackHeightClass} min-h-64 flex-col items-center justify-center rounded-xl border border-ink-200 bg-ink-50 px-6 text-center`}>
        <span className="flex h-11 w-11 items-center justify-center rounded-full bg-warning-500/10 text-warning-600">
          <AlertTriangle className="h-5 w-5" />
        </span>
        <p className="mt-3 text-sm font-bold text-ink-900">
          {title}
        </p>
        <p className="mt-1 max-w-sm text-xs leading-5 text-ink-500">
          {body}
        </p>
        {(loadFailed || !online) && (
          <button
            type="button"
            onClick={() => {
              setOnline(navigator.onLine);
              setConnectionQuality(readConnectionQuality());
              setLoadFailed(false);
              setAutomaticRetries(0);
              setAttempt((value) => value + 1);
            }}
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
    <div className="min-w-0">
      {connectionQuality === 'slow' && (
        <div className="mb-2 flex min-h-11 items-center gap-2 rounded-lg border border-warning-200 bg-warning-50 px-3 py-2 text-xs font-medium text-warning-800" role="status">
          <SignalLow className="h-4 w-4 flex-none" />
          <span>{t('map.weakConnection')}</span>
        </div>
      )}
      <APIProvider
        key={`${mapLanguage(locale)}-${attempt}`}
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
    </div>
  );
}

type NavigatorWithConnection = Navigator & {
  connection?: NetworkInformationLike & {
    addEventListener?: (type: string, listener: () => void) => void;
    removeEventListener?: (type: string, listener: () => void) => void;
  };
};

function getNetworkInformation() {
  return (navigator as NavigatorWithConnection).connection ?? null;
}

function readConnectionQuality() {
  return getConnectionQuality(navigator.onLine, getNetworkInformation());
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
