import { useEffect, useState } from 'react';
import { Cookie, X } from 'lucide-react';

const KEY = 'kiyo-cookie-consent-v1';

/**
 * Privacy-compliant cookie consent banner. Kiyo currently uses only
 * essential cookies (session, auth), so this banner is informational.
 *
 * NOTE: This component renders OUTSIDE of <RouterProvider> (it's a sibling
 * of <RouterProvider> in App.tsx), so it must NOT use react-router hooks
 * (useNavigate, Link, useLocation) — those throw "Cannot destructure
 * property 'basename' of useContext(...)" when called outside router scope.
 * Plain <a href> is safe here.
 *
 * When/ if you add analytics: gate the analytics script load behind
 * hasAnalyticsConsent() return value (currently always false).
 */
export function CookieConsentBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(KEY);
    if (!stored) setVisible(true);
  }, []);

  const dismiss = () => {
    localStorage.setItem(KEY, new Date().toISOString());
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div
      role="dialog"
      aria-label="Cookie consent"
      className="fixed inset-x-0 bottom-0 z-[1100] border-t border-ink-200 bg-white px-4 py-3 shadow-card-lg"
      style={{ paddingBottom: 'calc(var(--kiyo-safe-bottom, 0px) + 12px)' }}
    >
      <div className="mx-auto flex max-w-6xl items-center gap-3">
        <Cookie className="hidden h-5 w-5 flex-shrink-0 text-ember-500 sm:block" />
        <p className="flex-1 text-xs text-ink-600">
          Kiyo uses only essential cookies for authentication and session.
          We don't use advertising or tracking cookies.{' '}
          <a href="/legal/cookies" className="font-semibold text-ink-900 underline">
            Cookie Policy
          </a>
        </p>
        <button
          onClick={dismiss}
          className="kiyo-btn-primary"
          aria-label="Dismiss cookie banner"
        >
          OK
        </button>
        <button
          onClick={dismiss}
          className="kiyo-btn-ghost p-2"
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

/** Future analytics gating — returns false until user opts into analytics. */
export function hasAnalyticsConsent(): boolean {
  return false;
}
