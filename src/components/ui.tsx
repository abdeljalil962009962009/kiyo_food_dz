import type { JSX } from 'react';
import type { OrderStatus } from '../lib/supabase';

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

export function StatusBadge({ status }: { status: OrderStatus }) {
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
      <span className="capitalize">{status.replace(/_/g, ' ')}</span>
    </span>
  );
}

export function PriceTag({ value }: { value: number | string }) {
  const n = typeof value === 'string' ? parseFloat(value) : value;
  return (
    <span className="font-display font-semibold text-ink-900">
      {n.toFixed(0)}
      <span className="ml-0.5 text-xs font-medium text-ink-400">{getCurrencySymbol()}</span>
    </span>
  );
}

export function RestaurantImage({ url, name, className = '' }: {
  url: string | null; name: string; className?: string;
}) {
  // Stock food photo fallback (free, royalty-free via Unsplash CDN).
  const fallback = 'https://images.unsplash.com/photo-1565299624946-b28f40a0ca4b?w=800&q=60&auto=format&fit=crop';
  return (
    <img
      src={url || fallback}
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
}

/** Format ISO timestamp as relative "5m ago" */
export function relativeTime(iso: string): string {
  const t = new Date(iso).getTime();
  const diff = (Date.now() - t) / 1000;
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return new Date(iso).toLocaleDateString();
}

/** Conditional class helper kept here to avoid pulling in clsx */
export function cx(...args: (string | false | null | undefined)[]): string {
  return args.filter(Boolean).join(' ');
}

// Unused-import suppressor pattern: re-export JSX to keep TS picking up the type
export type { JSX };
