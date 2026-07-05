import { Link, useNavigate } from 'react-router-dom';
import { Trash2, ShoppingBag, ChevronLeft } from 'lucide-react';
import { useT } from '../lib/i18n-react';
import { useCart } from '../context/CartContext';
import { AppShell } from '../components/AppShell';
import { PriceTag } from '../components/ui';

export default function CartPage() {
  const { t } = useT();
  const navigate = useNavigate();
  const { state, subtotal, setQuantity, removeItem, clear, totalItems } = useCart();

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

      <div className="grid gap-4 lg:grid-cols-[1fr,360px]">
        <div className="space-y-2">
          {state.lines.map((line) => (
            <div key={line.item.id} className="kiyo-card flex items-center gap-3 p-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-display text-sm font-bold text-ink-900">{line.item.name}</h3>
                  <button
                    onClick={() => removeItem(line.item.id)}
                    className="text-ink-400 transition-colors hover:text-error-600"
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
              <div className="flex items-center gap-1 rounded-lg border border-ink-200 bg-white p-0.5">
                <button
                  onClick={() => setQuantity(line.item.id, line.quantity - 1)}
                  className="flex h-7 w-7 items-center justify-center rounded-md text-ink-700 hover:bg-ink-100"
                  aria-label="decrease"
                >-</button>
                <span className="min-w-6 text-center text-sm font-semibold text-ink-900">
                  {line.quantity}
                </span>
                <button
                  onClick={() => setQuantity(line.item.id, line.quantity + 1)}
                  className="flex h-7 w-7 items-center justify-center rounded-md text-ink-700 hover:bg-ink-100"
                  aria-label="increase"
                >+</button>
              </div>
              <div className="w-20 text-right">
                <PriceTag value={line.unitPriceSnapshot * line.quantity} />
              </div>
            </div>
          ))}
          <button
            onClick={() => clear()}
            className="kiyo-btn-ghost text-error-600 hover:bg-error-500/10"
          >
            <Trash2 className="h-4 w-4" />
            {t('cart.clear')}
          </button>
        </div>

        <aside className="kiyo-card h-fit p-5 lg:sticky lg:top-20">
          <h2 className="mb-3 font-display text-base font-bold text-ink-900">{t('cart.total')}</h2>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between text-ink-600">
              <span>{t('cart.subtotal')}</span>
              <PriceTag value={subtotal} />
            </div>
            <div className="flex justify-between text-ink-400">
              <span>{t('cart.deliveryFee')}</span>
              <span className="text-xs">{t('checkout.idle')}</span>
            </div>
            <div className="flex justify-between text-ink-400">
              <span>{t('cart.serviceFee')}</span>
              <span className="text-xs">{t('checkout.idle')}</span>
            </div>
          </div>
          <div className="my-3 h-px bg-ink-100" />
          <div className="mb-4 flex items-center justify-between">
            <span className="font-display font-bold text-ink-900">{t('cart.total')}</span>
            <span className="text-xs text-ink-400">{totalItems} {t('orders.items')}</span>
          </div>
          <button
            onClick={() => navigate(`/checkout?id=${state.restaurantId}`)}
            className="kiyo-btn-primary w-full"
          >
            {t('cart.checkout')}
          </button>
          <p className="mt-2 text-center text-[11px] text-ink-400">
            {t('checkout.placeOrderSummary')}
          </p>
        </aside>
      </div>
    </AppShell>
  );
}
