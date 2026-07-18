import { useEffect, useState } from 'react';
import { Cookie, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import type { Locale } from '../lib/i18n';

const KEY = 'kiyo-cookie-consent-v1';

const COPY: Record<Locale, {
  dialog: string;
  message: string;
  policy: string;
  dismiss: string;
  close: string;
}> = {
  fr: {
    dialog: 'Information sur les cookies',
    message: "Kiyo Food utilise uniquement les cookies essentiels à l'authentification et à la session. Aucun cookie publicitaire ou de suivi n'est utilisé.",
    policy: 'Politique relative aux cookies',
    dismiss: 'Compris, fermer le message',
    close: 'Fermer',
  },
  ar: {
    dialog: 'معلومات ملفات تعريف الارتباط',
    message: 'تستخدم كيو فود ملفات تعريف الارتباط الضرورية فقط لتسجيل الدخول والحفاظ على الجلسة. ولا نستخدم ملفات للإعلانات أو التتبع.',
    policy: 'سياسة ملفات تعريف الارتباط',
    dismiss: 'فهمت، إغلاق الرسالة',
    close: 'إغلاق',
  },
  en: {
    dialog: 'Cookie information',
    message: 'Kiyo Food uses only essential cookies for authentication and session continuity. We do not use advertising or tracking cookies.',
    policy: 'Cookie Policy',
    dismiss: 'Understood, dismiss message',
    close: 'Close',
  },
};

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
  const { locale } = useAuth();
  const [visible, setVisible] = useState(false);
  const copy = COPY[locale];

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
      aria-label={copy.dialog}
      dir={locale === 'ar' ? 'rtl' : 'ltr'}
      className="fixed inset-x-0 bottom-0 z-[1100] border-t border-ink-200 bg-white px-4 py-3 shadow-card-lg"
      style={{ paddingBottom: 'calc(var(--kiyo-safe-bottom, 0px) + 12px)' }}
    >
      <div className="mx-auto flex max-w-6xl items-center gap-3">
        <Cookie className="hidden h-5 w-5 flex-shrink-0 text-ember-500 sm:block" />
        <p className="flex-1 text-xs text-ink-600">
          {copy.message}{' '}
          <a href="/legal/cookies" className="font-semibold text-ink-900 underline">
            {copy.policy}
          </a>
        </p>
        <button
          type="button"
          onClick={dismiss}
          className="kiyo-btn-primary min-h-11 flex-shrink-0"
          aria-label={copy.dismiss}
        >
          OK
        </button>
        <button
          type="button"
          onClick={dismiss}
          className="kiyo-btn-ghost min-h-11 min-w-11 flex-shrink-0 p-2"
          aria-label={copy.close}
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
