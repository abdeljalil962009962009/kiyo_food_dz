import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Trash2, ShoppingBag, ChevronLeft, AlertCircle, MapPin, RefreshCw, Minus, Plus, Banknote, Route, Clock3, ShieldCheck, X } from 'lucide-react';
import { useT } from '../lib/i18n-react';
import { useCart } from '../context/CartContext';
import { useWilaya } from '../context/WilayaContext';
import { AppShell } from '../components/AppShell';
import { PriceTag } from '../components/ui';
import { Spinner } from '../components/feedback';
import { getAuthoritativeDeliveryQuote, type AuthoritativeDeliveryQuote } from '../lib/deliveryQuote';

const copy = {
  en: {
    exact: 'Complete price for your selected address', choose: 'Choose a precise delivery location at checkout to calculate every fee.',
    calculating: 'Calculating road-route price...', retry: 'Retry price', unavailable: 'Exact pricing is temporarily unavailable. Your cart is safe.',
    selectedAddress: 'Delivery address', changeAddress: 'Change at checkout', roadDistance: 'Road distance', travelTime: 'Estimated road time',
    cashTitle: 'Pay the displayed total in cash', cashBody: 'No card charge. The server checks the restaurant, route, item prices, and total again before creating your order.',
    continueCheckout: 'Review delivery details', decrease: 'Decrease', increase: 'Increase',
    clearConfirm: 'Remove every item from this cart?', clearYes: 'Yes, clear cart', keepCart: 'Keep my cart',
  },
  fr: {
    exact: 'Prix complet pour votre adresse', choose: 'Choisissez une adresse pr\u00e9cise \u00e0 la prochaine \u00e9tape pour calculer tous les frais.',
    calculating: 'Calcul du prix selon le trajet routier...', retry: 'Recalculer', unavailable: 'Le calcul exact est temporairement indisponible. Votre panier est conserv\u00e9.',
    selectedAddress: 'Adresse de livraison', changeAddress: 'Modifier \u00e0 l\u2019\u00e9tape suivante', roadDistance: 'Distance routi\u00e8re', travelTime: 'Temps de trajet estim\u00e9',
    cashTitle: 'Payez le total affich\u00e9 en esp\u00e8ces', cashBody: 'Aucun d\u00e9bit de carte. Le serveur rev\u00e9rifie le restaurant, le trajet, les prix et le total avant de cr\u00e9er la commande.',
    continueCheckout: 'V\u00e9rifier les d\u00e9tails de livraison', decrease: 'Diminuer', increase: 'Augmenter',
    clearConfirm: 'Retirer tous les articles de ce panier ?', clearYes: 'Oui, vider le panier', keepCart: 'Garder mon panier',
  },
  ar: {
    exact: '\u0627\u0644\u0633\u0639\u0631 \u0627\u0644\u0643\u0627\u0645\u0644 \u0644\u0639\u0646\u0648\u0627\u0646\u0643 \u0627\u0644\u0645\u062d\u062f\u062f', choose: '\u062d\u062f\u062f \u0639\u0646\u0648\u0627\u0646 \u0627\u0644\u062a\u0648\u0635\u064a\u0644 \u0627\u0644\u062f\u0642\u064a\u0642 \u0641\u064a \u0627\u0644\u062e\u0637\u0648\u0629 \u0627\u0644\u062a\u0627\u0644\u064a\u0629 \u0644\u062d\u0633\u0627\u0628 \u062c\u0645\u064a\u0639 \u0627\u0644\u0631\u0633\u0648\u0645.',
    calculating: '\u062c\u0627\u0631\u064a \u062d\u0633\u0627\u0628 \u0627\u0644\u0633\u0639\u0631 \u062d\u0633\u0628 \u0627\u0644\u0637\u0631\u064a\u0642...', retry: '\u0625\u0639\u0627\u062f\u0629 \u0627\u0644\u062d\u0633\u0627\u0628', unavailable: '\u0627\u0644\u062d\u0633\u0627\u0628 \u0627\u0644\u062f\u0642\u064a\u0642 \u0645\u062a\u0639\u0630\u0631 \u0645\u0624\u0642\u062a\u0627. \u0633\u0644\u062a\u0643 \u0645\u062d\u0641\u0648\u0638\u0629.',
    selectedAddress: '\u0639\u0646\u0648\u0627\u0646 \u0627\u0644\u062a\u0648\u0635\u064a\u0644', changeAddress: '\u062a\u0639\u062f\u064a\u0644\u0647 \u0641\u064a \u0627\u0644\u062e\u0637\u0648\u0629 \u0627\u0644\u062a\u0627\u0644\u064a\u0629', roadDistance: '\u0627\u0644\u0645\u0633\u0627\u0641\u0629 \u0627\u0644\u0637\u0631\u0642\u064a\u0629', travelTime: '\u0632\u0645\u0646 \u0627\u0644\u0637\u0631\u064a\u0642 \u0627\u0644\u062a\u0642\u062f\u064a\u0631\u064a',
    cashTitle: '\u0627\u062f\u0641\u0639 \u0627\u0644\u0645\u0628\u0644\u063a \u0627\u0644\u0638\u0627\u0647\u0631 \u0646\u0642\u062f\u0627\u064b', cashBody: '\u0644\u0627 \u064a\u0648\u062c\u062f \u062e\u0635\u0645 \u0645\u0646 \u0627\u0644\u0628\u0637\u0627\u0642\u0629. \u064a\u0639\u064a\u062f \u0627\u0644\u062e\u0627\u062f\u0645 \u0627\u0644\u062a\u062d\u0642\u0642 \u0645\u0646 \u0627\u0644\u0645\u0637\u0639\u0645 \u0648\u0627\u0644\u0645\u0633\u0627\u0631 \u0648\u0627\u0644\u0623\u0633\u0639\u0627\u0631 \u0648\u0627\u0644\u0645\u062c\u0645\u0648\u0639 \u0642\u0628\u0644 \u0625\u0646\u0634\u0627\u0621 \u0637\u0644\u0628\u0643.',
    continueCheckout: '\u0645\u0631\u0627\u062c\u0639\u0629 \u062a\u0641\u0627\u0635\u064a\u0644 \u0627\u0644\u062a\u0648\u0635\u064a\u0644', decrease: '\u062a\u0642\u0644\u064a\u0644', increase: '\u0632\u064a\u0627\u062f\u0629',
    clearConfirm: '\u0647\u0644 \u062a\u0631\u064a\u062f \u0625\u0632\u0627\u0644\u0629 \u0643\u0644 \u0639\u0646\u0627\u0635\u0631 \u0627\u0644\u0633\u0644\u0629\u061f', clearYes: '\u0646\u0639\u0645\u060c \u062a\u0641\u0631\u064a\u063a \u0627\u0644\u0633\u0644\u0629', keepCart: '\u0627\u0644\u0627\u062d\u062a\u0641\u0627\u0638 \u0628\u0627\u0644\u0633\u0644\u0629',
  },
} as const;

