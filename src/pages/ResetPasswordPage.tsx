import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, Mail, KeyRound, AlertCircle, CheckCircle2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useT } from '../lib/i18n-react';
import { Logo } from '../components/Logo';
import { Field } from '../components/Field';
import { Spinner } from '../components/feedback';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { AuthLayout } from './LoginPage';
import { parsePendingRecovery, type PendingRecovery } from '../lib/authRecovery';

const PENDING_RECOVERY_KEY = 'kiyo-pending-recovery';

function capturePendingRecovery(): PendingRecovery | null {
  const fromUrl = parsePendingRecovery(window.location.href);
  if (fromUrl) {
    sessionStorage.setItem(PENDING_RECOVERY_KEY, JSON.stringify(fromUrl));
    window.history.replaceState({}, document.title, '/reset-password');
    return fromUrl;
  }

  try {
    const saved = sessionStorage.getItem(PENDING_RECOVERY_KEY);
    if (!saved) return null;
    const parsed = JSON.parse(saved) as PendingRecovery;
    if ((parsed.kind === 'token_hash' || parsed.kind === 'code') && parsed.value) return parsed;
  } catch {
    sessionStorage.removeItem(PENDING_RECOVERY_KEY);
  }
  return null;
}

export default function ResetPasswordPage() {
  const { t } = useT();
  const navigate = useNavigate();

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [recoveryEmail, setRecoveryEmail] = useState('');
  const [recoveryCode, setRecoveryCode] = useState('');
  const [manualRecovery, setManualRecovery] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [pendingRecovery] = useState(capturePendingRecovery);
  const recoveryVerifiedRef = useRef(false);
  const [recoveryState, setRecoveryState] = useState<'checking' | 'ready'>(
    pendingRecovery ? 'ready' : 'checking',
  );

  useEffect(() => {
    let cancelled = false;

    if (pendingRecovery) return undefined;

    const restoreExistingRecoverySession = async () => {
      try {
        const current = await supabase.auth.getSession();
        if (cancelled) return;
        if (current.data.session) {
          setRecoveryState('ready');
          return;
        }
        setManualRecovery(true);
        setRecoveryState('ready');
      } catch (err) {
        console.error('Failed to verify password recovery session', err);
        if (!cancelled) {
          setManualRecovery(true);
          setRecoveryState('ready');
        }
      }
    };

    void restoreExistingRecoverySession();

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
  }, [pendingRecovery]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (submitting) return;

    setLocalError(null);

    if (manualRecovery) {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recoveryEmail.trim())) {
        setLocalError(t('auth.error.invalidEmail'));
        return;
      }
      if (!/^\d{6,8}$/.test(recoveryCode.replace(/\s/g, ''))) {
        setLocalError(t('auth.recoveryCodeInvalid'));
        return;
      }
    }

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
      if (manualRecovery && !recoveryVerifiedRef.current) {
        const verified = await supabase.auth.verifyOtp({
          email: recoveryEmail.trim().toLowerCase(),
          token: recoveryCode.replace(/\s/g, ''),
          type: 'recovery',
        });
        if (verified.error || !verified.data.session) {
          setLocalError(t('auth.recoveryCodeInvalid'));
          return;
        }
        recoveryVerifiedRef.current = true;
      } else if (pendingRecovery?.kind === 'token_hash' && !recoveryVerifiedRef.current) {
        const verified = await supabase.auth.verifyOtp({
          token_hash: pendingRecovery.value,
          type: 'recovery',
        });
        if (verified.error || !verified.data.session) {
          sessionStorage.removeItem(PENDING_RECOVERY_KEY);
          setManualRecovery(true);
          setLocalError(t('auth.recoveryFallback'));
          return;
        }
        recoveryVerifiedRef.current = true;
        sessionStorage.removeItem(PENDING_RECOVERY_KEY);
      } else if (pendingRecovery?.kind === 'code' && !recoveryVerifiedRef.current) {
        const current = await supabase.auth.getSession();
        if (!current.data.session) {
          const exchanged = await supabase.auth.exchangeCodeForSession(pendingRecovery.value);
          if (exchanged.error || !exchanged.data.session) {
            sessionStorage.removeItem(PENDING_RECOVERY_KEY);
            setManualRecovery(true);
            setLocalError(t('auth.recoveryFallback'));
            return;
          }
        }
        recoveryVerifiedRef.current = true;
        sessionStorage.removeItem(PENDING_RECOVERY_KEY);
      }

      const { error } = await supabase.auth.updateUser({
        password,
      });

      if (error) {
        throw error;
      }

      sessionStorage.removeItem(PENDING_RECOVERY_KEY);
      await supabase.auth.signOut({ scope: 'local' });
      setSuccess(true);
    } catch (err) {
      console.error('Failed to update password from recovery session', err);
      setLocalError(t('auth.error.unknown'));
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
          {manualRecovery && (
            <>
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                {t('auth.recoveryFallback')}
              </div>
              <Field
                name="recoveryEmail"
                type="email"
                autoComplete="email"
                inputMode="email"
                label={t('auth.email')}
                value={recoveryEmail}
                onChange={(e) => setRecoveryEmail(e.target.value)}
                icon={<Mail className="h-4 w-4" />}
                placeholder="you@example.com"
                required
              />
              <Field
                name="recoveryCode"
                type="text"
                autoComplete="one-time-code"
                inputMode="numeric"
                label={t('auth.recoveryCode')}
                value={recoveryCode}
                onChange={(e) => setRecoveryCode(e.target.value.replace(/\D/g, '').slice(0, 8))}
                icon={<KeyRound className="h-4 w-4" />}
                placeholder="123456"
                required
              />
              <p className="-mt-2 text-xs text-ink-500">{t('auth.recoveryCodePrompt')}</p>
            </>
          )}

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
