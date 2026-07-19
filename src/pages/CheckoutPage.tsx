import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ChevronLeft, Check, ShieldCheck, AlertCircle, ShoppingCart, Truck, Home, Building2, Phone } from 'lucide-react';
import { useT } from '../lib/i18n-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { useWilaya } from '../context/WilayaContext';
import { AppShell } from '../components/AppShell';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { Spinner, ErrorState } from '../components/feedback';
import { PriceTag } from '../components/ui';
import DeliveryMap, { type DeliveryMapLocation } from '../components/DeliveryMap';
import { withExponentialBackoff } from '../lib/locationNetwork';
import { isValidAlgerianPhone, normalizeAlgerianPhone } from '../lib/phone';
import { callUserAction, fetchLocationInsights } from '../lib/userApi';
import { clearCachedDeliveryQuotes, getAuthoritativeDeliveryQuote, type AuthoritativeDeliveryQuote } from '../lib/deliveryQuote';
import { useRealtime } from '../lib/useRealtime';
import { checkoutEtaWindow } from '../lib/deliveryEta';
import { userFacingError } from '../lib/userFacingError';

type Step = 'details' | 'review' | 'success';
type ContactPhoneMode = 'account' | 'alternate';
type Finance = AuthoritativeDeliveryQuote;

type LocationInsights = {
  serviceable_restaurant_count: number;
  repeat_order_count: number;
  has_saved_address: boolean;
  prompt_responded: boolean;
  location_key: string;
};

const SUBMIT_TIMEOUT_MS = 20000;

const availabilityCopy = {
  en: { closed: 'This restaurant is currently closed or paused. Choose another restaurant or try again later.', changed: 'This restaurant just paused orders. Your cart is safe, but checkout is unavailable until it reopens.' },
  fr: { closed: 'Ce restaurant est actuellement ferm\u00e9 ou en pause. Choisissez un autre restaurant ou r\u00e9essayez plus tard.', changed: 'Ce restaurant vient de suspendre les commandes. Votre panier est conserv\u00e9, mais la validation est indisponible jusqu\u2019\u00e0 sa r\u00e9ouverture.' },
  ar: { closed: '\u0627\u0644\u0645\u0637\u0639\u0645 \u0645\u063a\u0644\u0642 \u0623\u0648 \u0645\u062a\u0648\u0642\u0641 \u0645\u0624\u0642\u062a\u0627. \u0627\u062e\u062a\u0631 \u0645\u0637\u0639\u0645\u0627 \u0622\u062e\u0631 \u0623\u0648 \u062d\u0627\u0648\u0644 \u0644\u0627\u062d\u0642\u0627.', changed: '\u0623\u0648\u0642\u0641 \u0627\u0644\u0645\u0637\u0639\u0645 \u0627\u0644\u0637\u0644\u0628\u0627\u062a \u0627\u0644\u0622\u0646. \u0633\u0644\u062a\u0643 \u0645\u062d\u0641\u0648\u0638\u0629\u060c \u0644\u0643\u0646 \u0644\u0627 \u064a\u0645\u0643\u0646 \u0625\u062a\u0645\u0627\u0645 \u0627\u0644\u0637\u0644\u0628 \u062d\u062a\u0649 \u064a\u0639\u0648\u062f \u0644\u0644\u0639\u0645\u0644.' },
} as const;

