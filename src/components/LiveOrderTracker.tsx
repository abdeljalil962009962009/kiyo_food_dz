import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle, Clock, LifeBuoy, Truck, XCircle } from 'lucide-react';
import type { OrderRow } from '../lib/supabase';
import { useT } from '../lib/i18n-react';
import { requestCustomerCancellation } from '../lib/orderActions';
import { liveEtaWindow } from '../lib/deliveryEta';
import { isValidMapCoordinate } from '../lib/googleMaps';
import TrackingMap from './TrackingMap';

type OrderWithRestaurant = OrderRow & {
  restaurants: {
    id: string;
    name: string;
    latitude: number | null;
    longitude: number | null;
    estimated_delivery_min: number | null;
  } | null;
};

type Props = {
  order: OrderWithRestaurant;
  onRefresh: () => void;
  realtimeStatus: 'connecting' | 'connected' | 'error' | 'closed';
};

const copy = {
  en: {
    live: 'Live order', order: 'Order', from: 'From', connected: 'Realtime connected', reconnecting: 'Reconnecting live updates...',
    cancel: 'Cancel order', cancelling: 'Cancelling...', cancelled: 'Order cancelled. No refund is needed because this is Cash on Delivery.',
    support: 'This order can no longer be cancelled automatically. An urgent request was sent to support.',
    failure: 'We could not request cancellation. Open order support to get help.', help: 'Something wrong with this order?',
    eta: 'Estimated arrival', updatedEta: 'Updated arrival estimate', delayed: 'The order is taking longer than expected. This range has been updated honestly.',
    minutes: 'min', cod: 'Cash on Delivery: you are not charged before delivery.',
    steps: [
      ['Placed', 'Waiting for restaurant confirmation'], ['Confirmed', 'Restaurant accepted'],
      ['Preparing', 'Your meal is being prepared'], ['On the way', 'Delivery in progress'], ['Delivered', 'Order completed'],
    ],
  },
  fr: {
    live: 'Commande en direct', order: 'Commande', from: 'Chez', connected: 'Suivi en temps r\u00e9el actif', reconnecting: 'Reconnexion du suivi en direct...',
    cancel: 'Annuler la commande', cancelling: 'Annulation...', cancelled: 'Commande annul\u00e9e. Aucun remboursement n\u2019est n\u00e9cessaire car le paiement se fait \u00e0 la livraison.',
    support: 'Cette commande ne peut plus \u00eatre annul\u00e9e automatiquement. Une demande urgente a \u00e9t\u00e9 envoy\u00e9e au support.',
    failure: 'Impossible de demander l\u2019annulation. Ouvrez le support de la commande.', help: 'Un probl\u00e8me avec cette commande ?',
    eta: 'Arriv\u00e9e estim\u00e9e', updatedEta: 'Nouvelle estimation', delayed: 'La commande prend plus de temps que pr\u00e9vu. Cette estimation a \u00e9t\u00e9 mise \u00e0 jour honn\u00eatement.',
    minutes: 'min', cod: 'Paiement \u00e0 la livraison : aucun montant n\u2019est d\u00e9bit\u00e9 avant la livraison.',
    steps: [
      ['Pass\u00e9e', 'En attente du restaurant'], ['Confirm\u00e9e', 'Le restaurant a accept\u00e9'],
      ['Pr\u00e9paration', 'Votre repas est en pr\u00e9paration'], ['En livraison', 'Livraison en cours'], ['Livr\u00e9e', 'Commande termin\u00e9e'],
    ],
  },
  ar: {
    live: '\u0637\u0644\u0628 \u0645\u0628\u0627\u0634\u0631', order: '\u0627\u0644\u0637\u0644\u0628', from: '\u0645\u0646', connected: '\u0627\u0644\u062a\u062d\u062f\u064a\u062b \u0627\u0644\u0645\u0628\u0627\u0634\u0631 \u0645\u062a\u0635\u0644', reconnecting: '\u062c\u0627\u0631\u064a \u0625\u0639\u0627\u062f\u0629 \u0627\u0644\u0627\u062a\u0635\u0627\u0644 \u0628\u0627\u0644\u062a\u062d\u062f\u064a\u062b\u0627\u062a...',
    cancel: '\u0625\u0644\u063a\u0627\u0621 \u0627\u0644\u0637\u0644\u0628', cancelling: '\u062c\u0627\u0631\u064a \u0627\u0644\u0625\u0644\u063a\u0627\u0621...', cancelled: '\u062a\u0645 \u0625\u0644\u063a\u0627\u0621 \u0627\u0644\u0637\u0644\u0628. \u0644\u0627 \u064a\u0644\u0632\u0645 \u0627\u0633\u062a\u0631\u062f\u0627\u062f \u0644\u0623\u0646 \u0627\u0644\u062f\u0641\u0639 \u0639\u0646\u062f \u0627\u0644\u062a\u0648\u0635\u064a\u0644.',
    support: '\u0644\u0627 \u064a\u0645\u0643\u0646 \u0625\u0644\u063a\u0627\u0621 \u0647\u0630\u0627 \u0627\u0644\u0637\u0644\u0628 \u062a\u0644\u0642\u0627\u0626\u064a\u0627. \u062a\u0645 \u0625\u0631\u0633\u0627\u0644 \u0637\u0644\u0628 \u0639\u0627\u062c\u0644 \u0644\u0644\u062f\u0639\u0645.',
    failure: '\u062a\u0639\u0630\u0631 \u0637\u0644\u0628 \u0627\u0644\u0625\u0644\u063a\u0627\u0621. \u0627\u0641\u062a\u062d \u062f\u0639\u0645 \u0627\u0644\u0637\u0644\u0628.', help: '\u0647\u0644 \u0647\u0646\u0627\u0643 \u0645\u0634\u0643\u0644\u0629 \u0641\u064a \u0647\u0630\u0627 \u0627\u0644\u0637\u0644\u0628\u061f',
    eta: '\u0627\u0644\u0648\u0635\u0648\u0644 \u0627\u0644\u0645\u062a\u0648\u0642\u0639', updatedEta: '\u062a\u0642\u062f\u064a\u0631 \u0648\u0635\u0648\u0644 \u0645\u062d\u062f\u062b', delayed: '\u0627\u0644\u0637\u0644\u0628 \u064a\u0633\u062a\u063a\u0631\u0642 \u0648\u0642\u062a\u0627 \u0623\u0637\u0648\u0644 \u0645\u0646 \u0627\u0644\u0645\u062a\u0648\u0642\u0639. \u062a\u0645 \u062a\u062d\u062f\u064a\u062b \u0627\u0644\u062a\u0642\u062f\u064a\u0631 \u0628\u0648\u0636\u0648\u062d.',
    minutes: '\u062f', cod: '\u0627\u0644\u062f\u0641\u0639 \u0639\u0646\u062f \u0627\u0644\u062a\u0648\u0635\u064a\u0644: \u0644\u0646 \u064a\u062a\u0645 \u062e\u0635\u0645 \u0623\u064a \u0645\u0628\u0644\u063a \u0642\u0628\u0644 \u0627\u0644\u062a\u0648\u0635\u064a\u0644.',
    steps: [
      ['\u062a\u0645 \u0627\u0644\u0637\u0644\u0628', '\u0628\u0627\u0646\u062a\u0638\u0627\u0631 \u062a\u0623\u0643\u064a\u062f \u0627\u0644\u0645\u0637\u0639\u0645'], ['\u0645\u0624\u0643\u062f', '\u0648\u0627\u0641\u0642 \u0627\u0644\u0645\u0637\u0639\u0645'],
      ['\u0642\u064a\u062f \u0627\u0644\u062a\u062d\u0636\u064a\u0631', '\u064a\u062a\u0645 \u062a\u062d\u0636\u064a\u0631 \u0648\u062c\u0628\u062a\u0643'], ['\u0641\u064a \u0627\u0644\u0637\u0631\u064a\u0642', '\u0627\u0644\u062a\u0648\u0635\u064a\u0644 \u062c\u0627\u0631'], ['\u062a\u0645 \u0627\u0644\u062a\u0648\u0635\u064a\u0644', '\u0627\u0643\u062a\u0645\u0644 \u0627\u0644\u0637\u0644\u0628'],
    ],
  },
} as const;

