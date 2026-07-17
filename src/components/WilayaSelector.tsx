import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Building2,
  Check,
  ChevronDown,
  Clock3,
  Home,
  Info,
  LocateFixed,
  MapPin,
  ShieldCheck,
  X,
} from 'lucide-react';
import { useWilaya } from '../context/WilayaContext';
import { useAuth } from '../context/AuthContext';
import { useT } from '../lib/i18n-react';
import { supabase } from '../lib/supabase';
import { withExponentialBackoff } from '../lib/locationNetwork';
import {
  EMPTY_DELIVERY_DETAILS,
  LAST_MAP_STATE_STORAGE_KEY,
  locationPrimaryLine,
  locationSecondaryLine,
  restoreLastMapState,
  sanitizeDeliveryDetails,
  type DeliveryDetails,
  type DeliveryLocation,
} from '../lib/location';

const DeliveryMap = lazy(() => import('./DeliveryMap'));
const LOCATION_NOTICE_SESSION_KEY = 'kiyo-location-web-accuracy-notice-dismissed';

type SavedAddressRow = {
  id: string;
  label: 'home' | 'work' | 'family' | 'other';
  custom_name?: string | null;
  address: string;
  latitude: number;
  longitude: number;
  accuracy_m?: number | null;
  place_id?: string | null;
  street?: string | null;
  neighborhood?: string | null;
  commune?: string | null;
  city?: string | null;
  province?: string | null;
  postal_code?: string | null;
  country?: string | null;
  location_source?: DeliveryLocation['source'] | null;
  landmark?: string | null;
  driver_instructions?: string | null;
  is_default?: boolean;
};

type SelectorVariant = 'dropdown' | 'inline' | 'mobile';

type LocationInsights = {
  serviceable_restaurant_count: number;
  repeat_order_count: number;
  has_saved_address: boolean;
  prompt_responded: boolean;
  location_key: string;
};

export function WilayaSelector({ variant = 'dropdown' }: { variant?: SelectorVariant }) {
  const { t } = useT();
  const { deliveryLocation } = useWilaya();
  const [open, setOpen] = useState(false);
  const primary = locationPrimaryLine(deliveryLocation);
  const secondary = locationSecondaryLine(deliveryLocation);

  const fullWidth = variant === 'mobile' || variant === 'inline';
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`group flex min-h-11 items-center gap-2.5 rounded-lg border border-ink-100 bg-white px-3 py-1.5 text-left transition-colors hover:border-ember-200 hover:bg-ember-50/40 ${fullWidth ? 'w-full' : 'w-[248px]'}`}
        aria-haspopup="dialog"
        aria-expanded={open}
        data-testid="delivery-location-trigger"
      >
        <span className="flex h-8 w-8 flex-none items-center justify-center rounded-full bg-ember-50 text-ember-600">
          <MapPin className="h-4 w-4" aria-hidden="true" />
        </span>
        <span className="min-w-0 flex-1 leading-tight">
          <span className="block text-[10px] font-bold uppercase text-ink-400">{t('location.deliverTo')}</span>
          <span className="mt-0.5 block truncate text-xs font-bold text-ink-900">
            {primary || t('location.chooseExact')}
          </span>
          {secondary && <span className="mt-0.5 block truncate text-[10px] text-ink-500">{secondary}</span>}
        </span>
        <ChevronDown className="h-3.5 w-3.5 flex-none text-ink-400 transition-transform group-hover:text-ember-600" />
      </button>
      {open && <LocationDialog onClose={() => setOpen(false)} />}
    </>
  );
}

