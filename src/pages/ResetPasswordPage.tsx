import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, AlertCircle, CheckCircle2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useT } from '../lib/i18n-react';
import { Logo } from '../components/Logo';
import { Field } from '../components/Field';
import { Spinner } from '../components/feedback';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { AuthLayout } from './LoginPage';

export default function ResetPasswordPage() {
  const { t } = useT();
  const navigate = useNavigate();

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (submitting) return;

    setLocalError(null);

    // Basic password validation
    if (password.length < 6) {
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
      const message = err instanceof Error ? err.message : 'An error occurred while resetting your password.';
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
