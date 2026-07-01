import { Link, useNavigate } from 'react-router-dom';
import { useState, type FormEvent } from 'react';
import { Mail, AlertCircle, ChevronLeft, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useT } from '../lib/i18n-react';
import { Logo } from '../components/Logo';
import { Field } from '../components/Field';
import { Spinner } from '../components/feedback';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { AuthLayout } from './LoginPage';

export default function ForgotPasswordPage() {
  const { t } = useT();
  const { resetPassword, error } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setLocalError(null);
    const ok = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    if (!ok) return setLocalError(t('auth.error.invalidEmail'));

    setSubmitting(true);
    const { ok: success } = await resetPassword(email.trim());
    setSubmitting(false);
    if (success) setSent(true);
  };

  const shownError = localError ?? (error ? error.message : null);

  if (sent) {
    return (
      <AuthLayout>
        <div className="mb-6 flex justify-center">
          <Logo size={48} withText={false} />
        </div>
        <div className="rounded-2xl border border-sage-200 bg-sage-50 p-6 text-center">
          <CheckCircle2 className="mx-auto h-10 w-10 text-sage-500" />
          <h2 className="mt-3 font-display text-lg font-bold text-ink-900">
            {t('auth.resetPassword')}
          </h2>
          <p className="mt-1 text-sm text-ink-600">{t('auth.checkEmailReset')}</p>
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
      <div className="mb-6">
        <Link
          to="/login"
          className="inline-flex items-center gap-1 text-xs font-semibold text-ink-500 hover:text-ink-900"
        >
          <ChevronLeft className="h-4 w-4" />
          {t('auth.backToLogin')}
        </Link>
      </div>
      <div className="mb-8 text-center">
        <Logo size={48} withText={false} />
        <h1 className="mt-4 font-display text-2xl font-extrabold tracking-tight text-ink-900">
          {t('auth.resetPassword')}
        </h1>
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
                {t('auth.sendingReset')}
              </>
            ) : t('auth.resetPasswordCta')}
          </button>
        </form>
      </ErrorBoundary>
    </AuthLayout>
  );
}
