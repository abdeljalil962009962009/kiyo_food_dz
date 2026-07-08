import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ChevronLeft, Check, ShieldCheck, AlertCircle, ShoppingCart, Truck } from 'lucide-react';
import { useT } from '../lib/i18n-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { AppShell } from '../components/AppShell';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { Spinner, ErrorState } from '../components/feedback';
import { PriceTag } from '../components/ui';
import DeliveryMap from '../components/DeliveryMap';

type Step = 'details' | 'review' | 'success';
type Finance = {
  items: { name: string; quantity: number; unit_price: string }[];
  subtotal: number;
  delivery_fee: number;
  service_fee: number;
  total: number;
};

const SUBMIT_TIMEOUT_MS = 12000;

export default function CheckoutPage() {
  const { t } = useT();
  const { profile } = useAuth();
  const [search] = useSearchParams();
  const navigate = useNavigate();
  const { state: cart, clear } = useCart();

  const restaurantId = search.get('id') ?? cart.restaurantId;
  void restaurantId; // RLS will infer from menu_items rows themselves

  const [step, setStep] = useState<Step>('details');
  const [name, setName] = useState(profile?.full_name ?? '');
  const [phone, setPhone] = useState(profile?.phone ?? '');
  const [address, setAddress] = useState('');
  const [notes, setNotes] = useState('');

  const [finance, setFinance] = useState<Finance | null>(null);
  const [calcLoading, setCalcLoading] = useState(false);
  const [calcError, setCalcError] = useState<string | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [placedOrderId, setPlacedOrderId] = useState<string | null>(null);

  // Restaurant coords for delivery zone + map
  type RestaurantGeo = { lat: number; lng: number; max_km: number };
  const [restaurantGeo, setRestaurantGeo] = useState<RestaurantGeo | null>(null);
  // Customer-chosen delivery location from the map
  const [mapLocation, setMapLocation] = useState<{ lat: number; lng: number; address: string } | null>(null);

  // Load restaurant coordinates + delivery zone (for the map + distance check).
  useEffect(() => {
    if (!cart.restaurantId) return;
    void (async () => {
      try {
        const { data, error } = await supabase
          .from('restaurants')
          .select('latitude, longitude, max_delivery_km')
          .eq('id', cart.restaurantId)
          .maybeSingle();
        if (error) throw error;
        if (data && data.latitude != null && data.longitude != null) {
          setRestaurantGeo({ lat: data.latitude, lng: data.longitude, max_km: data.max_delivery_km ?? 10 });
        }
      } catch (err) {
        console.error('Failed to load restaurant delivery geography', err);
        setCalcError(formatWorkflowError(err, t('checkout.errorCalc')));
      }
    })();
  }, [cart.restaurantId, t]);

  // Sync profile into form once on mount.
  useEffect(() => {
    if (profile && !name) setName(profile.full_name ?? '');
    if (profile && !phone) setPhone(profile.phone ?? '');
  }, [profile]); // eslint-disable-line react-hooks/exhaustive-deps

  // Calculate financials server-side whenever we enter the review step.
  // Distance is unknown without Google Maps (Phase 3); fall back to 0km so the
  // min delivery fee (100 DZD) applies. Server still enforces the rate.
  const recalcFinancials = useCallback(async () => {
    if (cart.lines.length === 0) return;
    setCalcLoading(true);
    setCalcError(null);
    setFinance(null);
    try {
      const itemsPayload = cart.lines.map((l) => ({
        menu_item_id: l.item.id,
        quantity: l.quantity,
      }));
      // Use the real delivery distance if we have map + restaurant coordinates,
      // so the review-step price matches what the user will actually be charged.
      const deliveryKm = mapLocation && restaurantGeo
        ? haversineKm([mapLocation.lat, mapLocation.lng], [restaurantGeo.lat, restaurantGeo.lng])
        : 0;
      const { data, error: e } = await supabase.rpc('calculate_order_financials', {
        p_items: itemsPayload,
        p_delivery_km: deliveryKm,
      });
      if (e) throw e;
      setFinance(data as Finance);
    } catch (err) {
      console.error('Failed to calculate checkout financials', err);
      setCalcError(formatWorkflowError(err, t('checkout.errorCalc')));
    } finally {
      setCalcLoading(false);
    }
  }, [cart.lines, t, mapLocation, restaurantGeo]);

  useEffect(() => {
    if (step === 'review' && !calcLoading) {
      void recalcFinancials();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, mapLocation, restaurantGeo]);

  // ----- Validation -----
  const detailsValid = useMemo(() => {
    const phoneOk = /^[+\d][\d\s-]{6,}$/.test(phone.trim());
    return name.trim().length >= 2 && phoneOk && address.trim().length >= 5;
  }, [name, phone, address]);

  // ----- Submit (single-statement transactional RPC) -----
  // Calls create_order_with_items() which inserts order + items in one
  // server-side transaction with the same idempotency guard, so there is no
  // orphan-order bug. Server refuses non-published restaurants and
  // re-validates prices before insert.
  const submitOrder = useCallback(async () => {
    if (submitting) return; // double-click guard (defense-in-depth)
    if (!profile || !cart.restaurantId || cart.lines.length === 0) return;
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
        delivery_phone: phone.trim(),
        notes: notes.trim() || null,
        delivery_km: mapLocation && restaurantGeo
          ? haversineKm(
              [mapLocation.lat, mapLocation.lng],
              [restaurantGeo.lat, restaurantGeo.lng],
            )
          : 0,
        idempotency_key: idempotencyKey,
      };

      const { data, error: e } = await supabase.rpc('create_order_with_items', {
        p_payload: payload,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any, { signal: controller.signal } as any);

      if (e) {
        // ERRCODE P0001 is our own 'duplicate_order' signal.
        if ((e as { code?: string; message?: string }).message?.includes('duplicate_order')) {
          setPlacedOrderId((data as { order_id?: string } | null)?.order_id ?? null);
          setStep('success');
          clear();
          return;
        }
        throw e;
      }

      const orderId = (data as { order_id?: string })?.order_id ?? null;
      setPlacedOrderId(orderId);
      if (orderId && mapLocation) {
        const { error: locationError } = await supabase
          .from('orders')
          .update({
            delivery_latitude: mapLocation.lat,
            delivery_longitude: mapLocation.lng,
          })
          .eq('id', orderId);
        if (locationError) throw locationError;
      }
      setStep('success');
      clear();
    } catch (err) {
      console.error('Failed to place checkout order', err);
      if (err instanceof DOMException && err.name === 'AbortError') {
        setSubmitError(t('checkout.error'));
      } else {
        setSubmitError(formatWorkflowError(err, t('checkout.error')));
      }
    } finally {
      clearTimeout(t0);
      setSubmitting(false);
    }
  }, [submitting, profile, cart, address, phone, notes, t, clear, mapLocation, restaurantGeo]);

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
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-sage-100">
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
              <div>
                <label className="kiyo-label" htmlFor="c-phone">{t('checkout.phone')}</label>
                <input
                  id="c-phone" className="kiyo-input" value={phone}
                  onChange={(e) => setPhone(e.target.value)} inputMode="tel"
                  autoComplete="tel" placeholder="06xx xxx xxx"
                />
                {!detailsValid && phone && !/^[+\d][\d\s-]{6,}$/.test(phone.trim()) && (
                  <p className="mt-1 text-xs text-error-600">{t('checkout.invalidPhone')}</p>
                )}
              </div>
              <div>
                <label className="kiyo-label">{t('checkout.address')}</label>
                <DeliveryMap
                  restaurantLat={restaurantGeo?.lat}
                  restaurantLng={restaurantGeo?.lng}
                  maxDeliveryKm={restaurantGeo?.max_km}
                  initialAddress={address}
                  onLocationChange={(loc) => {
                    setMapLocation(loc);
                    setAddress(loc.address);
                  }}
                />
                <input type="hidden" value={address} onChange={() => {}} />
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
                disabled={!detailsValid}
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

// Haversine distance in km — used to convert the customer's pin location to
// an actual delivery distance for the financial calculation.
function haversineKm(a: [number, number], b: [number, number]): number {
  const R = 6371;
  const dLat = ((b[0] - a[0]) * Math.PI) / 180;
  const dLng = ((b[1] - a[1]) * Math.PI) / 180;
  const s0 =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a[0] * Math.PI) / 180) *
      Math.cos((b[0] * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(s0), Math.sqrt(1 - s0));
}

function formatWorkflowError(err: unknown, fallback: string): string {
  if (err instanceof Error && err.message) return err.message;
  if (typeof err === 'object' && err && 'message' in err) {
    const message = (err as { message?: unknown }).message;
    if (typeof message === 'string' && message.trim()) return message;
  }
  return fallback;
}
