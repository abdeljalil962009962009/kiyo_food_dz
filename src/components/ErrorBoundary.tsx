import { Component, type ErrorInfo, type ReactNode } from 'react';

type Props = {
  children: ReactNode;
  fallback?: (error: Error, reset: () => void) => ReactNode;
  /** minimal fallback used inside route-content areas */
  variant?: 'page' | 'inline';
};

type State = { error: Error | null };

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Hook for future telemetry; keep console-based to avoid noise in dev.
    if (import.meta.env.DEV) {
      console.error('[Kiyo] render error:', error, info.componentStack);
    }
  }

  reset = () => this.setState({ error: null });

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    if (this.props.fallback) return this.props.fallback(error, this.reset);
    return <DefaultFallback error={error} reset={this.reset} variant={this.props.variant ?? 'page'} />;
  }
}

function DefaultFallback({
  error, reset, variant,
}: {
  error: Error; reset: () => void; variant: 'page' | 'inline';
}) {
  const isPage = variant === 'page';
  const body = (
    <div className="space-y-3 text-center">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-error-500/10">
        <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6 text-error-500" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M10.29 3.86l-8.18 14.18A2 2 0 003.83 21h16.34a2 2 0 001.72-2.96L13.71 3.86a2 2 0 00-3.42 0z" />
        </svg>
      </div>
      <h2 className="text-lg font-semibold text-ink-900">Something broke</h2>
      <p className="text-sm text-ink-500">
        An unexpected error occurred. You can retry or reload the page.
      </p>
      {import.meta.env.DEV && (
        <pre className="mx-auto max-w-md overflow-auto rounded-lg bg-ink-900 p-3 text-left text-xs text-ink-50">
          {error.message}
        </pre>
      )}
      <div className="flex items-center justify-center gap-2 pt-1">
        <button onClick={reset} className="kiyo-btn-primary">Try again</button>
        <button onClick={() => window.location.reload()} className="kiyo-btn-secondary">Reload page</button>
      </div>
    </div>
  );

  if (isPage) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-ink-50 px-4">
        <div className="w-full max-w-md">{body}</div>
      </div>
    );
  }
  return <div className="flex items-center justify-center py-16">{body}</div>;
}
