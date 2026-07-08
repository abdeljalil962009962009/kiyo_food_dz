import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, AlertCircle, CheckCircle2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useT } from '../lib/i18n-react';
import { Logo } from '../components/Logo';
import { Field } from '../components/Field';
import { Spinner } from '../components/feedback';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { AuthLayout } from './LoginPage';

const RECOVERY_SESSION_ATTEMPTS = 8;
const RECOVERY_SESSION_DELAY_MS = 300;

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function hasRecoveryParams() {
  const search = new URLSearchParams(window.location.search);
  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''));
  return (
    search.has('code')
    || search.get('type') === 'recovery'
    || hash.get('type') === 'recovery'
    || hash.has('access_token')
    || hash.has('refresh_token')
  );
}

export default function ResetPasswordPage() {
  const { t } = useT();
  const navigate = useNavigate();

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [recoveryState, setRecoveryState] = useState<'checking' | 'ready' | 'invalid'>('checking');

  useEffect(() => {
    let cancelled = false;

    const verifyRecoverySession = async () => {
      try {
        const code = new URLSearchParams(window.location.search).get('code');
        if (code) {
          const exchanged = await supabase.auth.exchangeCodeForSession(code);
          if (cancelled) return;
          if (!exchanged.error && exchanged.data.session) {
            setRecoveryState('ready');
            window.history.replaceState({}, document.title, '/reset-password');
            return;
          }
        }

        for (let attempt = 0; attempt < RECOVERY_SESSION_ATTEMPTS; attempt += 1) {
          const current = await supabase.auth.getSession();
          if (cancelled) return;
          if (current.data.session) {
            setRecoveryState('ready');
            if (hasRecoveryParams()) {
              window.history.replaceState({}, document.title, '/reset-password');
            }
            return;
          }
          await wait(RECOVERY_SESSION_DELAY_MS);
        }

        setRecoveryState('invalid');
      } catch (err) {
        console.error('Failed to verify password recovery session', err);
        if (!cancelled) setRecoveryState('invalid');
      }
    };

    void verifyRecoverySession();

    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (cancelled) return;
      if ((event === 'PASSWORD_RECOVERY' || event === 'SIGNED_IN') && session) {
        setRecoveryState('ready');
      }
    });

    return () => {
      cancelled = true;
      data.subscription.unsubscribe();
    };
  }, []);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (submitting) return;

    setLocalError(null);

    // Basic password validation
    if (password.length < 8) {
      setLocalError(t('auth.error.weakPassword'));
      return;
    }

    if (password !== confirmPassword) {
      setLocalError(t('auth.error.passwordMismatch'));
      return;
    }

    setSubmitting(true);
    try {
      const { error } = await supabase.auth.updateUser({
        password: password,
      });

      if (error) {
        throw error;
      }

      setSuccess(true);
    } catch (err) {
      console.error('Failed to update password from recovery session', err);
      const message = err instanceof Error ? err.message : t('auth.error.unknown');
      setLocalError(message);
    } finally {
      setSubmitting(false);
    }
  };

  if (success) {
    return (
      <AuthLayout>
        <div className="mb-6 flex justify-center">
          <Logo size={48} withText={false} />
        </div>
        <div className="rounded-2xl border border-sage-200 bg-sage-50 p-6 text-center animate-fade-in">
          <CheckCircle2 className="mx-auto h-10 w-10 text-sage-500 animate-bounce-short" />
          <h2 className="mt-3 font-display text-lg font-bold text-ink-900">
            {t('auth.resetPasswordSuccess')}
          </h2>
          <p className="mt-1 text-sm text-ink-600">
            {t('auth.resetPasswordSuccessBody')}
          </p>
          <button
            onClick={() => navigate('/login', { replace: true })}
            className="kiyo-btn-primary mt-5 w-full"
          >
            {t('auth.backToLogin')}
          </button>
        </div>
      </AuthLayout>
    );
  }

  if (recoveryState === 'checking') {
    return (
      <AuthLayout>
        <div className="rounded-2xl border border-ink-100 bg-white p-6 text-center">
          <Spinner className="mx-auto h-6 w-6 text-ember-600" />
          <p className="mt-3 text-sm text-ink-500">{t('auth.sessionRestoring')}</p>
        </div>
      </AuthLayout>
    );
  }

  if (recoveryState === 'invalid') {
    return (
      <AuthLayout>
        <div className="rounded-2xl border border-error-500/20 bg-error-500/10 p-6 text-center">
          <AlertCircle className="mx-auto h-10 w-10 text-error-600" />
          <h2 className="mt-3 font-display text-lg font-bold text-ink-900">
            {t('auth.resetInvalidTitle')}
          </h2>
          <p className="mt-1 text-sm text-ink-600">{t('auth.resetInvalidBody')}</p>
          <button
            onClick={() => navigate('/forgot-password', { replace: true })}
            className="kiyo-btn-primary mt-5 w-full"
          >
            {t('auth.resetPasswordCta')}
          </button>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout>
      <div className="mb-8 text-center">
        <Logo size={48} withText={false} />
        <h1 className="mt-4 font-display text-2xl font-extrabold tracking-tight text-ink-900">
          {t('auth.newPassword')}
        </h1>
        <p className="mt-1 text-sm text-ink-500">
          {t('auth.newPasswordPrompt')}
        </p>
      </div>

      <ErrorBoundary variant="inline">
        <form onSubmit={submit} className="space-y-4" noValidate>
          <Field
            name="password"
            type="password"
            autoComplete="new-password"
            label={t('auth.password')}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            icon={<Lock className="h-4 w-4" />}
            placeholder="••••••••"
            required
          />

          <Field
            name="confirmPassword"
            type="password"
            autoComplete="new-password"
            label={t('auth.confirmPassword')}
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            icon={<Lock className="h-4 w-4" />}
            placeholder="••••••••"
            required
          />

          {localError && (
            <div className="flex items-start gap-2 rounded-lg bg-error-500/10 px-3 py-2.5 text-xs text-error-600">
              <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
              <span className="font-medium">{localError}</span>
            </div>
          )}

          <button type="submit" disabled={submitting} className="kiyo-btn-primary w-full">
            {submitting ? (
              <>
                <Spinner className="h-4 w-4" />
                {t('auth.updating')}
              </>
            ) : (
              t('auth.savePassword')
            )}
          </button>
        </form>
      </ErrorBoundary>
    </AuthLayout>
  );
}