function LocationDialog({ onClose }: { onClose: () => void }) {
  const { t, locale } = useT();
  const { user } = useAuth();
  const { deliveryLocation, setDeliveryLocation } = useWilaya();
  const [recentLocation] = useState<DeliveryLocation | null>(() => {
    if (typeof window === 'undefined') return null;
    return restoreLastMapState(localStorage.getItem(LAST_MAP_STATE_STORAGE_KEY));
  });
  const [draft, setDraft] = useState<DeliveryLocation | null>(deliveryLocation ?? recentLocation);
  const [details, setDetails] = useState<DeliveryDetails>({
    ...sanitizeDeliveryDetails(deliveryLocation?.details),
  });
  const [saved, setSaved] = useState<SavedAddressRow[]>([]);
  const [savedLoading, setSavedLoading] = useState(Boolean(user));
  const [mapRevision, setMapRevision] = useState(0);
  const [confirmationSuccess, setConfirmationSuccess] = useState(false);
  const [insights, setInsights] = useState<LocationInsights | null>(null);
  const [showWebAccuracyNotice, setShowWebAccuracyNotice] = useState(readWebAccuracyNotice);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', handleKey);
    };
  }, [onClose]);

  useEffect(() => {
    if (!user) return;
    let active = true;
    void supabase
      .from('saved_addresses')
      .select('*')
      .eq('customer_id', user.id)
      .or('is_archived.is.null,is_archived.eq.false')
      .order('is_default', { ascending: false })
      .order('last_used_at', { ascending: false, nullsFirst: false })
      .limit(6)
      .then(({ data }) => {
        if (active) {
          setSaved([...(data as SavedAddressRow[] | null) ?? []].sort((a, b) => savedAddressPriority(a) - savedAddressPriority(b)));
          setSavedLoading(false);
        }
      }, () => {
        if (active) setSavedLoading(false);
      });
    return () => { active = false; };
  }, [user]);

  useEffect(() => {
    if (!draft?.confirmed) {
      setInsights(null);
      return;
    }
    let active = true;
    const timer = window.setTimeout(() => {
      void withExponentialBackoff(async () => {
        const { data, error } = await supabase.rpc('get_location_insights', {
          p_lat: draft.lat,
          p_lng: draft.lng,
        });
        if (error) throw error;
        return data as LocationInsights;
      }, { attempts: 2, timeoutMs: 12000 }).then((data) => {
        if (active) setInsights(data);
      }, () => {
        if (active) setInsights(null);
      });
    }, 350);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [draft?.confirmed, draft?.lat, draft?.lng]);

  const selectedSummary = useMemo(() => {
    if (!draft) return null;
    return [locationPrimaryLine(draft), locationSecondaryLine(draft)].filter(Boolean).join(', ');
  }, [draft]);

  const selectSaved = (address: SavedAddressRow) => {
    const next: DeliveryLocation = {
      lat: address.latitude,
      lng: address.longitude,
      address: address.address,
      accuracy: address.accuracy_m ?? null,
      source: address.location_source ?? 'manual',
      confirmed: true,
      placeId: address.place_id ?? null,
      addressQuality: 'manual',
      addressParts: {
        displayName: address.address,
        street: address.street ?? undefined,
        neighborhood: address.neighborhood ?? undefined,
        commune: address.commune ?? undefined,
        city: address.city ?? undefined,
        province: address.province ?? undefined,
        postalCode: address.postal_code ?? undefined,
        country: address.country ?? 'Algeria',
        placeId: address.place_id ?? undefined,
        provider: address.place_id ? 'google' : 'manual',
      },
      requiresManualAdjustment: false,
      details: {
        landmark: address.landmark ?? '',
        instructions: address.driver_instructions ?? '',
      },
    };
    setDraft(next);
    setDetails(next.details ?? EMPTY_DELIVERY_DETAILS);
    setMapRevision((value) => value + 1);
  };

  const confirm = () => {
    if (!draft?.confirmed || confirmationSuccess) return;
    setDeliveryLocation({ ...draft, details });
    setConfirmationSuccess(true);
    if ('vibrate' in navigator) navigator.vibrate(24);
    window.setTimeout(onClose, 420);
  };

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-end justify-center bg-ink-950/45 p-0 backdrop-blur-sm sm:items-center sm:p-5" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section
        className="flex h-[100dvh] max-h-[100dvh] w-full flex-col overflow-hidden bg-white shadow-2xl sm:h-auto sm:max-h-[92dvh] sm:max-w-6xl sm:rounded-xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="location-dialog-title"
        dir={locale === 'ar' ? 'rtl' : 'ltr'}
        data-testid="delivery-location-dialog"
      >
        <header className="flex min-h-16 items-center gap-3 border-b border-ink-100 px-[max(1rem,env(safe-area-inset-left))] pb-3 pe-[max(1rem,env(safe-area-inset-right))] pt-[calc(0.75rem+env(safe-area-inset-top))] sm:px-5 sm:py-3">
          <span className="flex h-10 w-10 flex-none items-center justify-center rounded-full bg-ember-50 text-ember-600">
            <LocateFixed className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 id="location-dialog-title" className="font-display text-sm font-bold text-ink-900 min-[360px]:text-base sm:text-lg">{t('location.title')}</h2>
            <p className="mt-0.5 text-xs text-ink-500">{t('location.privacy')}</p>
          </div>
          <button type="button" onClick={onClose} className="flex h-11 w-11 items-center justify-center rounded-lg text-ink-500 hover:bg-ink-100" aria-label={t('common.close')}>
            <X className="h-5 w-5" />
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain sm:grid sm:grid-cols-[280px_minmax(0,1fr)] sm:overflow-hidden">
          <aside className={`shrink-0 border-b border-ink-100 bg-ink-50/70 p-3 sm:overflow-y-auto sm:border-b-0 sm:border-r sm:p-5 ${!savedLoading && saved.length === 0 ? '[@media(max-height:650px)]:hidden' : ''}`}>
            <h3 className="text-xs font-bold uppercase text-ink-400">{t('location.useSaved')}</h3>
            <div className="mt-2 flex gap-2 overflow-x-auto pb-1 sm:block sm:space-y-2 sm:overflow-visible sm:pb-0">
              {savedLoading && <LocationSkeleton />}
              {!savedLoading && saved.map((address) => (
                <button
                  key={address.id}
                  type="button"
                  onClick={() => selectSaved(address)}
                  className={`flex min-h-16 w-[min(74vw,260px)] flex-none items-start gap-3 rounded-lg border bg-white p-3 text-left transition-colors hover:border-ember-200 hover:bg-ember-50/40 sm:w-full ${address.is_default ? 'border-ember-300 ring-1 ring-ember-100' : 'border-ink-100'}`}
                >
                  <span className="mt-0.5 flex h-8 w-8 flex-none items-center justify-center rounded-full bg-ink-100 text-ink-700">
                    {address.label === 'home' ? <Home className="h-4 w-4" /> : address.label === 'work' ? <Building2 className="h-4 w-4" /> : <Clock3 className="h-4 w-4" />}
                  </span>
                  <span className="min-w-0">
                    <span className="flex flex-wrap items-center gap-1 text-xs font-bold text-ink-900">
                      {address.custom_name || t(`profile.addresses.${address.label}`)}
                      {address.is_default && <span className="rounded-full bg-ember-50 px-1.5 py-0.5 text-[9px] uppercase text-ember-700">{t('location.defaultAddress')}</span>}
                    </span>
                    <span className="mt-0.5 block line-clamp-2 text-[11px] leading-4 text-ink-500">{address.address}</span>
                  </span>
                </button>
              ))}
              {!savedLoading && saved.length === 0 && (
                <div className="w-full rounded-lg border border-dashed border-ink-200 bg-white px-3 py-3 text-center text-xs leading-5 text-ink-500">
                  {t('location.noSaved')}
                </div>
              )}
            </div>
            {recentLocation && !deliveryLocation && (
              <div className="mt-3">
                <h3 className="text-[10px] font-bold uppercase text-ink-400">{t('location.recent')}</h3>
                <button
                  type="button"
                  onClick={() => {
                    setDraft(recentLocation);
                    setMapRevision((value) => value + 1);
                  }}
                  className="mt-1 flex min-h-14 w-full items-center gap-2 rounded-lg border border-ink-100 bg-white px-3 py-2 text-left"
                >
                  <Clock3 className="h-4 w-4 flex-none text-ember-600" />
                  <span className="min-w-0">
                    <span className="block truncate text-xs font-bold text-ink-900">{locationPrimaryLine(recentLocation)}</span>
                    <span className="block truncate text-[10px] text-ink-500">{t('location.recentNeedsConfirmation')}</span>
                  </span>
                </button>
              </div>
            )}
            <div className="mt-3 hidden items-start gap-2 rounded-lg bg-sage-50 px-3 py-3 text-[11px] leading-4 text-sage-800 sm:flex">
              <ShieldCheck className="mt-0.5 h-4 w-4 flex-none" />
              <span>{t('location.privacyShort')}</span>
            </div>
          </aside>

          <main className="min-w-0 p-3 sm:overflow-y-auto sm:p-5">
            {showWebAccuracyNotice && (
              <div className="mb-3 flex items-start gap-2 rounded-lg border border-blue-100 bg-blue-50 px-3 py-2.5 text-xs leading-5 text-blue-900" role="status" data-testid="web-location-accuracy-notice">
                <Info className="mt-0.5 h-4 w-4 flex-none text-blue-600" />
                <span className="min-w-0 flex-1">{t('location.webAccuracyNotice')}</span>
                <button
                  type="button"
                  onClick={() => {
                    dismissWebAccuracyNotice();
                    setShowWebAccuracyNotice(false);
                  }}
                  className="flex h-9 w-9 flex-none items-center justify-center rounded-md text-blue-700 hover:bg-blue-100"
                  aria-label={t('location.dismissAccuracyNotice')}
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            )}
            <h3 className="mb-2 text-xs font-bold uppercase text-ink-400">{t('location.differentLocation')}</h3>
            <Suspense fallback={<div className="h-[440px] animate-pulse rounded-xl bg-ink-100" aria-label={t('map.loading')} />}>
              <DeliveryMap
                key={mapRevision}
                purpose="customer"
                gpsFirst={!savedLoading && saved.length === 0 && !deliveryLocation}
                initialLocation={draft}
                onLocationChange={(location) => setDraft({ ...location, details })}
              />
            </Suspense>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <DetailField label={t('location.landmark')} value={details.landmark} onChange={(landmark) => setDetails((current) => ({ ...current, landmark }))} className="sm:col-span-2" />
              <DetailField label={t('location.instructions')} value={details.instructions} onChange={(instructions) => setDetails((current) => ({ ...current, instructions }))} className="sm:col-span-2" />
            </div>
          </main>
        </div>

        <footer className="border-t border-ink-100 bg-white px-4 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-3 sm:flex sm:items-center sm:gap-4 sm:px-5 sm:pb-4">
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-bold text-ink-900">{selectedSummary || t('location.notConfirmed')}</p>
            <p className="mt-0.5 text-[11px] text-ink-500">{draft?.confirmed ? t('location.ready') : t('location.confirmOnMap')}</p>
            {draft?.confirmed && insights && insights.serviceable_restaurant_count > 0 && (
              <p className="mt-1 text-[11px] font-semibold text-sage-700">
                {insights.serviceable_restaurant_count.toLocaleString(locale)} {t(insights.serviceable_restaurant_count === 1 ? 'location.restaurantDeliversHere' : 'location.restaurantsDeliverHere')}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={confirm}
            disabled={!draft?.confirmed || confirmationSuccess}
            className={`mt-3 flex h-12 w-full items-center justify-center gap-2 rounded-lg px-5 text-sm font-bold text-white transition-colors sm:mt-0 sm:w-auto ${confirmationSuccess ? 'bg-sage-600' : 'bg-ink-900 hover:bg-ink-800 disabled:bg-ink-300'}`}
            data-testid="confirm-delivery-location"
            aria-live="polite"
          >
            <Check className={`h-4 w-4 ${confirmationSuccess ? 'animate-bounce' : ''}`} />
            {confirmationSuccess ? t('location.confirmedSuccess') : t('location.confirmDelivery')}
          </button>
        </footer>
      </section>
    </div>,
    document.body,
  );
}

function DetailField({ label, value, onChange, className = '' }: { label: string; value: string; onChange: (value: string) => void; className?: string }) {
  return (
    <label className={className}>
      <span className="kiyo-label">{label}</span>
      <input className="kiyo-input h-11" value={value} onChange={(event) => onChange(event.target.value)} maxLength={240} />
    </label>
  );
}

function readWebAccuracyNotice(): boolean {
  try {
    return sessionStorage.getItem(LOCATION_NOTICE_SESSION_KEY) !== 'true';
  } catch {
    return true;
  }
}

function dismissWebAccuracyNotice(): void {
  try {
    sessionStorage.setItem(LOCATION_NOTICE_SESSION_KEY, 'true');
  } catch {
    // The notice remains dismissible in memory when session storage is unavailable.
  }
}

function LocationSkeleton() {
  return (
    <div className="space-y-2" aria-hidden="true">
      {[0, 1].map((item) => <div key={item} className="h-16 animate-pulse rounded-lg bg-ink-100" />)}
    </div>
  );
}

function savedAddressPriority(address: SavedAddressRow): number {
  if (address.is_default) return 0;
  if (address.label === 'home') return 1;
  if (address.label === 'work') return 2;
  return 3;
}
