import { Link, useNavigate } from 'react-router-dom';
import { useState, type FormEvent } from 'react';
import { Mail, Lock, User as UserIcon, AlertCircle, Store, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useT } from '../lib/i18n-react';
import { Logo } from '../components/Logo';
import { Field } from '../components/Field';
import { Spinner } from '../components/feedback';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { AuthLayout } from './LoginPage';

export default function SignupPage() {
  const { t } = useT();
  const { signUp, error } = useAuth();
  const navigate = useNavigate();

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [needsEmailConfirmation, setNeedsEmailConfirmation] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setLocalError(null);

    const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    if (!emailOk) return setLocalError(t('auth.error.invalidEmail'));
    if (password.length < 8) return setLocalError(t('auth.error.weakPassword'));
    if (password !== confirm) return setLocalError(t('auth.error.passwordMismatch'));
    if (!acceptTerms) return setLocalError(t('auth.error.acceptTerms'));

    setSubmitting(true);
    const { ok, needsEmailConfirmation: shouldConfirmEmail } = await signUp(email.trim(), password, fullName.trim());
    setSubmitting(false);
    if (ok) {
      if (shouldConfirmEmail) {
        setNeedsEmailConfirmation(true);
        return;
      }
      navigate('/dashboard', { replace: true });
    }
  };

  const shownError = localError ?? (error ? error.message : null);

  return (
    <AuthLayout>
      <div className="mb-8 text-center">
        <Logo size={48} withText={false} />
        <h1 className="mt-4 font-display text-2xl font-extrabold tracking-tight text-ink-900">
          {t('auth.signup')}
        </h1>
        <p className="mt-1 text-sm text-ink-500">{t('brand.tagline')}</p>
      </div>

      {needsEmailConfirmation ? (
        <div className="rounded-2xl border border-sage-200 bg-sage-50 p-6 text-center">
          <CheckCircle2 className="mx-auto h-10 w-10 text-sage-500" />
          <h2 className="mt-3 font-display text-lg font-bold text-ink-900">
            {t('auth.signupCheckEmailTitle')}
          </h2>
          <p className="mt-1 text-sm text-ink-600">{t('auth.signupCheckEmailBody')}</p>
          <button
            onClick={() => navigate('/login', { replace: true })}
            className="kiyo-btn-primary mt-5 w-full"
          >
            {t('auth.backToLogin')}
          </button>
        </div>
      ) : (
        <ErrorBoundary variant="inline">
          <form onSubmit={submit} className="space-y-4" noValidate>
          <Field
            name="fullName"
            type="text"
            autoComplete="name"
            label={t('auth.fullName')}
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            icon={<UserIcon className="h-4 w-4" />}
            required
          />
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
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            icon={<Lock className="h-4 w-4" />}
            placeholder="••••••••"
            required
          />

          <div className="rounded-xl border border-ember-100 bg-ember-50/60 px-3 py-3 text-xs text-ink-700">
            <div className="flex gap-2">
              <Store className="mt-0.5 h-4 w-4 flex-shrink-0 text-ember-600" />
              <div>
                <p className="font-semibold text-ink-900">{t('auth.restaurantAccessTitle')}</p>
                <p className="mt-1">{t('auth.restaurantAccessBody')}</p>
              </div>
            </div>
          </div>

          <label className="flex items-start gap-2 text-xs text-ink-600">
            <input
              type="checkbox"
              checked={acceptTerms}
              onChange={(e) => setAcceptTerms(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-ink-300 text-ember-600 focus:ring-ember-500"
            />
            <span>
              {t('auth.acceptTerms')}{' '}
              <Link to="/legal/terms" className="font-semibold text-ember-600 hover:underline">
                {t('auth.termsLink')}
              </Link>{' '}
              &amp;{' '}
              <Link to="/legal/privacy" className="font-semibold text-ember-600 hover:underline">
                {t('auth.privacyLink')}
              </Link>
              .
            </span>
          </label>

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
                {t('auth.signingUp')}
              </>
            ) : t('auth.createAccount')}
          </button>
          </form>
        </ErrorBoundary>
      )}

      <p className="mt-6 text-center text-sm text-ink-500">
        {t('auth.haveAccount')}{' '}
        <Link to="/login" className="font-semibold text-ember-600 hover:text-ember-700">
          {t('auth.login')}
        </Link>
      </p>
    </AuthLayout>
  );
}
