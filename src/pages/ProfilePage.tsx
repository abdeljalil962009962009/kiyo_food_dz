import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  LogOut, Mail, Phone, User as UserIcon, Globe, Shield,
  Download, Trash2, AlertTriangle, X, FileText, MapPin,
  Award, Star, TrendingUp,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useT } from '../lib/i18n-react';
import { supabase } from '../lib/supabase';
import { AppShell } from '../components/AppShell';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { Spinner } from '../components/feedback';
import { AddressManager } from '../components/AddressManager';
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

  // Loyalty state
  const [loyalty, setLoyalty] = useState<{
    points: number;
    lifetime_points: number;
    tier: string;
  } | null>(null);

  useEffect(() => {
    if (!profile || profile.role !== 'customer') return;
    supabase
      .from('loyalty_points')
      .select('points, lifetime_points, tier')
      .eq('customer_id', profile.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data) setLoyalty(data);
      });
  }, [profile]);

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
        supabase.from('saved_addresses').select('*').eq('customer_id', profile.id),
      ]);

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
        addresses: addressesRes.data ?? [],
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
      setExportMsg(t('profile.privacy.exportSuccess'));
    } catch {
      setExportMsg(t('profile.privacy.exportFailed'));
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
            t('profile.deleteModal.warn'),
          );
        } else {
          setDeleteError(t('error.genericBody'));
        }
        return;
      }
      await signOut();
      navigate('/login', { replace: true });
    } catch {
      setDeleteError(t('error.genericBody'));
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
        {/* Loyalty Points - Customer only */}
        {profile?.role === 'customer' && (
          <div className="mb-4 kiyo-card border-l-4 border-l-amber-500 bg-gradient-to-r from-amber-50 to-white p-5">
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <Award className="h-5 w-5 text-amber-500" />
                  <h2 className="font-display text-base font-bold text-ink-900">
                    {t('profile.loyalty.title')}
                  </h2>
                </div>
                <p className="mt-1 text-xs text-ink-500">
                  {t('profile.loyalty.subtitle')}
                </p>
              </div>
              <div className={`rounded-full px-3 py-1 text-xs font-bold uppercase ${
                loyalty?.tier === 'platinum' ? 'bg-slate-200 text-slate-700' :
                loyalty?.tier === 'gold' ? 'bg-amber-200 text-amber-800' :
                loyalty?.tier === 'silver' ? 'bg-gray-200 text-gray-700' :
                'bg-orange-200 text-orange-800'
              }`}>
                {loyalty?.tier ?? 'bronze'}
              </div>
            </div>
            <div className="mt-4 grid grid-cols-3 gap-4">
              <div>
                <div className="flex items-center gap-1 text-xs text-ink-400">
                  <Star className="h-3 w-3" /> {t('profile.loyalty.currentPoints')}
                </div>
                <div className="mt-1 font-display text-xl font-bold text-ink-900">
                  {loyalty?.points?.toLocaleString() ?? 0}
                </div>
              </div>
              <div>
                <div className="flex items-center gap-1 text-xs text-ink-400">
                  <TrendingUp className="h-3 w-3" /> {t('profile.loyalty.lifetimePoints')}
                </div>
                <div className="mt-1 font-display text-xl font-bold text-ink-900">
                  {loyalty?.lifetime_points?.toLocaleString() ?? 0}
                </div>
              </div>
              <div>
                <div className="text-xs text-ink-400">{t('profile.loyalty.nextTier')}</div>
                <div className="mt-1 text-sm font-semibold text-ink-700">
                  {(loyalty?.tier === 'bronze' && '500 pts to Silver') ||
                   (loyalty?.tier === 'silver' && '1500 pts to Gold') ||
                   (loyalty?.tier === 'gold' && '5000 pts to Platinum') ||
                   t('profile.loyalty.maxTier')}
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="kiyo-card p-5">
            <h2 className="mb-4 font-display text-base font-bold text-ink-900">
              {t('dash.accountInfo')}
            </h2>
            <div className="space-y-3">
              <Row icon={UserIcon} label={t('auth.fullName')} value={profile?.full_name ?? '—'} />
              <Row icon={Mail} label={t('auth.email')} value={profile?.email ?? '—'} />
              <Row icon={Phone} label={t('profile.phone')} value={profile?.phone ?? '—'} />
              <Row icon={Shield} label={t('dash.role')} value={t(`role.${profile?.role}` as any)} />
            </div>
          </div>

          <div className="kiyo-card p-5">
            <h2 className="mb-4 font-display text-base font-bold text-ink-900">
              <Globe className="mr-1.5 inline h-4 w-4" />
              {t('profile.language')}
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

        {/* Saved Addresses */}
        <div className="kiyo-card mt-6 p-5">
          <h2 className="mb-4 font-display text-base font-bold text-ink-900">
            <MapPin className="mr-1.5 inline h-4 w-4" />
            {t('profile.addresses.title')}
          </h2>
          <AddressManager />
        </div>

        {/* Privacy & Data section */}
        <div className="kiyo-card mt-6 p-5">
          <h2 className="mb-1 font-display text-base font-bold text-ink-900">
            <Shield className="mr-1.5 inline h-4 w-4" />
            {t('profile.privacy.title')}
          </h2>
          <p className="mb-4 text-xs text-ink-500">
            {t('profile.privacy.subtitle')}
          </p>

          <div className="grid gap-3 sm:grid-cols-2">
            <button
              onClick={exportData}
              disabled={exporting}
              className="flex items-center gap-2 rounded-xl border border-ink-200 px-4 py-3 text-left text-sm transition-colors hover:bg-ink-50"
            >
              {exporting ? <Spinner className="h-4 w-4" /> : <Download className="h-4 w-4 text-ember-500" />}
              <div className="flex-1">
                <div className="font-semibold text-ink-900">{t('profile.privacy.export')}</div>
                <div className="text-xs text-ink-400">{t('profile.privacy.exportDesc')}</div>
              </div>
            </button>

            <button
              onClick={() => setShowDeleteModal(true)}
              className="flex items-center gap-2 rounded-xl border border-error-500/30 px-4 py-3 text-left text-sm transition-colors hover:bg-error-500/10"
            >
              <Trash2 className="h-4 w-4 text-error-600" />
              <div className="flex-1">
                <div className="font-semibold text-error-600">{t('profile.privacy.delete')}</div>
                <div className="text-xs text-error-600/70">{t('profile.privacy.deleteDesc')}</div>
              </div>
            </button>
          </div>

          {exportMsg && (
            <p className="mt-3 text-xs text-ink-500">{exportMsg}</p>
          )}

          <div className="mt-4 flex flex-wrap gap-3 border-t border-ink-100 pt-3 text-xs">
            <Link to="/legal/privacy" className="inline-flex items-center gap-1 text-ink-500 hover:text-ink-900">
              <FileText className="h-3 w-3" /> {t('profile.privacy.policy')}
            </Link>
            <Link to="/legal/cookies" className="inline-flex items-center gap-1 text-ink-500 hover:text-ink-900">
              <FileText className="h-3 w-3" /> {t('profile.privacy.cookie')}
            </Link>
            <Link to="/legal/refund" className="inline-flex items-center gap-1 text-ink-500 hover:text-ink-900">
              <FileText className="h-3 w-3" /> {t('profile.privacy.refund')}
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
                <h3 className="font-display text-lg font-bold text-ink-900">{t('profile.deleteModal.title')}</h3>
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
                {t('profile.deleteModal.body1')}
              </p>
              <p>
                {t('profile.deleteModal.body2')}
              </p>
              <div className="rounded-lg bg-error-500/10 px-3 py-2 text-xs text-error-600">
                {t('profile.deleteModal.warn')}
              </div>
              <div>
                <label className="kiyo-label" htmlFor="confirm-delete">
                  {t('profile.deleteModal.confirmText')}
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
                {t('common.cancel')}
              </button>
              <button
                onClick={requestDeletion}
                disabled={deleting || confirmText !== 'DELETE'}
                className="kiyo-btn-primary flex-1 bg-error-600 hover:bg-error-700"
              >
                {deleting ? (
                  <>
                    <Spinner className="h-4 w-4" /> {t('profile.deleteModal.deleting')}
                  </>
                ) : (
                  <>
                    <Trash2 className="h-4 w-4" /> {t('profile.deleteModal.deleteForever')}
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
