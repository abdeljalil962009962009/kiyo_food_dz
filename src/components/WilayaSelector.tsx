import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Building2,
  Check,
  ChevronDown,
  Clock3,
  Home,
  LocateFixed,
  MapPin,
  ShieldCheck,
  X,
} from 'lucide-react';
import { useWilaya } from '../context/WilayaContext';
import { useAuth } from '../context/AuthContext';
import { useT } from '../lib/i18n-react';
import { supabase } from '../lib/supabase';
import {
  EMPTY_DELIVERY_DETAILS,
  locationPrimaryLine,
  locationSecondaryLine,
  type DeliveryDetails,
  type DeliveryLocation,
} from '../lib/location';

const DeliveryMap = lazy(() => import('./DeliveryMap'));

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
  building?: string | null;
  floor?: string | null;
  apartment?: string | null;
  entrance?: string | null;
  landmark?: string | null;
  driver_instructions?: string | null;
  is_default?: boolean;
};

type SelectorVariant = 'dropdown' | 'inline' | 'mobile';

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
  const [draft, setDraft] = useState<DeliveryLocation | null>(deliveryLocation);
  const [details, setDetails] = useState<DeliveryDetails>({
    ...EMPTY_DELIVERY_DETAILS,
    ...deliveryLocation?.details,
  });
  const [saved, setSaved] = useState<SavedAddressRow[]>([]);
  const [savedLoading, setSavedLoading] = useState(Boolean(user));
  const [mapRevision, setMapRevision] = useState(0);

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
          setSaved((data as SavedAddressRow[] | null) ?? []);
          setSavedLoading(false);
        }
      });
    return () => { active = false; };
  }, [user]);

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
        building: address.building ?? '',
        floor: address.floor ?? '',
        apartment: address.apartment ?? '',
        entrance: address.entrance ?? '',
        landmark: address.landmark ?? '',
        instructions: address.driver_instructions ?? '',
      },
    };
    setDraft(next);
    setDetails(next.details ?? EMPTY_DELIVERY_DETAILS);
    setMapRevision((value) => value + 1);
  };

  const confirm = () => {
    if (!draft?.confirmed) return;
    setDeliveryLocation({ ...draft, details });
    onClose();
  };

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-end justify-center bg-ink-950/45 p-0 backdrop-blur-sm sm:items-center sm:p-5" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section
        className="flex h-[100dvh] w-full flex-col overflow-hidden bg-white shadow-2xl sm:h-auto sm:max-h-[92dvh] sm:max-w-6xl sm:rounded-xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="location-dialog-title"
        dir={locale === 'ar' ? 'rtl' : 'ltr'}
        data-testid="delivery-location-dialog"
      >
        <header className="flex min-h-16 items-center gap-3 border-b border-ink-100 px-4 py-3 sm:px-5">
          <span className="flex h-10 w-10 flex-none items-center justify-center rounded-full bg-ember-50 text-ember-600">
            <LocateFixed className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 id="location-dialog-title" className="font-display text-base font-bold text-ink-900 sm:text-lg">{t('location.title')}</h2>
            <p className="mt-0.5 text-xs text-ink-500">{t('location.privacy')}</p>
          </div>
          <button type="button" onClick={onClose} className="flex h-11 w-11 items-center justify-center rounded-lg text-ink-500 hover:bg-ink-100" aria-label={t('common.close')}>
            <X className="h-5 w-5" />
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto sm:grid sm:grid-cols-[280px_minmax(0,1fr)] sm:overflow-hidden">
          <aside className="border-b border-ink-100 bg-ink-50/70 p-4 sm:overflow-y-auto sm:border-b-0 sm:border-r sm:p-5">
            <h3 className="text-xs font-bold uppercase text-ink-400">{t('location.saved')}</h3>
            <div className="mt-3 space-y-2">
              {savedLoading && <LocationSkeleton />}
              {!savedLoading && saved.map((address) => (
                <button
                  key={address.id}
                  type="button"
                  onClick={() => selectSaved(address)}
                  className="flex w-full items-start gap-3 rounded-lg border border-ink-100 bg-white p-3 text-left transition-colors hover:border-ember-200 hover:bg-ember-50/40"
                >
                  <span className="mt-0.5 flex h-8 w-8 flex-none items-center justify-center rounded-full bg-ink-100 text-ink-700">
                    {address.label === 'home' ? <Home className="h-4 w-4" /> : address.label === 'work' ? <Building2 className="h-4 w-4" /> : <Clock3 className="h-4 w-4" />}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-xs font-bold text-ink-900">{address.custom_name || t(`profile.addresses.${address.label}`)}</span>
                    <span className="mt-0.5 block line-clamp-2 text-[11px] leading-4 text-ink-500">{address.address}</span>
                  </span>
                </button>
              ))}
              {!savedLoading && saved.length === 0 && (
                <div className="rounded-lg border border-dashed border-ink-200 bg-white px-3 py-4 text-center text-xs leading-5 text-ink-500">
                  {t('location.noSaved')}
                </div>
              )}
            </div>
            <div className="mt-4 flex items-start gap-2 rounded-lg bg-sage-50 px-3 py-3 text-[11px] leading-4 text-sage-800">
              <ShieldCheck className="mt-0.5 h-4 w-4 flex-none" />
              <span>{t('location.privacyShort')}</span>
            </div>
          </aside>

          <main className="min-w-0 p-3 sm:overflow-y-auto sm:p-5">
            <Suspense fallback={<div className="h-[440px] animate-pulse rounded-xl bg-ink-100" aria-label={t('map.loading')} />}>
              <DeliveryMap
                key={mapRevision}
                purpose="customer"
                initialLocation={draft}
                onLocationChange={(location) => setDraft({ ...location, details })}
              />
            </Suspense>

            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <DetailField label={t('location.building')} value={details.building} onChange={(building) => setDetails((current) => ({ ...current, building }))} />
              <DetailField label={t('location.entrance')} value={details.entrance} onChange={(entrance) => setDetails((current) => ({ ...current, entrance }))} />
              <DetailField label={t('location.floor')} value={details.floor} onChange={(floor) => setDetails((current) => ({ ...current, floor }))} />
              <DetailField label={t('location.apartment')} value={details.apartment} onChange={(apartment) => setDetails((current) => ({ ...current, apartment }))} />
              <DetailField label={t('location.landmark')} value={details.landmark} onChange={(landmark) => setDetails((current) => ({ ...current, landmark }))} className="sm:col-span-2" />
              <DetailField label={t('location.instructions')} value={details.instructions} onChange={(instructions) => setDetails((current) => ({ ...current, instructions }))} className="sm:col-span-2 lg:col-span-3" />
            </div>
          </main>
        </div>

        <footer className="border-t border-ink-100 bg-white px-4 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-3 sm:flex sm:items-center sm:gap-4 sm:px-5 sm:pb-4">
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-bold text-ink-900">{selectedSummary || t('location.notConfirmed')}</p>
            <p className="mt-0.5 text-[11px] text-ink-500">{draft?.confirmed ? t('location.ready') : t('location.confirmOnMap')}</p>
          </div>
          <button type="button" onClick={confirm} disabled={!draft?.confirmed} className="kiyo-btn-primary mt-3 h-12 w-full px-5 sm:mt-0 sm:w-auto" data-testid="confirm-delivery-location">
            <Check className="h-4 w-4" />
            {t('location.confirmDelivery')}
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

function LocationSkeleton() {
  return (
    <div className="space-y-2" aria-hidden="true">
      {[0, 1].map((item) => <div key={item} className="h-16 animate-pulse rounded-lg bg-ink-100" />)}
    </div>
  );
}
