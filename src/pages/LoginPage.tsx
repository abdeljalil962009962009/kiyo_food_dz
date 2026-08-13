import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useState, type FormEvent } from 'react';
import { Mail, Lock, AlertCircle, Database, Check, ExternalLink, X, AlertTriangle } from 'lucide-react';
import { useAuth, type AuthErrorCode } from '../context/AuthContext';
import { useT } from '../lib/i18n-react';
import { Logo } from '../components/Logo';
import { Field } from '../components/Field';
import { Spinner } from '../components/feedback';
import { ErrorBoundary } from '../components/ErrorBoundary';

const SETUP_COPY = {
  en: {
    setupQuestion: 'Production setup?', setupBanner: 'Configure Vercel variables and apply Supabase migrations in order.',
    setupGuide: 'Setup guide', brandTitle: 'Local flavor, delivered.',
    brandBody: 'Discover trusted local restaurants and follow every order with confidence.',
    guideTitle: 'Production setup guide', guideSubtitle: 'Use versioned migrations and environment variables, never old copied schema snippets.',
    close: 'Close', why: 'Why is this required?',
    whyBody: 'Kiyo Food needs the production Supabase URL, public key, and ordered database migrations before launch. This prevents signup, checkout, owner controls, maps, and delivery rules from using an incomplete database.',
    steps: 'Production steps', openSupabase: 'Open the Supabase dashboard.',
    applyMigrations: 'Apply every file in supabase/migrations in filename order.',
    setVariables: 'Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in Vercel.',
    redeploy: 'Redeploy the main GitHub branch and confirm Vercel shows Ready.',
    ownerRole: 'Create the owner account, then assign super_admin through the protected database workflow.',
    checks: ['Production environment variables are configured.', 'All Supabase migrations are applied in order.', 'RLS policies are enabled and verified.', 'Owner access is granted through database RBAC.'],
    operator: 'Operator checklist', serverIssue: 'This is a server configuration issue, not an incorrect password. Add both URLs below:',
    supabaseRedirect: 'Supabase Auth → URL Configuration → Redirect URLs:', googleRedirect: 'Google Cloud → OAuth client → Authorized redirect URIs:', copy: 'Copy',
  },
  fr: {
    setupQuestion: 'Configuration de production ?', setupBanner: 'Configurez les variables Vercel et appliquez les migrations Supabase dans l’ordre.',
    setupGuide: 'Guide de configuration', brandTitle: 'Les saveurs locales, livrées.',
    brandBody: 'Découvrez des restaurants locaux de confiance et suivez chaque commande en toute sérénité.',
    guideTitle: 'Guide de configuration de production', guideSubtitle: 'Utilisez les migrations versionnées et les variables d’environnement, jamais d’anciens extraits de schéma.',
    close: 'Fermer', why: 'Pourquoi est-ce nécessaire ?',
    whyBody: 'Kiyo Food a besoin de l’URL Supabase de production, de la clé publique et des migrations appliquées dans l’ordre. Cela évite que l’inscription, le paiement, les contrôles propriétaire, les cartes et la livraison utilisent une base incomplète.',
    steps: 'Étapes de production', openSupabase: 'Ouvrir le tableau de bord Supabase.',
    applyMigrations: 'Appliquez chaque fichier de supabase/migrations dans l’ordre des noms.',
    setVariables: 'Ajoutez VITE_SUPABASE_URL et VITE_SUPABASE_ANON_KEY dans Vercel.',
    redeploy: 'Redéployez la branche GitHub main et confirmez que Vercel affiche Ready.',
    ownerRole: 'Créez le compte propriétaire, puis attribuez super_admin via le processus protégé de la base.',
    checks: ['Les variables de production sont configurées.', 'Toutes les migrations Supabase sont appliquées dans l’ordre.', 'Les politiques RLS sont activées et vérifiées.', 'L’accès propriétaire est accordé via le RBAC de la base.'],
    operator: 'Vérification opérateur', serverIssue: 'Il s’agit d’un réglage serveur, pas d’un mot de passe incorrect. Ajoutez les deux URL ci-dessous :',
    supabaseRedirect: 'Supabase Auth → Configuration URL → URL de redirection :', googleRedirect: 'Google Cloud → Client OAuth → URI de redirection autorisés :', copy: 'Copier',
  },
  ar: {
    setupQuestion: 'إعداد بيئة الإنتاج؟', setupBanner: 'اضبط متغيرات Vercel وطبّق ترحيلات Supabase بالترتيب.',
    setupGuide: 'دليل الإعداد', brandTitle: 'نكهات محلية تصل إليك.',
    brandBody: 'اكتشف مطاعم محلية موثوقة وتابع كل طلب بوضوح واطمئنان.',
    guideTitle: 'دليل إعداد بيئة الإنتاج', guideSubtitle: 'استخدم الترحيلات المرقّمة ومتغيرات البيئة، ولا تستخدم نسخًا قديمة من مخطط القاعدة.',
    close: 'إغلاق', why: 'لماذا هذا الإعداد ضروري؟',
    whyBody: 'تحتاج Kiyo Food إلى رابط Supabase ومفتاحه العام وترحيلات قاعدة البيانات المرتبة قبل الإطلاق. يمنع ذلك التسجيل والدفع ولوحة المالك والخرائط والتوصيل من العمل على قاعدة ناقصة.',
    steps: 'خطوات إعداد الإنتاج', openSupabase: 'فتح لوحة تحكم Supabase.',
    applyMigrations: 'طبّق كل ملف داخل supabase/migrations حسب ترتيب اسم الملف.',
    setVariables: 'أضف VITE_SUPABASE_URL وVITE_SUPABASE_ANON_KEY داخل Vercel.',
    redeploy: 'أعد نشر فرع GitHub الرئيسي وتأكد أن Vercel يعرض Ready.',
    ownerRole: 'أنشئ حساب المالك ثم امنحه super_admin عبر المسار المحمي في قاعدة البيانات.',
    checks: ['تم ضبط متغيرات بيئة الإنتاج.', 'تم تطبيق كل ترحيلات Supabase بالترتيب.', 'تم تفعيل سياسات RLS والتحقق منها.', 'تم منح صلاحية المالك عبر نظام الصلاحيات في قاعدة البيانات.'],
    operator: 'قائمة فحص المشغّل', serverIssue: 'هذه مشكلة إعداد في الخادم وليست كلمة مرور خاطئة. أضف الرابطين التاليين:',
    supabaseRedirect: 'Supabase Auth ← إعدادات الروابط ← روابط إعادة التوجيه:', googleRedirect: 'Google Cloud ← عميل OAuth ← روابط إعادة التوجيه المسموح بها:', copy: 'نسخ',
  },
} as const;

