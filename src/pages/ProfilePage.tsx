import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  LogOut, Mail, Phone, User as UserIcon, Globe, Shield,
  Download, Trash2, AlertTriangle, X, FileText,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useT } from '../lib/i18n-react';
import { supabase } from '../lib/supabase';
import { AppShell } from '../components/AppShell';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { Spinner } from '../components/feedback';
import { Link } from 'react-router-dom';

export default function ProfilePage() {
  const { t } = useT();
  const { profile, signOut, locale, setLocale } = useAuth();
  const navigate = useNavigate();
  const [savingLang, setSavingLang] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportMsg, setExportMsg] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [confirmText, setConfirmText] = useState('');

  const updateLang = async (lang: 'en' | 'fr' | 'ar') => {
    if (!profile || profile.preferred_language === lang) return;
    setSavingLang(true);
    setLocale(lang);
    try {
      await supabase.from('profiles').update({ preferred_language: lang }).eq('id', profile.id);
    } finally {
      setSavingLang(false);
    }
  };

  const logout = async () => {
    await signOut();
    navigate('/login', { replace: true });
  };

  const exportData = async () => {
    if (!profile || exporting) return;
    setExporting(true);
    setExportMsg(null);
    try {
      // Mark the export request server-side (audit log + timestamp).
      await supabase.rpc('request_personal_data_export');

      const [ordersRes, addressesRes] = await Promise.all([
        supabase.from('orders').select('*').eq('customer_id', profile.id).order('created_at', { ascending: false }),
        // Phase 4: no addresses table yet — empty array placeholder
        Promise.resolve({ data: [], error: null }),
      ]);
      void addressesRes;

      const exportData = {
        exported_at: new Date().toISOString(),
        platform: 'Kiyo',
        account: {
          id: profile.id,
          email: profile.email,
          full_name: profile.full_name,
          phone: profile.phone,
          role: profile.role,
          preferred_language: profile.preferred_language,
          created_at: profile.created_at,
        },
        orders: ordersRes.data ?? [],
        addresses: [],
      };

      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `kiyo-personal-data-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setExportMsg('Export downloaded.');
    } catch {
      setExportMsg('Export failed. Please try again.');
    } finally {
      setExporting(false);
    }
  };

  const requestDeletion = async () => {
    if (!profile || deleting) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      const { error } = await supabase.rpc('request_account_deletion');
      if (error) {
        if (error.message.includes('cannot_delete_active_restaurant_owner')) {
          setDeleteError(
            'Your account owns an active restaurant. Please contact Kiyo support to transfer ownership or close the restaurant first.',
          );
        } else {
          setDeleteError('Could not delete your account. Please try again.');
        }
        return;
      }
      await signOut();
      navigate('/login', { replace: true });
    } catch {
      setDeleteError('Could not delete your account. Please try again.');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <AppShell>
      <h1 className="mb-6 font-display text-2xl font-extrabold tracking-tight text-ink-900">
        {t('nav.profile')}
      </h1>

      <ErrorBoundary variant="inline">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="kiyo-card p-5">
            <h2 className="mb-4 font-display text-base font-bold text-ink-900">
              {t('dash.accountInfo')}
            </h2>
            <div className="space-y-3">
              <Row icon={UserIcon} label={t('auth.fullName')} value={profile?.full_name ?? '—'} />
              <Row icon={Mail} label={t('auth.email')} value={profile?.email ?? '—'} />
              <Row icon={Phone} label="Phone" value={profile?.phone ?? '—'} />
              <Row icon={Shield} label={t('dash.role')} value={(profile?.role ?? 'customer').replace('_', ' ')} />
            </div>
          </div>

          <div className="kiyo-card p-5">
            <h2 className="mb-4 font-display text-base font-bold text-ink-900">
              <Globe className="mr-1.5 inline h-4 w-4" />
              Language
            </h2>
            <div className="space-y-2">
              {([
                { code: 'en', label: 'English' },
                { code: 'fr', label: 'Français' },
                { code: 'ar', label: 'العربية' },
              ] as const).map((l) => {
                const active = locale === l.code;
                return (
                  <button
                    key={l.code}
                    onClick={() => updateLang(l.code)}
                    disabled={savingLang}
                    className={`flex w-full items-center justify-between rounded-xl border px-3 py-2.5 text-sm transition-all ${
                      active
                        ? 'border-ember-500 bg-ember-50 text-ink-900'
                        : 'border-ink-200 text-ink-700 hover:border-ink-300'
                    }`}
                  >
                    {l.label}
                    {savingLang && active && <Spinner className="h-3.5 w-3.5" />}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Privacy & Data section */}
        <div className="kiyo-card mt-6 p-5">
          <h2 className="mb-1 font-display text-base font-bold text-ink-900">
            <Shield className="mr-1.5 inline h-4 w-4" />
            Privacy & Data
          </h2>
          <p className="mb-4 text-xs text-ink-500">
            Your data, your control. Export or delete your personal data in compliance with our{' '}
            <Link to="/legal/account-deletion" className="underline">Account Deletion Policy</Link>.
          </p>

          <div className="grid gap-3 sm:grid-cols-2">
            <button
              onClick={exportData}
              disabled={exporting}
              className="flex items-center gap-2 rounded-xl border border-ink-200 px-4 py-3 text-left text-sm transition-colors hover:bg-ink-50"
            >
              {exporting ? <Spinner className="h-4 w-4" /> : <Download className="h-4 w-4 text-ember-500" />}
              <div className="flex-1">
                <div className="font-semibold text-ink-900">Export my data</div>
                <div className="text-xs text-ink-400">Download as JSON</div>
              </div>
            </button>

            <button
              onClick={() => setShowDeleteModal(true)}
              className="flex items-center gap-2 rounded-xl border border-error-500/30 px-4 py-3 text-left text-sm transition-colors hover:bg-error-500/10"
            >
              <Trash2 className="h-4 w-4 text-error-600" />
              <div className="flex-1">
                <div className="font-semibold text-error-600">Delete my account</div>
                <div className="text-xs text-error-600/70">Permanent after 14 days</div>
              </div>
            </button>
          </div>

          {exportMsg && (
            <p className="mt-3 text-xs text-ink-500">{exportMsg}</p>
          )}

          <div className="mt-4 flex flex-wrap gap-3 border-t border-ink-100 pt-3 text-xs">
            <Link to="/legal/privacy" className="inline-flex items-center gap-1 text-ink-500 hover:text-ink-900">
              <FileText className="h-3 w-3" /> Privacy Policy
            </Link>
            <Link to="/legal/cookies" className="inline-flex items-center gap-1 text-ink-500 hover:text-ink-900">
              <FileText className="h-3 w-3" /> Cookie Policy
            </Link>
            <Link to="/legal/refund" className="inline-flex items-center gap-1 text-ink-500 hover:text-ink-900">
              <FileText className="h-3 w-3" /> Refund & Cancellation
            </Link>
          </div>
        </div>

        <button onClick={logout} className="kiyo-btn-secondary mt-6">
          <LogOut className="h-4 w-4" />
          {t('auth.logout')}
        </button>
      </ErrorBoundary>

      {/* Delete account confirmation modal */}
      {showDeleteModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => !deleting && setShowDeleteModal(false)}
        >
          <div
            className="w-full max-w-md rounded-2xl bg-white p-5 shadow-card-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-start justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-error-600" />
                <h3 className="font-display text-lg font-bold text-ink-900">Delete account</h3>
              </div>
              <button
                onClick={() => !deleting && setShowDeleteModal(false)}
                className="rounded p-1 text-ink-400 hover:bg-ink-100"
                aria-label="close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-3 text-sm text-ink-600">
              <p>
                This will <strong>immediately sign you out</strong> and lock your account.
                Your profile, favorites, and saved data will be deleted within 14 days.
              </p>
              <p>
                Order and financial records are retained for 7 years as required by
                tax law — but they will be anonymized and no longer linked to your identity.
              </p>
              <div className="rounded-lg bg-error-500/10 px-3 py-2 text-xs text-error-600">
                Restaurant owner accounts with an active restaurant cannot self-delete.
                Contact support instead.
              </div>
              <div>
                <label className="kiyo-label" htmlFor="confirm-delete">
                  Type <strong>DELETE</strong> to confirm
                </label>
                <input
                  id="confirm-delete"
                  className="kiyo-input"
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  disabled={deleting}
                  placeholder="DELETE"
                  autoComplete="off"
                />
              </div>
            </div>

            {deleteError && (
              <p className="mt-3 text-xs text-error-600">{deleteError}</p>
            )}

            <div className="mt-4 flex gap-2">
              <button
                onClick={() => setShowDeleteModal(false)}
                disabled={deleting}
                className="kiyo-btn-secondary flex-1"
              >
                Cancel
              </button>
              <button
                onClick={requestDeletion}
                disabled={deleting || confirmText !== 'DELETE'}
                className="kiyo-btn-primary flex-1 bg-error-600 hover:bg-error-700"
              >
                {deleting ? (
                  <>
                    <Spinner className="h-4 w-4" /> Deleting…
                  </>
                ) : (
                  <>
                    <Trash2 className="h-4 w-4" /> Delete forever
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}

function Row({ icon: Icon, label, value }: {
  icon: React.ElementType; label: string; value: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-ink-100 pb-3 last:border-0 last:pb-0">
      <span className="flex items-center gap-2 text-xs font-medium text-ink-400">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </span>
      <span className="max-w-[60%] truncate text-sm font-medium text-ink-900">{value}</span>
    </div>
  );
}
