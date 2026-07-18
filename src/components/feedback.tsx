import type { ReactNode } from 'react';

const SPINNER_SIZE_CLASS: Record<'sm' | 'md' | 'lg', string> = {
  sm: 'h-3 w-3',
  md: 'h-4 w-4',
  lg: 'h-6 w-6',
};

export function Spinner({
  className = '',
  size,
}: {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}) {
  const sizeClass = size ? SPINNER_SIZE_CLASS[size] : '';
  return (
    <svg
      className={`animate-spin ${sizeClass} ${className}`.trim()}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
    >
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeOpacity="0.2" strokeWidth="4" />
      <path d="M22 12a10 10 0 0 1-10 10" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
    </svg>
  );
}

export function FullScreenLoader({ label }: { label?: string }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-ink-50">
      <div className="relative flex h-14 w-14 items-center justify-center">
        <div className="absolute inset-0 animate-pulse-soft rounded-full bg-ember-500/15" />
        <Spinner className="h-7 w-7 text-ember-600" />
      </div>
      {label && <p className="text-sm font-medium text-ink-500">{label}</p>}
    </div>
  );
}

export function InlineLoader({ label }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-12">
      <Spinner className="h-5 w-5 text-ember-600" />
      {label && <p className="text-xs text-ink-500">{label}</p>}
    </div>
  );
}

export function SkeletonLine({ w = 'w-full', h = 'h-4' }: { w?: string; h?: string }) {
  return <div className={`kiyo-skeleton ${w} ${h}`} />;
}

export function Skeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex items-center gap-3">
          <SkeletonLine w="w-10" h="h-10" />
          <div className="flex-1 space-y-2">
            <SkeletonLine w="w-1/2" />
            <SkeletonLine w="w-3/4" h="h-3" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function ErrorState({ title, message, onRetry, retryLabel }: {
  title: string; message: string; onRetry?: () => void; retryLabel?: string;
}): ReactNode {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
      <div className="flex h-11 w-11 items-center justify-center rounded-full bg-error-500/10">
        <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5 text-error-500" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M10.29 3.86l-8.18 14.18A2 2 0 003.83 21h16.34a2 2 0 001.72-2.96L13.71 3.86a2 2 0 00-3.42 0z" />
        </svg>
      </div>
      <h2 className="text-base font-semibold text-ink-900">{title}</h2>
      <p className="max-w-sm text-sm text-ink-500">{message}</p>
      {onRetry && (
        <button onClick={onRetry} className="kiyo-btn-secondary mt-1">{retryLabel ?? 'Retry'}</button>
      )}
    </div>
  );
}

export function PremiumEmptyState({
  icon,
  title,
  message,
  action,
  secondary,
}: {
  icon: ReactNode;
  title: string;
  message: string;
  action?: ReactNode;
  secondary?: ReactNode;
}) {
  return (
    <div className="kiyo-card relative overflow-hidden px-6 py-12 text-center">
      <div
        className="absolute inset-x-10 top-0 h-20 rounded-b-full bg-ember-500/5 blur-2xl"
        aria-hidden
      />
      <div className="relative mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-ember-100 bg-ember-50 text-ember-600">
        {icon}
      </div>
      <h2 className="relative mt-4 font-display text-lg font-extrabold text-ink-900">{title}</h2>
      <p className="relative mx-auto mt-2 max-w-md text-sm leading-6 text-ink-500">{message}</p>
      {(action || secondary) && (
        <div className="relative mt-5 flex flex-col items-center justify-center gap-2 sm:flex-row">
          {action}
          {secondary}
        </div>
      )}
    </div>
  );
}