const TRACKED_STATUSES = ['pending', 'accepted', 'preparing', 'out_for_delivery', 'delivered'];

export function LiveOrderTracker({ order, onRefresh, realtimeStatus }: Props) {
  const { locale } = useT();
  const tx = copy[locale];
  const [cancelling, setCancelling] = useState(false);
  const [cancelMessage, setCancelMessage] = useState<string | null>(null);
  const [cancelError, setCancelError] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  const eta = liveEtaWindow({
    status: order.status,
    createdAt: order.created_at,
    routeMinutes: order.delivery_duration_minutes,
    preparationMinutes: order.restaurants?.estimated_delivery_min,
    now,
  });
  const hasMap = isValidMapCoordinate(order.restaurants?.latitude, order.restaurants?.longitude)
    && isValidMapCoordinate(order.delivery_latitude, order.delivery_longitude);

  const handleCancel = async () => {
    if (!window.confirm(`${tx.cancel}?\n\n${tx.cod}`)) return;
    setCancelling(true);
    setCancelMessage(null);
    setCancelError(null);
    try {
      const result = await requestCustomerCancellation(order);
      if (result.status === 'failed') {
        setCancelError(result.message || tx.failure);
        return;
      }
      setCancelMessage(result.status === 'cancelled' ? tx.cancelled : tx.support);
      onRefresh();
    } catch {
      setCancelError(tx.failure);
    } finally {
      setCancelling(false);
    }
  };

  const currentIndex = TRACKED_STATUSES.indexOf(order.status);
  const progress = currentIndex <= 0 ? '0%' : `${Math.min(100, currentIndex * 25)}%`;
  const steps = tx.steps.map(([label, description], index) => ({
    label, description, icon: index === 3 ? Truck : index === 4 ? CheckCircle : Clock,
  }));

  return (
    <section className="kiyo-card border border-ember-200 bg-white p-5 shadow-sm" aria-live="polite">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-ink-100 pb-3">
        <div>
          <span className="rounded-full bg-ember-50 px-2.5 py-1 text-xs font-bold text-ember-700">{tx.live}</span>
          <h2 className="mt-2 font-display text-base font-extrabold text-ink-900">{tx.order} #{order.id.slice(0, 8)}</h2>
          <p className="text-xs text-ink-500">{tx.from} {order.restaurants?.name}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {order.status === 'pending' && (
            <button type="button" onClick={handleCancel} disabled={cancelling} className="flex min-h-11 items-center gap-1.5 rounded-lg border border-error-200 bg-error-50 px-3 py-2 text-xs font-bold text-error-700 hover:bg-error-100 disabled:opacity-50">
              <XCircle className="h-4 w-4" /> {cancelling ? tx.cancelling : tx.cancel}
            </button>
          )}
          <div className={`flex min-h-11 items-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold ${realtimeStatus === 'connected' ? 'border-sage-100 bg-sage-50 text-sage-700' : 'border-warning-200 bg-warning-50 text-warning-800'}`}>
            <span className={`h-2 w-2 rounded-full ${realtimeStatus === 'connected' ? 'bg-sage-500' : 'bg-warning-500'}`} aria-hidden="true" />
            {realtimeStatus === 'connected' ? tx.connected : tx.reconnecting}
          </div>
        </div>
      </div>

      {eta && (
        <div className={`mb-4 rounded-xl border px-4 py-3 ${eta.delayed ? 'border-warning-200 bg-warning-50 text-warning-800' : 'border-sage-200 bg-sage-50 text-sage-800'}`}>
          <div className="flex items-center justify-between gap-3 text-sm">
            <span className="font-semibold">{eta.delayed ? tx.updatedEta : tx.eta}</span>
            <span className="font-extrabold">{eta.minimumMinutes}-{eta.maximumMinutes} {tx.minutes}</span>
          </div>
          {eta.delayed && <p className="mt-1 text-xs">{tx.delayed}</p>}
        </div>
      )}
      {cancelMessage && <div className="mb-4 rounded-lg border border-sage-200 bg-sage-50 px-4 py-3 text-sm text-sage-700">{cancelMessage}</div>}
      {cancelError && <div className="mb-4 rounded-lg border border-error-200 bg-error-50 px-4 py-3 text-sm text-error-700">{cancelError}</div>}

      {hasMap && (
        <div className="mb-5">
          <TrackingMap
            restaurantLat={order.restaurants!.latitude!}
            restaurantLng={order.restaurants!.longitude!}
            deliveryLat={order.delivery_latitude!}
            deliveryLng={order.delivery_longitude!}
            driverLat={null}
            driverLng={null}
            status={order.status}
          />
        </div>
      )}

      <div className="relative flex items-start justify-between overflow-x-auto pb-1">
        <div className="absolute left-4 right-4 top-4 z-0 h-0.5 bg-ink-100" />
        <div className="absolute left-4 top-4 z-0 h-0.5 bg-ember-500 transition-all duration-500" style={{ width: progress }} />
        {steps.map((step, index) => {
          const state = currentIndex > index ? 'completed' : currentIndex === index ? 'active' : 'upcoming';
          const Icon = step.icon;
          return (
            <div key={step.label} className="relative z-10 flex min-w-16 flex-1 flex-col items-center px-1">
              <div className={`flex h-9 w-9 items-center justify-center rounded-full border-2 ${state === 'completed' ? 'border-ember-500 bg-ember-500 text-white' : state === 'active' ? 'border-ember-600 bg-white text-ember-700 ring-4 ring-ember-100' : 'border-ink-200 bg-white text-ink-400'}`}>
                {state === 'completed' ? <CheckCircle className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
              </div>
              <span className={`mt-2 text-center text-xs font-bold ${state === 'active' ? 'text-ember-700' : 'text-ink-700'}`}>{step.label}</span>
              <span className="hidden max-w-28 text-center text-[11px] text-ink-400 sm:block">{step.description}</span>
            </div>
          );
        })}
      </div>

      <div className="mt-4 border-t border-ink-100 pt-3">
        <Link to={`/support?order=${order.id}`} className="inline-flex min-h-11 items-center gap-2 rounded-lg px-2 text-sm font-bold text-ink-700 hover:bg-ink-50">
          <LifeBuoy className="h-4 w-4 text-ember-600" /> {tx.help}
        </Link>
      </div>
    </section>
  );
}
