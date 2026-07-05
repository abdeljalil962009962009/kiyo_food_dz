import { Link, useNavigate } from 'react-router-dom';
import { useState, type FormEvent } from 'react';
import { Mail, Lock, AlertCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useT } from '../lib/i18n-react';
import { Logo } from '../components/Logo';
import { Field } from '../components/Field';
import { Spinner } from '../components/feedback';
import { ErrorBoundary } from '../components/ErrorBoundary';

export default function LoginPage() {
  const { t } = useT();
  const { signInWithPassword, signInWithGoogle, signInWithApple, error } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (submitting) return; // prevent double-click
    setLocalError(null);
    if (!email || !password) {
      setLocalError(t('auth.error.invalidCredentials'));
      return;
    }
    setSubmitting(true);
    const { ok } = await signInWithPassword(email.trim(), password);
    setSubmitting(false);
    if (ok) navigate('/dashboard', { replace: true });
  };

  const google = async () => {
    setLocalError(null);
    await signInWithGoogle();
    // OAuth will redirect; nothing to navigate here.
  };

  const apple = async () => {
    setLocalError(null);
    await signInWithApple();
  };

  const shownError = localError ?? (error ? error.message : null);

  return (
    <AuthLayout>
      <div className="mb-8 text-center">
        <Logo size={48} withText={false} />
        <h1 className="mt-4 font-display text-2xl font-extrabold tracking-tight text-ink-900">
          {t('auth.login')}
        </h1>
        <p className="mt-1 text-sm text-ink-500">{t('brand.tagline')}</p>
      </div>

      <ErrorBoundary variant="inline">
        <form onSubmit={submit} className="space-y-4" noValidate>
          <Field
            name="email"
            type="email"
            autoComplete="email"
            inputMode="email"
            label={t('auth.email')}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            icon={<Mail className="h-4 w-4" />}
            placeholder="you@example.com"
            required
          />

          <Field
            name="password"
            type="password"
            autoComplete="current-password"
            label={t('auth.password')}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            icon={<Lock className="h-4 w-4" />}
            placeholder="••••••••"
            required
          />

          <div className="flex justify-end">
            <Link
              to="/auth/forgot"
              className="text-xs font-semibold text-ember-600 hover:text-ember-700"
            >
              {t('auth.forgotPassword')}
            </Link>
          </div>

          {shownError && (
            <div className="flex items-start gap-2 rounded-lg bg-error-500/10 px-3 py-2.5 text-xs text-error-600">
              <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
              <span className="font-medium">{shownError}</span>
            </div>
          )}

          <button type="submit" disabled={submitting} className="kiyo-btn-primary w-full">
            {submitting ? (
              <>
                <Spinner className="h-4 w-4" />
                {t('auth.signingIn')}
              </>
            ) : t('auth.login')}
          </button>
        </form>
      </ErrorBoundary>

      <div className="my-5 flex items-center gap-3">
        <span className="h-px flex-1 bg-ink-100" />
        <span className="text-xs font-medium uppercase tracking-wide text-ink-400">
          {t('auth.orContinueWith')}
        </span>
        <span className="h-px flex-1 bg-ink-100" />
      </div>

      <button onClick={google} className="kiyo-btn-secondary w-full" type="button">
        <GoogleIcon />
        {t('auth.continueWithGoogle')}
      </button>

      <button onClick={apple} className="kiyo-btn-secondary mt-2 w-full" type="button">
        <AppleIcon />
        {t('auth.continueWithApple')}
      </button>

      <p className="mt-6 text-center text-sm text-ink-500">
        {t('auth.noAccount')}{' '}
        <Link to="/signup" className="font-semibold text-ember-600 hover:text-ember-700">
          {t('auth.signup')}
        </Link>
      </p>
    </AuthLayout>
  );
}

// Shared split-screen layout for auth pages.
export function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen lg:grid lg:grid-cols-2">
      {/* Brand panel */}
      <aside className="relative hidden overflow-hidden bg-ink-900 lg:flex lg:flex-col lg:justify-between lg:p-12">
        <div
          className="absolute inset-0 opacity-[0.35]"
          style={{
            backgroundImage:
              'radial-gradient(60% 60% at 20% 10%, rgba(251,79,10,0.45) 0%, transparent 60%), radial-gradient(50% 50% at 90% 80%, rgba(79,122,91,0.4) 0%, transparent 60%)',
          }}
          aria-hidden
        />
        <div className="relative">
          <Logo size={40} />
        </div>
        <div className="relative">
          <h2 className="font-display text-4xl font-extrabold leading-tight text-white">
            Local flavor,<br />delivered.
          </h2>
          <p className="mt-3 max-w-sm text-sm text-ink-200">
            Kiyo connects you with the best restaurants across Algeria — fast, premium, and reliable.
          </p>
        </div>
        <div className="relative text-xs text-ink-400">© {new Date().getFullYear()} Kiyo</div>
      </aside>

      {/* Form panel */}
      <main className="flex min-h-screen items-center justify-center bg-ink-50 px-4 py-10 sm:px-8">
        <div className="w-full max-w-sm">{children}</div>
      </main>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden>
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.99.66-2.25 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1A11 11 0 0 0 2.18 7.06l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z" />
    </svg>
  );
}

function AppleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden>
      <path d="M17.05 20.28c-.98.95-2.05 1.6-3.13 2.01-.94.36-1.94.54-3.01.54-.87 0-1.68-.13-2.44-.4a6.6 6.6 0 0 1-2.02-1.14 8.3 8.3 0 0 1-1.57-1.74C4.12 18.17 3.5 16.5 3.5 14.6c0-1.89.56-3.58 1.67-5.03A8.96 8.96 0 0 1 9.9 6.04c.6-.14 1.22-.21 1.85-.21.66 0 1.3.08 1.92.24.62.16 1.2.4 1.76.72.35.2.66.43.95.68.26.23.5.48.7.75.12-.06.24-.12.37-.18.76-.35 1.57-.52 2.42-.52.34 0 .67.03.99.1.32.06.62.15.9.27.24.1.46.23.66.38.21.15.4.33.57.52.14.16.27.34.38.53.08.14.15.29.21.44l-.02.05c-.05.12-.14.23-.27.31-.15.1-.32.17-.52.23-.18.05-.38.1-.58.14a5.62 5.62 0 0 0-.62.18c-.43.16-.8.38-1.1.67-.3.29-.52.63-.67 1.03-.33.87-.27 1.83.17 2.8.43.93 1.12 1.67 2.04 2.17.29.16.6.29.93.38.33.1.68.15 1.04.17l.06.01.03.05c.02.04.03.1.03.18 0 .08-.01.18-.04.28-.02.1-.06.2-.1.3-.04.1-.09.18-.14.26-.11.17-.25.34-.4.49zm-5.82-15.2c.27-.44.48-.91.63-1.41.15-.5.23-1.01.23-1.53 0-.38-.05-.75-.15-1.11a4.48 4.48 0 0 0-.39-.97 4.45 4.45 0 0 0-.59-.83A4.56 4.56 0 0 0 10.08 0l-.06.01-.01.06c0 .3.04.6.12.9.08.3.2.59.36.87.16.28.36.54.59.78.23.24.5.45.78.62.39.24.71.54.97.89.25.35.44.73.56 1.14l.02.07-.06.02z" fill="currentColor"/>
    </svg>
  );
}