export default function LoginPage() {
  const { t } = useT();
  const { signInWithPassword, signInWithGoogle, error } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

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
              to="/forgot-password"
              className="text-xs font-semibold text-ember-600 hover:text-ember-700"
            >
              {t('auth.forgotPassword')}
            </Link>
          </div>

          {shownError && (
            <AuthErrorPanel
              message={shownError}
              code={error?.code}
              onCopyStateChange={() => { /* tracking hook for future telemetry */ }}
            />
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

      <p className="mt-6 text-center text-sm text-ink-500">
        {t('auth.noAccount')}{' '}
        <Link to="/signup" state={location.state} className="font-semibold text-ember-600 hover:text-ember-700">
          {t('auth.signup')}
        </Link>
      </p>
    </AuthLayout>
  );
}

// Shared split-screen layout for auth pages.
export function AuthLayout({ children }: { children: React.ReactNode }) {
  const { locale } = useT();
  const tx = SETUP_COPY[locale];
  const [showHelper, setShowHelper] = useState(false);

  const showBanner = typeof window !== 'undefined' && window.location.search.includes('setup=true');

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-2 relative">
      {/* Visual database setup banner at the top of the whole screen */}
      {showBanner && (
        <div className="absolute inset-x-0 top-0 z-50 bg-amber-500 text-ink-950 text-xs px-4 py-2.5 flex items-center justify-between gap-3 font-medium shadow-sm border-b border-amber-600/20">
          <div className="flex items-center gap-2">
            <Database className="h-4 w-4 text-ink-950 animate-pulse flex-shrink-0" />
            <span>
              <strong>{tx.setupQuestion}</strong> {tx.setupBanner}
            </span>
          </div>
          <button
            type="button"
            onClick={() => setShowHelper(true)}
            className="bg-ink-950 text-white rounded px-2.5 py-1 text-[11px] font-bold hover:bg-ink-900 transition-colors flex items-center gap-1.5 whitespace-nowrap"
          >
            <Database className="h-3 w-3" /> {tx.setupGuide}
          </button>
        </div>
      )}

      {/* Brand panel */}
      <aside className={`relative hidden overflow-hidden bg-ink-900 lg:flex lg:flex-col lg:justify-between lg:p-12 ${showBanner ? 'pt-20' : ''}`}>
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
            {tx.brandTitle}
          </h2>
          <p className="mt-3 max-w-sm text-sm text-ink-200">
            {tx.brandBody}
          </p>
        </div>
        <div className="relative text-xs text-ink-400">© {new Date().getFullYear()} Kiyo</div>
      </aside>

      {/* Form panel */}
      <main className={`flex min-h-screen items-center justify-center bg-ink-50 px-4 py-16 sm:px-8 ${showBanner ? 'pt-20' : ''}`}>
        <div className="w-full max-w-sm">{children}</div>
      </main>

      {/* Database Setup Helper Modal */}
      {showHelper && (
        <div className="fixed inset-0 z-[100] bg-ink-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[85vh] overflow-hidden flex flex-col shadow-2xl border border-ink-100">
            {/* Header */}
            <div className="border-b border-ink-100 px-6 py-4 flex items-center justify-between bg-ink-50">
              <div className="flex items-center gap-2.5">
                <div className="h-9 w-9 rounded-lg bg-amber-500/10 text-amber-600 flex items-center justify-center">
                  <Database className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-display font-extrabold text-ink-900 text-lg">
                    {tx.guideTitle}
                  </h3>
                  <p className="text-xs text-ink-500">{tx.guideSubtitle}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowHelper(false)}
                className="text-ink-400 hover:text-ink-600 p-1.5 rounded-lg hover:bg-ink-100 transition-colors"
                aria-label={tx.close}
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-5">
              <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 flex gap-3 text-sm text-amber-900">
                <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
                <div>
                  <strong className="font-semibold block">{tx.why}</strong>
                  {tx.whyBody}
                </div>
              </div>

              {/* Steps */}
              <div className="space-y-3">
                <h4 className="font-display font-bold text-sm text-ink-900 uppercase tracking-wider">
                  {tx.steps}:
                </h4>
                <ol className="list-decimal list-inside text-sm text-ink-700 space-y-2 ps-1">
                  <li>
                    Open your{' '}
                    <a
                      href="https://supabase.com/dashboard"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-ember-600 font-semibold inline-flex items-center gap-1 hover:underline"
                    >
                      {tx.openSupabase} <ExternalLink className="h-3 w-3" />
                    </a>
                  </li>
                  <li>{tx.applyMigrations}</li>
                  <li>{tx.setVariables}</li>
                  <li>{tx.redeploy}</li>
                  <li>{tx.ownerRole}</li>
                </ol>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                {tx.checks.map((item) => (
                  <div key={item} className="flex gap-2 rounded-xl border border-ink-100 bg-ink-50 px-3 py-2 text-xs text-ink-700">
                    <Check className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-sage-600" />
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Footer */}
            <div className="border-t border-ink-100 px-6 py-4 bg-ink-50 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowHelper(false)}
                className="kiyo-btn-secondary px-4 py-2 text-sm"
              >
                {tx.close}
              </button>
            </div>
          </div>
        </div>
      )}
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

// Surface actionable setup hints when the failure is a configuration
// problem on the operator side (missing OAuth provider, missing redirect
// URI in Google Cloud, etc.). For ordinary user errors this is a
// plain message; for setup errors it shows the exact URLs to add.
type AuthCode = AuthErrorCode;

function AuthErrorPanel({
  message,
  code,
  onCopyStateChange,
}: {
  message: string;
  code?: AuthCode;
  onCopyStateChange?: () => void;
}) {
  const { locale } = useT();
  const tx = SETUP_COPY[locale];
  const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim() ?? '';
  const supabaseCallback = supabaseUrl ? `${supabaseUrl.replace(/\/+$/, '')}/auth/v1/callback` : '';

  const isSetupIssue = code === 'invalidRedirect' || code === 'providerNotEnabled';

  if (!isSetupIssue) {
    return (
      <div className="flex items-start gap-2 rounded-lg bg-error-500/10 px-3 py-2.5 text-xs text-error-600" role="alert">
        <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
        <span className="font-medium">{message}</span>
      </div>
    );
  }

  const copy = async (text: string) => {
    if (!text) return;
    try {
      await navigator.clipboard?.writeText(text);
      onCopyStateChange?.();
    } catch {
      /* clipboard unavailable; user can still read the value */
    }
  };

  return (
    <div className="space-y-2" role="alert">
      <div className="flex items-start gap-2 rounded-lg bg-error-500/10 px-3 py-2.5 text-xs text-error-600">
        <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
        <span className="font-medium">{message}</span>
      </div>
      <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900 space-y-2">
        <p className="font-semibold">{tx.operator}</p>
        <p>{tx.serverIssue}</p>
        <div>
          <p className="font-mono text-[11px] text-amber-700">{tx.supabaseRedirect}</p>
          <div className="mt-1 flex items-start gap-2">
            <code className="flex-1 break-all rounded bg-white px-2 py-1 text-[11px] ring-1 ring-amber-200">
              {window.location.origin}/auth/callback
            </code>
            <button type="button" onClick={() => copy(`${window.location.origin}/auth/callback`)} className="min-h-11 rounded bg-amber-600 px-3 py-1 text-[10px] font-bold text-white hover:bg-amber-700">{tx.copy}</button>
          </div>
        </div>
        {supabaseCallback && (
          <div>
            <p className="font-mono text-[11px] text-amber-700">{tx.googleRedirect}</p>
            <div className="mt-1 flex items-start gap-2">
              <code className="flex-1 break-all rounded bg-white px-2 py-1 text-[11px] ring-1 ring-amber-200">
                {supabaseCallback}
              </code>
              <button type="button" onClick={() => copy(supabaseCallback)} className="min-h-11 rounded bg-amber-600 px-3 py-1 text-[10px] font-bold text-white hover:bg-amber-700">{tx.copy}</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
