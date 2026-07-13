import { memo, type JSX } from 'react';
import type { OrderStatus } from '../lib/supabase';
import { useT } from '../lib/i18n-react';
import { publicRestaurantImageUrl } from '../lib/restaurantMedia';

// Currency configuration - centralized for multi-currency support
// Default currency is DZD (Algerian Dinar), but architecture supports future expansion
const CURRENCY_CONFIG = {
  code: 'DZD',
  symbol: 'DA',
  name: 'Algerian Dinar',
  decimals: 2,
  format: (amount: number) => `${amount.toFixed(0)} DA`,
};

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function formatCurrency(amount: number | string, _currencyCode?: string): string {
  const n = typeof amount === 'string' ? parseFloat(amount) : amount;
  // For now, only DZD is supported. Future: lookup config by currencyCode
  return CURRENCY_CONFIG.format(n);
}

export function getCurrencySymbol(): string {
  return CURRENCY_CONFIG.symbol;
}

export const StatusBadge = memo(function StatusBadge({ status }: { status: OrderStatus }) {
  const { t } = useT();
  const styles: Record<OrderStatus, string> = {
    pending: 'bg-warning-500/15 text-warning-600',
    accepted: 'bg-blue-100 text-blue-700',
    preparing: 'bg-ember-500/15 text-ember-700',
    out_for_delivery: 'bg-indigo-100 text-indigo-700',
    delivered: 'bg-sage-100 text-sage-600',
    cancelled: 'bg-error-500/15 text-error-600',
    failed_delivery: 'bg-error-500/15 text-error-600',
    refunded: 'bg-ink-100 text-ink-600',
  };
  const dot: Record<OrderStatus, string> = {
    pending: 'bg-warning-500',
    accepted: 'bg-blue-500',
    preparing: 'bg-ember-500',
    out_for_delivery: 'bg-indigo-500',
    delivered: 'bg-sage-500',
    cancelled: 'bg-error-500',
    failed_delivery: 'bg-error-500',
    refunded: 'bg-ink-400',
  };
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ${styles[status]}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${dot[status]}`} />
      <span>{t(`status.${status}`)}</span>
    </span>
  );
});

export const PriceTag = memo(function PriceTag({ value }: { value: number | string }) {
  const n = typeof value === 'string' ? parseFloat(value) : value;
  return (
    <span className="font-display font-semibold text-ink-900">
      {n.toFixed(0)}
      <span className="ml-0.5 text-xs font-medium text-ink-400">{getCurrencySymbol()}</span>
    </span>
  );
});

export const RestaurantImage = memo(function RestaurantImage({ url, name, className = '' }: {
  url: string | null; name: string; className?: string;
}) {
  // Stock food photo fallback (free, royalty-free via Unsplash CDN).
  const fallback = 'https://images.unsplash.com/photo-1565299624946-b28f40a0ca4b?w=800&q=60&auto=format&fit=crop';
  const resolvedUrl = publicRestaurantImageUrl(url);
  return (
    <img
      src={resolvedUrl || fallback}
      alt={name}
      loading="lazy"
      decoding="async"
      onError={(e) => {
        const img = e.currentTarget;
        if (img.src !== fallback) img.src = fallback;
      }}
      className={`h-full w-full object-cover ${className}`}
    />
  );
});

/** Format an ISO timestamp using the active document language. */
export function relativeTime(iso: string): string {
  const timestamp = new Date(iso).getTime();
  const diffSeconds = Math.max(0, Math.floor((Date.now() - timestamp) / 1000));
  const documentLocale = typeof document === 'undefined' ? 'fr' : document.documentElement.lang;
  const locale = documentLocale === 'ar' ? 'ar-DZ' : documentLocale === 'en' ? 'en-DZ' : 'fr-DZ';
  const formatter = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });
  if (diffSeconds < 60) return formatter.format(-diffSeconds, 'second');
  if (diffSeconds < 3600) return formatter.format(-Math.floor(diffSeconds / 60), 'minute');
  if (diffSeconds < 86400) return formatter.format(-Math.floor(diffSeconds / 3600), 'hour');
  if (diffSeconds < 604800) return formatter.format(-Math.floor(diffSeconds / 86400), 'day');
  return new Date(iso).toLocaleDateString(locale);
}

/** Conditional class helper kept here to avoid pulling in clsx */
export function cx(...args: (string | false | null | undefined)[]): string {
  return args.filter(Boolean).join(' ');
}

// Unused-import suppressor pattern: re-export JSX to keep TS picking up the type
export type { JSX };
