import { useState, type FormEvent } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { Phone, ShieldCheck } from 'lucide-react';
import { AuthLayout } from './LoginPage';
import { Field } from '../components/Field';
import { Spinner } from '../components/feedback';
import { useAuth } from '../context/AuthContext';
import { useT } from '../lib/i18n-react';
import { isValidAlgerianPhone } from '../lib/phone';

export default function CompleteGoogleProfilePage() {
  const { t } = useT();
  const {
    state,
    user,
    profile,
    needsPhoneCompletion,
    completeGooglePhone,
    signOut,
    error,
  } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [phone, setPhone] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  if (state === 'unauthenticated') return <Navigate to="/login" replace />;
  if (state === 'authenticated' && profile && !needsPhoneCompletion) {
    return <Navigate to="/dashboard" replace />;
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (submitting) return;
    setLocalError(null);
    if (!isValidAlgerianPhone(phone)) {
      setLocalError(t('auth.error.invalidPhone'));
      return;
    }

    setSubmitting(true);
    const result = await completeGooglePhone(phone);
    setSubmitting(false);
    if (!result.ok) return;

    const from = (location.state as { from?: { pathname?: string } } | null)?.from?.pathname;
    navigate(from && from !== '/complete-profile' ? from : '/dashboard', { replace: true });
  };

  const logout = async () => {
    await signOut();
    navigate('/login', { replace: true });
  };

  return (
    <AuthLayout>
      <div className="text-center">
        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-ember-50 text-ember-600">
          <Phone className="h-6 w-6" aria-hidden />
        </span>
        <h1 className="mt-4 font-display text-2xl font-extrabold text-ink-900">
          {t('auth.completePhoneTitle')}
        </h1>
        <p className="mt-2 text-sm leading-6 text-ink-500">
          {t('auth.completePhoneBody')}
        </p>
        {user?.email && <p className="mt-2 text-xs font-semibold text-ink-600">{user.email}</p>}
      </div>

      <form onSubmit={submit} className="mt-7 space-y-4" noValidate>
        <Field
          name="google-phone"
          type="tel"
          autoComplete="tel"
          inputMode="tel"
          label={t('auth.phone')}
          value={phone}
          onChange={(event) => setPhone(event.target.value)}
          icon={<Phone className="h-4 w-4" />}
          placeholder="0550 12 34 56"
          error={phone && !isValidAlgerianPhone(phone) ? t('auth.error.invalidPhone') : null}
          required
        />

        <div className="flex items-start gap-2 rounded-lg bg-ink-50 px-3 py-3 text-xs leading-5 text-ink-600">
          <ShieldCheck className="mt-0.5 h-4 w-4 flex-none text-success-600" aria-hidden />
          <span>{t('auth.completePhonePrivacy')}</span>
        </div>

        {(localError || error?.message) && (
          <p className="rounded-lg bg-error-500/10 px-3 py-2.5 text-xs font-semibold text-error-600" role="alert">
            {localError ?? error?.message}
          </p>
        )}

        <button type="submit" disabled={submitting} className="kiyo-btn-primary w-full">
          {submitting ? <Spinner className="h-4 w-4" /> : null}
          {submitting ? t('auth.completePhoneSaving') : t('auth.completePhoneAction')}
        </button>
      </form>

      <button type="button" onClick={logout} className="mt-3 min-h-11 w-full text-sm font-semibold text-ink-500 hover:text-ink-800">
        {t('auth.completePhoneDifferentAccount')}
      </button>
    </AuthLayout>
  );
}