export default function CartPage() {
  const { t, locale } = useT();
  const tx = copy[locale];
  const navigate = useNavigate();
  const { state, subtotal, setQuantity, removeItem, clear, totalItems } = useCart();
  const { deliveryLocation } = useWilaya();
  const [quote, setQuote] = useState<AuthoritativeDeliveryQuote | null>(null);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [confirmingClear, setConfirmingClear] = useState(false);
  const [cartNotice] = useState(() => {
    const value = sessionStorage.getItem('kiyo-cart-notice');
    if (value) sessionStorage.removeItem('kiyo-cart-notice');
    return value;
  });

  const calculate = useCallback(async () => {
    if (!state.restaurantId || !deliveryLocation?.confirmed || state.lines.length === 0) return;
    setQuoteLoading(true);
    setQuoteError(null);
    try {
      setQuote(await getAuthoritativeDeliveryQuote(state.restaurantId, deliveryLocation, state.lines));
    } catch {
      setQuote(null);
      setQuoteError(tx.unavailable);
    } finally {
      setQuoteLoading(false);
    }
  }, [deliveryLocation, state.lines, state.restaurantId, tx.unavailable]);

  useEffect(() => { void calculate(); }, [calculate]);

  if (state.lines.length === 0) {
    return (
      <AppShell>
        <div className="kiyo-card flex flex-col items-center gap-4 px-6 py-16 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-ink-100">
            <ShoppingBag className="h-6 w-6 text-ink-400" />
          </div>
          <div>
            <h2 className="font-display text-lg font-bold text-ink-900">{t('cart.empty')}</h2>
            <p className="mt-1 text-sm text-ink-500">{t('cart.emptyBody')}</p>
          </div>
          <Link to="/restaurants" className="kiyo-btn-primary">
            {t('market.browse')}
          </Link>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <Link
        to="/restaurants"
        className="mb-3 inline-flex items-center gap-1 text-xs font-semibold text-ink-500 hover:text-ink-900"
      >
        <ChevronLeft className="h-4 w-4" />
        {t('market.browse')}
      </Link>

      <h1 className="mb-4 font-display text-2xl font-extrabold tracking-tight text-ink-900">
        {t('cart.title')}
      </h1>
      {state.restaurantName && (
        <p className="mb-4 text-sm text-ink-500">{state.restaurantName}</p>
      )}

      {cartNotice && <div className="mb-4 rounded-lg border border-sage-200 bg-sage-50 px-4 py-3 text-sm text-sage-700">{cartNotice}</div>}
      <div className="grid gap-4 lg:grid-cols-[1fr,360px]">
        <div className="space-y-2">
          {state.lines.map((line) => (
            <div key={line.item.id} className="kiyo-card flex items-center gap-3 p-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-display text-sm font-bold text-ink-900">{line.item.name}</h3>
                  <button
                    onClick={() => removeItem(line.item.id)}
                    className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-lg text-ink-400 transition-colors hover:bg-error-50 hover:text-error-600"
                    aria-label={t('cart.removeItem')}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
                <PriceTag value={line.unitPriceSnapshot} />
                {line.notes && (
                  <p className="mt-1 text-xs italic text-ink-400">"{line.notes}"</p>
                )}
              </div>
              <div className="flex min-h-11 items-center gap-1 rounded-lg border border-ink-200 bg-white p-0.5">
                <button
                  onClick={() => setQuantity(line.item.id, line.quantity - 1)}
                  className="flex h-10 w-10 items-center justify-center rounded-md text-ink-700 hover:bg-ink-100"
                  aria-label={`${tx.decrease} ${line.item.name}`}
                ><Minus className="h-4 w-4" /></button>
                <span className="min-w-6 text-center text-sm font-semibold text-ink-900">
                  {line.quantity}
                </span>
                <button
                  onClick={() => setQuantity(line.item.id, line.quantity + 1)}
                  className="flex h-10 w-10 items-center justify-center rounded-md text-ink-700 hover:bg-ink-100"
                  aria-label={`${tx.increase} ${line.item.name}`}
                ><Plus className="h-4 w-4" /></button>
              </div>
              <div className="w-20 text-right">
                <PriceTag value={line.unitPriceSnapshot * line.quantity} />
              </div>
            </div>
          ))}
          {!confirmingClear ? (
            <button
              onClick={() => setConfirmingClear(true)}
              className="kiyo-btn-ghost min-h-11 text-error-600 hover:bg-error-500/10"
            >
              <Trash2 className="h-4 w-4" />
              {t('cart.clear')}
            </button>
          ) : (
            <div className="flex flex-col gap-3 rounded-lg border border-error-100 bg-error-50 p-3 sm:flex-row sm:items-center sm:justify-between" role="alert">
              <p className="text-sm font-semibold text-error-700">{tx.clearConfirm}</p>
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={() => setConfirmingClear(false)} className="kiyo-btn-secondary min-h-11 px-3 py-2">
                  <X className="h-4 w-4" /> {tx.keepCart}
                </button>
                <button type="button" onClick={() => { clear(); setConfirmingClear(false); }} className="kiyo-btn-primary min-h-11 bg-error-600 px-3 py-2 hover:bg-error-700">
                  <Trash2 className="h-4 w-4" /> {tx.clearYes}
                </button>
              </div>
            </div>
          )}
        </div>

        <aside className="kiyo-card h-fit p-5 lg:sticky lg:top-20">
          <h2 className="mb-3 font-display text-base font-bold text-ink-900">{t('cart.total')}</h2>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between text-ink-600">
              <span>{t('cart.subtotal')}</span>
              <PriceTag value={subtotal} />
            </div>
            <div className="flex justify-between text-ink-600">
              <span>{t('cart.deliveryFee')}</span>
              {quote ? <PriceTag value={quote.delivery_fee} /> : <span className="text-xs">--</span>}
            </div>
            <div className="flex justify-between text-ink-600">
              <span>{t('cart.serviceFee')}</span>
              {quote ? <PriceTag value={quote.service_fee} /> : <span className="text-xs">--</span>}
            </div>
          </div>
          <div className="my-3 h-px bg-ink-100" />
          <div className="mb-4 flex items-center justify-between">
            <span className="font-display font-bold text-ink-900">{t('cart.total')}</span>
            {quote ? <PriceTag value={quote.total} /> : <span className="text-xs text-ink-400">{totalItems} {t('orders.items')}</span>}
          </div>
          {deliveryLocation?.confirmed && (
            <div className="mb-3 border-y border-ink-100 py-3">
              <div className="flex items-start gap-2">
                <MapPin className="mt-0.5 h-4 w-4 flex-shrink-0 text-ember-600" />
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold text-ink-900">{tx.selectedAddress}</p>
                  <p className="mt-0.5 line-clamp-2 text-xs leading-5 text-ink-500">{deliveryLocation.address}</p>
                  <button type="button" onClick={() => navigate(`/checkout?id=${state.restaurantId}`)} className="mt-1 min-h-11 text-xs font-bold text-ember-700">
                    {tx.changeAddress}
                  </button>
                </div>
              </div>
            </div>
          )}
          {quoteLoading && (
            <div className="mb-3 flex min-h-11 items-center gap-2 rounded-lg bg-ink-50 px-3 py-2 text-xs text-ink-500" aria-live="polite">
              <Spinner className="h-4 w-4" /> {tx.calculating}
            </div>
          )}
          {!quoteLoading && quote && (
            <div className="mb-3 rounded-lg bg-sage-50 px-3 py-2 text-xs text-sage-700">
              <div className="flex items-start gap-2"><ShieldCheck className="mt-0.5 h-4 w-4 flex-shrink-0" /> {tx.exact}</div>
              {(quote.distance_km != null || quote.duration_minutes != null) && (
                <div className="mt-2 grid gap-1 border-t border-sage-100 pt-2 sm:grid-cols-2">
                  {quote.distance_km != null && <span className="flex items-center gap-1"><Route className="h-3.5 w-3.5" /> {tx.roadDistance}: {quote.distance_km.toFixed(1)} km</span>}
                  {quote.duration_minutes != null && <span className="flex items-center gap-1"><Clock3 className="h-3.5 w-3.5" /> {tx.travelTime}: {Math.ceil(quote.duration_minutes)} min</span>}
                </div>
              )}
            </div>
          )}
          {!quoteLoading && !quote && !quoteError && (
            <div className="mb-3 flex items-start gap-2 rounded-lg bg-ink-50 px-3 py-2 text-xs text-ink-500">
              <MapPin className="mt-0.5 h-4 w-4 flex-shrink-0" /> {tx.choose}
            </div>
          )}
          {quoteError && (
            <div className="mb-3 rounded-lg bg-error-50 px-3 py-2 text-xs text-error-700">
              <div className="flex items-start gap-2"><AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />{quoteError}</div>
              <button type="button" onClick={() => void calculate()} className="mt-2 inline-flex min-h-11 items-center gap-1 font-bold">
                <RefreshCw className="h-3.5 w-3.5" /> {tx.retry}
              </button>
            </div>
          )}
          <div className="mb-3 flex items-start gap-2 rounded-lg bg-ink-50 px-3 py-2.5 text-xs text-ink-600">
            <Banknote className="mt-0.5 h-4 w-4 flex-shrink-0 text-sage-600" />
            <div><p className="font-bold text-ink-900">{tx.cashTitle}</p><p className="mt-0.5 leading-5">{tx.cashBody}</p></div>
          </div>
          <button
            onClick={() => navigate(`/checkout?id=${state.restaurantId}`)}
            className="kiyo-btn-primary w-full"
          >
            {tx.continueCheckout}
          </button>
          <p className="mt-2 text-center text-[11px] text-ink-400">
            {t('checkout.placeOrderSummary')}
          </p>
        </aside>
      </div>
    </AppShell>
  );
}
