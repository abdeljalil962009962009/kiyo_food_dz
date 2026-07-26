import type { Locale } from './i18n';

export type CheckoutRecoveryKind =
  | 'refresh_quote'
  | 'restaurant_closed'
  | 'review_cart'
  | 'outside_zone'
  | 'minimum_order'
  | 'generic';

type RecoveryCopy = Record<Exclude<CheckoutRecoveryKind, 'generic'>, string>;

const COPY: Record<Locale, RecoveryCopy> = {
  en: {
    refresh_quote: 'Your road-route price expired. Recalculate it before placing the order.',
    restaurant_closed: 'This restaurant stopped accepting orders. Your cart is safe; try again when it reopens.',
    review_cart: 'A dish or selected option changed and is no longer available. Review your cart before ordering.',
    outside_zone: 'The current address is outside the restaurant’s delivery area. Choose a nearer delivery point.',
    minimum_order: 'The restaurant’s minimum order changed. Review your cart total before continuing.',
  },
  fr: {
    refresh_quote: 'Votre tarif selon le trajet routier a expiré. Recalculez-le avant de commander.',
    restaurant_closed: 'Ce restaurant a suspendu les commandes. Votre panier est conservé ; réessayez à sa réouverture.',
    review_cart: 'Un plat ou une option choisie a changé et n’est plus disponible. Vérifiez votre panier avant de commander.',
    outside_zone: 'Cette adresse est hors de la zone de livraison du restaurant. Choisissez un point de livraison plus proche.',
    minimum_order: 'Le minimum de commande du restaurant a changé. Vérifiez le total de votre panier avant de continuer.',
  },
  ar: {
    refresh_quote: 'انتهت صلاحية تسعيرة المسار. أعد حسابها قبل تأكيد الطلب.',
    restaurant_closed: 'أوقف المطعم استقبال الطلبات. سلتك محفوظة؛ حاول مجدداً عند إعادة الفتح.',
    review_cart: 'تغيّر طبق أو خيار محدد ولم يعد متاحاً. راجع سلتك قبل تأكيد الطلب.',
    outside_zone: 'هذا العنوان خارج نطاق توصيل المطعم. اختر نقطة توصيل أقرب.',
    minimum_order: 'تغيّر الحد الأدنى للطلب في المطعم. راجع مجموع السلة قبل المتابعة.',
  },
};

function searchableError(error: unknown): string {
  if (typeof error === 'string') return error.toLowerCase();
  if (!error || typeof error !== 'object') return '';
  const candidate = error as {
    code?: unknown;
    message?: unknown;
    details?: unknown;
    hint?: unknown;
  };
  return [candidate.code, candidate.message, candidate.details, candidate.hint]
    .filter((value): value is string | number => (
      typeof value === 'string' || typeof value === 'number'
    ))
    .join(' ')
    .toLowerCase();
}

export function checkoutRecovery(
  error: unknown,
  locale: Locale,
  fallback: string,
): { kind: CheckoutRecoveryKind; message: string } {
  const text = searchableError(error);
  let kind: CheckoutRecoveryKind = 'generic';

  if (/route quote|delivery route quote|quote.*(expired|already used|missing)/.test(text)) {
    kind = 'refresh_quote';
  } else if (/restaurant.*(not currently accepting|stopped accepting|closed|paused)/.test(text) || /\b55006\b/.test(text) && !/cart item|option/.test(text)) {
    kind = 'restaurant_closed';
  } else if (/cart item|dish|selected (menu )?option|required choice|unavailable or belongs/.test(text)) {
    kind = 'review_cart';
  } else if (/outside.*delivery (zone|area)/.test(text)) {
    kind = 'outside_zone';
  } else if (/below.*minimum|minimum order/.test(text)) {
    kind = 'minimum_order';
  }

  return {
    kind,
    message: kind === 'generic' ? fallback : COPY[locale][kind],
  };
}

export function deliveryQuoteNeedsRefresh(
  expiresAt: string | undefined,
  nowMs = Date.now(),
  safetyWindowMs = 30_000,
): boolean {
  const expiry = Date.parse(expiresAt ?? '');
  return !Number.isFinite(expiry) || expiry <= nowMs + safetyWindowMs;
}