export default function CheckoutPage() {
  const { t, locale } = useT();
  const availability = availabilityCopy[locale];
  const { profile } = useAuth();
  const [search] = useSearchParams();
  const navigate = useNavigate();
  const { state: cart, clear } = useCart();
  const { deliveryLocation, setDeliveryLocation } = useWilaya();

  const restaurantId = search.get('id') ?? cart.restaurantId;
  void restaurantId; // RLS will infer from menu_items rows themselves

  const [step, setStep] = useState<Step>('details');
  const [name, setName] = useState(profile?.full_name ?? '');
  const [contactPhoneMode, setContactPhoneMode] = useState<ContactPhoneMode>(isValidAlgerianPhone(profile?.phone ?? '') ? 'account' : 'alternate');
  const [alternatePhone, setAlternatePhone] = useState('');
  const [address, setAddress] = useState(deliveryLocation?.address ?? '');
  const [notes, setNotes] = useState('');

  const [finance, setFinance] = useState<Finance | null>(null);
  const [calcLoading, setCalcLoading] = useState(false);
  const [calcError, setCalcError] = useState<string | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [placedOrderId, setPlacedOrderId] = useState<string | null>(null);
  const [saveAddressPrompt, setSaveAddressPrompt] = useState<LocationInsights | null>(null);
  const [savingRepeatedAddress, setSavingRepeatedAddress] = useState(false);

  // Restaurant coords for delivery zone + map
  type RestaurantGeo = { lat: number; lng: number; max_km: number; operationalStatus: 'open' | 'busy' | 'closed'; preparationMinutes: number };
  const [restaurantGeo, setRestaurantGeo] = useState<RestaurantGeo | null>(null);
  // Customer-chosen delivery location from the map
  const [mapLocation, setMapLocation] = useState<DeliveryMapLocation | null>(deliveryLocation);
  const accountPhone = profile?.phone ?? '';
  const accountPhoneAvailable = isValidAlgerianPhone(accountPhone);
  const selectedPhone = contactPhoneMode === 'account' ? accountPhone : alternatePhone;

  // Load restaurant coordinates + delivery zone (for the map + distance check).
  useEffect(() => {
    if (!cart.restaurantId) return;
    void (async () => {
      try {
        const { data, error } = await supabase
          .from('restaurants')
          .select('latitude, longitude, max_delivery_km, operational_status, estimated_delivery_min')
          .eq('id', cart.restaurantId)
          .maybeSingle();
        if (error) throw error;
        if (data && data.latitude != null && data.longitude != null) {
          setRestaurantGeo({
            lat: data.latitude,
            lng: data.longitude,
            max_km: data.max_delivery_km ?? 10,
            operationalStatus: data.operational_status,
            preparationMinutes: data.estimated_delivery_min ?? 20,
          });
          if (data.operational_status === 'closed') {
            setCalcError(availability.closed);
          }
        }
      } catch (err) {
        console.error('Failed to load restaurant delivery geography', err);
        setCalcError(userFacingError(err, locale, t('checkout.errorCalc')));
      }
    })();
  }, [availability.closed, cart.restaurantId, locale, t]);

  useRealtime('restaurants', (payload) => {
    if (!payload.new?.id || payload.new.id !== cart.restaurantId) return;
    const operationalStatus = payload.new.operational_status as RestaurantGeo['operationalStatus'];
    setRestaurantGeo((current) => current ? { ...current, operationalStatus } : current);
    if (operationalStatus === 'closed') {
      setFinance(null);
      setCalcError(availability.changed);
    } else {
      setCalcError(null);
    }
  }, {
    enabled: Boolean(cart.restaurantId),
    filter: cart.restaurantId ? { id: `eq.${cart.restaurantId}` } : undefined,
  });

  // Sync profile into form once on mount.
  useEffect(() => {
    if (profile && !name) setName(profile.full_name ?? '');
  }, [profile]); // eslint-disable-line react-hooks/exhaustive-deps

  // A private server route obtains Google road distance, records a short-lived
  // trusted quote, then Supabase applies the authoritative commercial rules.
  const recalcFinancials = useCallback(async () => {
    if (cart.lines.length === 0 || !cart.restaurantId || !mapLocation?.confirmed || restaurantGeo?.operationalStatus === 'closed') return;
    setCalcLoading(true);
    setCalcError(null);
    setFinance(null);
    try {
      const data = await getAuthoritativeDeliveryQuote(
        cart.restaurantId,
        { lat: mapLocation.lat, lng: mapLocation.lng },
        cart.lines,
      );
      setFinance(data);
    } catch (err) {
      console.error('Failed to calculate checkout financials', err);
      setCalcError(userFacingError(err, locale, t('checkout.errorCalc')));
    } finally {
      setCalcLoading(false);
    }
  }, [cart.lines, cart.restaurantId, locale, t, mapLocation, restaurantGeo?.operationalStatus]);

  useEffect(() => {
    if (!mapLocation?.confirmed || !restaurantGeo) {
      setFinance(null);
      return;
    }
    const timer = window.setTimeout(() => void recalcFinancials(), 350);
    return () => window.clearTimeout(timer);
  }, [mapLocation?.confirmed, mapLocation?.lat, mapLocation?.lng, recalcFinancials, restaurantGeo]);

  useEffect(() => {
    if (step !== 'success' || !profile || !mapLocation?.confirmed) return;
    let active = true;
    void withExponentialBackoff(async () => {
      const { data, error } = await fetchLocationInsights<LocationInsights>(mapLocation.lat, mapLocation.lng);
      if (error) throw error;
      return data as LocationInsights;
    }, { attempts: 2, timeoutMs: 12000 }).then((insights) => {
      if (
        active
        && insights.repeat_order_count >= 2
        && !insights.has_saved_address
        && !insights.prompt_responded
      ) {
        setSaveAddressPrompt(insights);
      }
    }, () => undefined);
    return () => { active = false; };
  }, [mapLocation, profile, step]);

  const respondToAddressPrompt = useCallback(async (label: 'home' | 'work' | 'dismissed') => {
    if (!profile || !mapLocation?.confirmed || !saveAddressPrompt || savingRepeatedAddress) return;
    setSavingRepeatedAddress(true);
    try {
      if (label !== 'dismissed') {
        const parts = mapLocation.addressParts;
        const details = mapLocation.details;
        const { error: addressError } = await supabase.from('saved_addresses').insert({
          customer_id: profile.id,
          label,
          address: mapLocation.address,
          latitude: mapLocation.lat,
          longitude: mapLocation.lng,
          accuracy_m: mapLocation.accuracy,
          place_id: mapLocation.placeId,
          street: parts?.street ?? null,
          neighborhood: parts?.neighborhood ?? null,
          commune: parts?.commune ?? null,
          city: parts?.city ?? null,
          province: parts?.province ?? null,
          postal_code: parts?.postalCode ?? null,
          country: parts?.country ?? 'Algeria',
          location_source: mapLocation.source,
          landmark: details?.landmark || null,
          driver_instructions: details?.instructions || null,
        });
        if (addressError) throw addressError;
      }

      const response = label === 'dismissed' ? 'dismissed' : `saved_${label}`;
      const { error: responseError } = await supabase.from('location_save_prompt_responses').upsert({
        customer_id: profile.id,
        location_key: saveAddressPrompt.location_key,
        response,
        responded_at: new Date().toISOString(),
      });
      if (responseError) throw responseError;
      setSaveAddressPrompt(null);
    } catch (error) {
      console.error('Failed to save repeated delivery address', error);
    } finally {
      setSavingRepeatedAddress(false);
    }
  }, [mapLocation, profile, saveAddressPrompt, savingRepeatedAddress]);

  // ----- Validation -----
  const detailsValid = useMemo(() => {
    const phoneOk = isValidAlgerianPhone(selectedPhone);
    return name.trim().length >= 2 && phoneOk && address.trim().length >= 5 && mapLocation?.confirmed === true;
  }, [name, selectedPhone, address, mapLocation?.confirmed]);

  // ----- Submit (single-statement transactional RPC) -----
  // Calls create_order_with_items() which inserts order + items in one
  // server-side transaction with the same idempotency guard, so there is no
  // orphan-order bug. Server refuses non-published restaurants and
  // re-validates prices before insert.
  const submitOrder = useCallback(async () => {
    if (submitting) return; // double-click guard (defense-in-depth)
    if (!profile || !cart.restaurantId || cart.lines.length === 0) return;
    if (!mapLocation?.confirmed) {
      setSubmitError(t('map.confirmRequired'));
      return;
    }
    if (!finance?.route_quote_id) {
      setSubmitError(t('checkout.errorCalc'));
      return;
    }
    const contactPhone = normalizeAlgerianPhone(selectedPhone);
    if (!contactPhone) {
      setSubmitError(t('checkout.invalidPhone'));
      return;
    }
    setSubmitting(true);
    setSubmitError(null);

    const controller = new AbortController();
    const t0 = setTimeout(() => controller.abort(), SUBMIT_TIMEOUT_MS);

    try {
      const idempotencyKey = await makeIdempotencyKey([
        profile.id,
        cart.restaurantId,
        cart.lines.map((l) => `${l.item.id}:${l.quantity}`).join(','),
        Math.floor(Date.now() / (5 * 60 * 1000)).toString(),
      ]);

      const payload = {
        restaurant_id: cart.restaurantId,
        items: cart.lines.map((l) => ({
          menu_item_id: l.item.id,
          quantity: l.quantity,
          notes: l.notes ?? null,
        })),
        delivery_address: address.trim(),
        delivery_phone: contactPhone,
        delivery_latitude: mapLocation.lat,
        delivery_longitude: mapLocation.lng,
        delivery_accuracy_m: mapLocation.accuracy,
        delivery_confirmed: true,
        delivery_location_source: mapLocation.source,
        delivery_place_id: mapLocation.placeId,
        delivery_commune: mapLocation.addressParts?.commune ?? mapLocation.addressParts?.city ?? null,
        delivery_wilaya: mapLocation.addressParts?.province ?? null,
        delivery_postal_code: mapLocation.addressParts?.postalCode ?? null,
        delivery_landmark: mapLocation.details?.landmark || null,
        delivery_instructions: mapLocation.details?.instructions || null,
        route_quote_id: finance?.route_quote_id,
        notes: notes.trim() || null,
        idempotency_key: idempotencyKey,
      };

      const { data, error: e } = await callUserAction<{ order_id?: string }>('create_order_with_items', {
        p_payload: payload,
      }, { signal: controller.signal });

      if (e) {
        // ERRCODE P0001 is our own 'duplicate_order' signal.
        if ((e as { code?: string; message?: string }).message?.includes('duplicate_order')) {
          setPlacedOrderId(data?.order_id ?? null);
          setStep('success');
          clearCachedDeliveryQuotes();
          clear();
          return;
        }
        throw e;
      }

      const orderId = data?.order_id ?? null;
      setPlacedOrderId(orderId);
      setStep('success');
      clearCachedDeliveryQuotes();
      clear();
    } catch (err) {
      console.error('Failed to place checkout order', err);
      if (err instanceof DOMException && err.name === 'AbortError') {
        setSubmitError(t('checkout.error'));
      } else {
        setSubmitError(userFacingError(err, locale, t('checkout.error')));
      }
    } finally {
      clearTimeout(t0);
      setSubmitting(false);
    }
  }, [submitting, profile, cart, address, selectedPhone, notes, t, clear, locale, mapLocation, finance?.route_quote_id]);

  // Cart empty states for /checkout accessed without items.
  if (cart.lines.length === 0 && step !== 'success') {
    return (
      <AppShell>
        <div className="kiyo-card flex flex-col items-center gap-3 px-6 py-16 text-center">
          <ShoppingCart className="h-8 w-8 text-ink-300" />
          <p className="text-sm text-ink-500">{t('checkout.empty')}</p>
          <Link to="/restaurants" className="kiyo-btn-primary">{t('market.browse')}</Link>
        </div>
      </AppShell>
    );
  }

  if (step === 'success') {
    return (
      <AppShell>
        <div className="kiyo-card mx-auto max-w-md p-8 text-center">
          <div className="animate-success-pop mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-sage-100">
            <Check className="h-7 w-7 text-sage-500" />
          </div>
          <h2 className="mt-4 font-display text-2xl font-extrabold tracking-tight text-ink-900">
            {t('checkout.success')}
          </h2>
          <p className="mt-2 text-sm text-ink-500">{t('checkout.successBody')}</p>
          <div className="mt-3 flex items-center justify-center gap-1.5 rounded-lg bg-ember-500/5 px-3 py-2 text-xs text-ember-700">
            <Truck className="h-3.5 w-3.5" />
            {t('checkout.deliveryByRestaurant')}
          </div>
          {saveAddressPrompt && (
            <div className="mt-4 rounded-xl border border-ink-100 bg-ink-50 p-4 text-left">
              <p className="text-sm font-bold text-ink-900">{t('location.savePrompt')}</p>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <button type="button" disabled={savingRepeatedAddress} onClick={() => void respondToAddressPrompt('home')} className="kiyo-btn-secondary min-h-11 px-3 text-xs">
                  <Home className="h-4 w-4" />
                  {t('location.saveAsHome')}
                </button>
                <button type="button" disabled={savingRepeatedAddress} onClick={() => void respondToAddressPrompt('work')} className="kiyo-btn-secondary min-h-11 px-3 text-xs">
                  <Building2 className="h-4 w-4" />
                  {t('location.saveAsWork')}
                </button>
              </div>
              <button type="button" disabled={savingRepeatedAddress} onClick={() => void respondToAddressPrompt('dismissed')} className="mt-2 min-h-11 w-full text-xs font-semibold text-ink-500 hover:text-ink-800">
                {t('location.notNow')}
              </button>
            </div>
          )}
          {placedOrderId && (
            <p className="mt-2 text-xs text-ink-400">
              {t('orders.id')} #{placedOrderId.slice(0, 8)}
            </p>
          )}
          <div className="mt-5 flex flex-col gap-2">
            <button
              onClick={() => navigate('/orders')}
              className="kiyo-btn-primary w-full"
            >
              {t('checkout.viewOrders')}
            </button>
            <Link to="/restaurants" className="kiyo-btn-secondary w-full">
              {t('market.browse')}
            </Link>
          </div>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <Stepper step={step} />

      {step === 'details' && (
        <div className="mx-auto max-w-md">
          <h1 className="mb-4 font-display text-xl font-extrabold tracking-tight text-ink-900">
            {t('checkout.step.details')}
          </h1>
          <ErrorBoundary variant="inline">
            <div className="space-y-4">
              <div>
                <label className="kiyo-label" htmlFor="c-name">{t('checkout.fullName')}</label>
                <input
                  id="c-name" className="kiyo-input" value={name}
                  onChange={(e) => setName(e.target.value)} autoComplete="name"
                />
              </div>
              <fieldset>
                <legend className="kiyo-label">{t('checkout.contactQuestion')}</legend>
                <div className="grid gap-2">
                  <label className={`flex min-h-14 cursor-pointer items-center gap-3 rounded-lg border px-3 py-2.5 transition-colors ${contactPhoneMode === 'account' ? 'border-ember-400 bg-ember-50' : 'border-ink-200 bg-white'} ${!accountPhoneAvailable ? 'cursor-not-allowed opacity-60' : ''}`}>
                    <input
                      type="radio"
                      name="contact-phone-mode"
                      value="account"
                      checked={contactPhoneMode === 'account'}
                      onChange={() => setContactPhoneMode('account')}
                      disabled={!accountPhoneAvailable}
                      className="h-4 w-4 border-ink-300 text-ember-600 focus:ring-ember-500"
                    />
                    <Phone className="h-4 w-4 flex-none text-ember-600" />
                    <span className="min-w-0 flex-1">
                      <span className="block text-xs font-bold text-ink-900">{t('checkout.useAccountPhone')}</span>
                      {accountPhoneAvailable ? (
                        <span className="mt-0.5 block text-xs text-ink-500" dir="ltr">{accountPhone}</span>
                      ) : (
                        <span className="mt-0.5 block text-xs text-ink-500">{t('checkout.accountPhoneMissing')}</span>
                      )}
                    </span>
                  </label>
                  <label className={`flex min-h-14 cursor-pointer items-center gap-3 rounded-lg border px-3 py-2.5 transition-colors ${contactPhoneMode === 'alternate' ? 'border-ember-400 bg-ember-50' : 'border-ink-200 bg-white'}`}>
                    <input
                      type="radio"
                      name="contact-phone-mode"
                      value="alternate"
                      checked={contactPhoneMode === 'alternate'}
                      onChange={() => setContactPhoneMode('alternate')}
                      className="h-4 w-4 border-ink-300 text-ember-600 focus:ring-ember-500"
                    />
                    <span className="text-xs font-bold text-ink-900">{t('checkout.useDifferentPhone')}</span>
                  </label>
                </div>
                {contactPhoneMode === 'alternate' && (
                  <div className="mt-2">
                    <label className="sr-only" htmlFor="c-phone">{t('checkout.alternatePhoneLabel')}</label>
                    <input
                      id="c-phone"
                      className="kiyo-input"
                      value={alternatePhone}
                      onChange={(e) => setAlternatePhone(e.target.value)}
                      inputMode="tel"
                      autoComplete="tel"
                      placeholder="06 61 23 45 67"
                    />
                  </div>
                )}
                {selectedPhone && !isValidAlgerianPhone(selectedPhone) && (
                  <p className="mt-1 text-xs text-error-600">{t('checkout.invalidPhone')}</p>
                )}
              </fieldset>
              <div>
                <label className="kiyo-label">{t('checkout.address')}</label>
                <DeliveryMap
                  purpose="customer"
                  restaurantLat={restaurantGeo?.lat}
                  restaurantLng={restaurantGeo?.lng}
                  maxDeliveryKm={restaurantGeo?.max_km}
                  initialAddress={address}
                  initialLocation={mapLocation}
                  onLocationChange={(loc) => {
                    setMapLocation(loc);
                    setAddress(loc.address);
                    if (loc.confirmed) setDeliveryLocation(loc);
                  }}
                />
                <input type="hidden" value={address} onChange={() => {}} />
                {mapLocation && !mapLocation.confirmed && (
                  <p className="mt-1 text-xs text-warning-700">{t('map.confirmRequired')}</p>
                )}
                {mapLocation?.confirmed && calcLoading && (
                  <div className="mt-2 flex min-h-11 items-center gap-2 rounded-lg bg-ink-50 px-3 text-xs text-ink-500" role="status">
                    <Spinner className="h-4 w-4 text-ember-600" />
                    {t('common.loading')}
                  </div>
                )}
                {mapLocation?.confirmed && !calcLoading && finance?.duration_minutes != null && (
                  <div className="mt-2 flex min-h-11 items-center justify-between rounded-lg bg-sage-50 px-3 text-xs text-sage-800">
                    <span>{t('location.etaRange')}</span>
                    <span className="font-bold" data-testid="delivery-eta-range">{formatEtaRange(finance.duration_minutes, restaurantGeo?.preparationMinutes, t('location.minutesShort'))}</span>
                  </div>
                )}
                {mapLocation?.confirmed && !calcLoading && calcError && (
                  <button type="button" onClick={() => void recalcFinancials()} className="mt-2 min-h-11 w-full rounded-lg bg-warning-50 px-3 text-xs font-bold text-warning-800">
                    {calcError} {t('error.retry')}
                  </button>
                )}
                {!detailsValid && address && address.trim().length < 5 && (
                  <p className="mt-1 text-xs text-error-600">{t('checkout.invalidAddress')}</p>
                )}
              </div>
              <div>
                <label className="kiyo-label" htmlFor="c-notes">{t('checkout.notes')}</label>
                <textarea
                  id="c-notes" className="kiyo-input min-h-16" value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder={t('checkout.notesPlaceholder')}
                  rows={2}
                />
              </div>

              <div className="rounded-xl bg-ink-50 p-3 text-xs text-ink-500">
                <Check className="mr-1 inline h-3.5 w-3.5 text-sage-500" />
                {t('checkout.placeOrderSummary')}
              </div>

              <button
                onClick={() => setStep('review')}
                disabled={!detailsValid || calcLoading || !finance?.route_quote_id}
                className="kiyo-btn-primary w-full"
              >
                {t('checkout.step.confirm')}
              </button>
              <button
                onClick={() => navigate('/cart')}
                className="kiyo-btn-ghost w-full"
              >
                <ChevronLeft className="h-4 w-4" />
                {t('checkout.backToCart')}
              </button>
            </div>
          </ErrorBoundary>
        </div>
      )}

      {step === 'review' && (
        <div className="mx-auto max-w-md">
          <h1 className="mb-4 font-display text-xl font-extrabold tracking-tight text-ink-900">
            {t('checkout.step.confirm')}
          </h1>
          <ErrorBoundary variant="inline">
            {calcLoading ? (
              <div className="kiyo-card p-5">
                <div className="flex items-center gap-2 text-sm text-ink-500">
                  <Spinner className="h-4 w-4 text-ember-600" />
                  {t('common.loading')}
                </div>
              </div>
            ) : calcError ? (
              <ErrorState
                title={t('error.genericTitle')} message={calcError}
                onRetry={recalcFinancials} retryLabel={t('error.retry')}
              />
            ) : finance ? (
              <>
                <div className="kiyo-card mb-3 divide-y divide-ink-100">
                  {finance.items.map((it, i) => (
                    <div key={i} className="flex items-center justify-between px-4 py-3 text-sm">
                      <span className="text-ink-700">
                        <span className="font-semibold">{it.quantity}×</span> {it.name}
                      </span>
                      <PriceTag value={Number(it.unit_price) * it.quantity} />
                    </div>
                  ))}
                </div>
                <div className="kiyo-card mb-3 space-y-2 p-4 text-sm">
                  <div className="mb-3 flex items-center justify-between rounded-lg bg-ink-50 px-3 py-2 text-xs">
                    <span className="text-ink-500">{t('checkout.phone')}</span>
                    <span className="font-bold text-ink-900" dir="ltr">{normalizeAlgerianPhone(selectedPhone)}</span>
                  </div>
                  {finance.distance_km != null && (
                    <div className="mb-3 grid grid-cols-2 gap-2 rounded-lg bg-sage-50 p-3 text-xs">
                      <div>
                        <span className="block text-sage-700">{t('location.quoteSummary')}</span>
                        <span className="mt-1 block font-bold text-sage-900">{Number(finance.distance_km).toFixed(1)} km</span>
                      </div>
                      <div>
                        <span className="block text-sage-700">{t('location.etaMinutes')}</span>
                        <span className="mt-1 block font-bold text-sage-900">{finance.duration_minutes != null ? formatEtaRange(finance.duration_minutes, restaurantGeo?.preparationMinutes, t('location.minutesShort')) : '—'}</span>
                      </div>
                    </div>
                  )}
                  <Row label={t('cart.subtotal')} value={finance.subtotal} />
                  <Row label={t('cart.deliveryFee')} value={finance.delivery_fee} />
                  <Row label={t('cart.serviceFee')} value={finance.service_fee} muted />
                  <div className="h-px bg-ink-100" />
                  <div className="flex items-center justify-between pt-1">
                    <span className="font-display text-base font-bold text-ink-900">
                      {t('cart.total')}
                    </span>
                    <PriceTag value={finance.total} />
                  </div>
                </div>

                {submitError && (
                  <div className="mb-3 flex items-start gap-2 rounded-lg bg-error-500/10 px-3 py-2.5 text-xs text-error-600">
                    <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
                    <span className="font-medium">{submitError}</span>
                  </div>
                )}

                <button
                  onClick={submitOrder}
                  disabled={submitting}
                  className="kiyo-btn-primary w-full"
                >
                  {submitting ? (
                    <>
                      <Spinner className="h-4 w-4" />
                      {t('checkout.placing')}
                    </>
                  ) : (
                    <>
                      <ShieldCheck className="h-4 w-4" />
                      {t('checkout.placeOrder')}
                    </>
                  )}
                </button>
                <button
                  onClick={() => setStep('details')}
                  className="kiyo-btn-ghost mt-2 w-full"
                  disabled={submitting}
                >
                  <ChevronLeft className="h-4 w-4" />
                  {t('checkout.backToDetails')}
                </button>
              </>
            ) : null}
          </ErrorBoundary>
        </div>
      )}
    </AppShell>
  );
}

function Stepper({ step }: { step: Step }) {
  const { t } = useT();
  const steps: { id: Step; label: string }[] = [
    { id: 'details', label: t('checkout.step.details') },
    { id: 'review', label: t('checkout.step.confirm') },
  ];
  const activeIdx = steps.findIndex((s) => s.id === step);
  return (
    <div className="mx-auto mb-6 flex max-w-md items-center">
      {steps.map((s, i) => (
        <div key={s.id} className="flex flex-1 items-center">
          <div className="flex items-center gap-2">
            <span
              className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${
                i <= activeIdx ? 'bg-ink-900 text-white' : 'bg-ink-100 text-ink-400'
              }`}
            >
              {i + 1}
            </span>
            <span className={`text-xs font-medium ${i <= activeIdx ? 'text-ink-900' : 'text-ink-400'}`}>
              {s.label}
            </span>
          </div>
          {i < steps.length - 1 && (
            <div className={`mx-2 h-px flex-1 ${i < activeIdx ? 'bg-ink-900' : 'bg-ink-100'}`} />
          )}
        </div>
      ))}
    </div>
  );
}

function Row({ label, value, muted }: { label: string; value: number; muted?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className={muted ? 'text-ink-400' : 'text-ink-600'}>{label}</span>
      <PriceTag value={value} />
    </div>
  );
}

// Idempotency key: hash of (user, restaurant, items, 5-min bucket).
// Same key returned within the same 5 minutes for identical cart contents →
// the unique index on (restaurant_id, idempotency_key) makes retries idempotent.
async function makeIdempotencyKey(parts: string[]): Promise<string> {
  const joined = parts.join('|');
  if (globalThis.crypto?.subtle) {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(joined));
    return Array.from(new Uint8Array(buf))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')
      .slice(0, 32);
  }
  // Fallback (non-crypto) for environments without SubtleCrypto
  let h = 0;
  for (let i = 0; i < joined.length; i++) {
    h = (Math.imul(31, h) + joined.charCodeAt(i)) | 0;
  }
  const bucket = Math.floor(Date.now() / (5 * 60 * 1000));
  return `fallback-${h.toString(16)}-${bucket.toString(16)}`;
}

function formatEtaRange(durationMinutes: number, preparationMinutes: number | undefined, unit: string): string {
  const eta = checkoutEtaWindow(durationMinutes, preparationMinutes ?? 20);
  return `${eta.minimumMinutes}-${eta.maximumMinutes} ${unit}`;
}
