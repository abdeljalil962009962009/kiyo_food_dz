import { Link, useNavigate } from 'react-router-dom';
import { useState, type FormEvent } from 'react';
import { Mail, Lock, AlertCircle, Database, Copy, Check, ExternalLink, Download, X, AlertTriangle } from 'lucide-react';
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
  const [showHelper, setShowHelper] = useState(false);
  const [sqlContent, setSqlContent] = useState<string | null>(null);
  const [loadingSql, setLoadingSql] = useState(false);
  const [copied, setCopied] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [copyError, setCopyError] = useState<string | null>(null);

  const fetchSql = async () => {
    if (sqlContent) return;
    setLoadingSql(true);
    setFetchError(null);
    try {
      const res = await fetch('/supabase_schema.sql');
      if (!res.ok) throw new Error('Failed to load local supabase_schema.sql');
      const text = await res.text();
      setSqlContent(text);
    } catch (err: unknown) {
      console.error(err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch the SQL script.';
      setFetchError(errorMessage);
    } finally {
      setLoadingSql(false);
    }
  };

  const copyToClipboard = async () => {
    if (!sqlContent) return;
    setCopyError(null);
    try {
      await navigator.clipboard.writeText(sqlContent);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Copy failed:', err);
      setCopyError('Failed to copy. Please manually select the SQL text or download the file.');
    }
  };

  const showBanner = typeof window !== 'undefined' && window.location.search.includes('setup=true');

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-2 relative">
      {/* Visual database setup banner at the top of the whole screen */}
      {showBanner && (
        <div className="absolute top-0 left-0 right-0 z-50 bg-amber-500 text-ink-950 text-xs px-4 py-2.5 flex items-center justify-between gap-3 font-medium shadow-sm border-b border-amber-600/20">
          <div className="flex items-center gap-2">
            <Database className="h-4 w-4 text-ink-950 animate-pulse flex-shrink-0" />
            <span>
              <strong>First time setup?</strong> Paste our unified 1-click database schema into Supabase SQL Editor.
            </span>
          </div>
          <button
            type="button"
            onClick={() => {
              setShowHelper(true);
              fetchSql();
            }}
            className="bg-ink-950 text-white rounded px-2.5 py-1 text-[11px] font-bold hover:bg-ink-900 transition-colors flex items-center gap-1.5 whitespace-nowrap"
          >
            <Database className="h-3 w-3" /> Setup Database
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
            Local flavor,<br />delivered.
          </h2>
          <p className="mt-3 max-w-sm text-sm text-ink-200">
            Kiyo connects you with the best restaurants across Algeria — fast, premium, and reliable.
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
                    Supabase Database 1-Click Setup
                  </h3>
                  <p className="text-xs text-ink-500">Initialize your schema to prevent signup and authentication errors</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowHelper(false)}
                className="text-ink-400 hover:text-ink-600 p-1.5 rounded-lg hover:bg-ink-100 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-5">
              <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 flex gap-3 text-sm text-amber-900">
                <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
                <div>
                  <strong className="font-semibold block">Why is this required?</strong>
                  Without database tables, Supabase cannot create user profiles during signup. Pasting the schema below in your Supabase SQL Editor will build all the required tables, triggers, and indices instantly.
                </div>
              </div>

              {/* Steps */}
              <div className="space-y-3">
                <h4 className="font-display font-bold text-sm text-ink-900 uppercase tracking-wider">
                  How to initialize:
                </h4>
                <ol className="list-decimal list-inside text-sm text-ink-700 space-y-2 pl-1">
                  <li>
                    Open your{' '}
                    <a
                      href="https://supabase.com/dashboard"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-ember-600 font-semibold inline-flex items-center gap-1 hover:underline"
                    >
                      Supabase Dashboard <ExternalLink className="h-3 w-3" />
                    </a>
                  </li>
                  <li>Click on the <strong>SQL Editor</strong> tab in the left sidebar (looks like a code icon <code>&gt;_</code>)</li>
                  <li>Click <strong>New Query</strong> at the top</li>
                  <li>Copy the database schema using the button below, paste it into the editor, and click <strong>Run</strong>!</li>
                </ol>
              </div>

              {/* Actions & Code Box */}
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-4">
                  <span className="text-xs font-bold text-ink-500 uppercase tracking-wider">Unified SQL Script (187KB)</span>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={copyToClipboard}
                      disabled={loadingSql || !sqlContent}
                      className="kiyo-btn-primary py-1.5 px-3 text-xs flex items-center gap-1.5"
                    >
                      {copied ? (
                        <>
                          <Check className="h-3.5 w-3.5" /> Copied!
                        </>
                      ) : (
                        <>
                          <Copy className="h-3.5 w-3.5" /> Copy Script
                        </>
                      )}
                    </button>
                    <a
                      href="/supabase_schema.sql"
                      download="supabase_schema.sql"
                      className="kiyo-btn-secondary py-1.5 px-3 text-xs flex items-center gap-1.5"
                    >
                      <Download className="h-3.5 w-3.5" /> Download .sql
                    </a>
                  </div>
                </div>
                {copyError && (
                  <div className="rounded-lg border border-error-200 bg-error-50 px-3 py-2 text-xs text-error-700">
                    {copyError}
                  </div>
                )}

                <div className="relative rounded-xl border border-ink-200 bg-ink-950 p-4 font-mono text-xs text-ink-200 overflow-hidden h-48 flex flex-col justify-between">
                  {loadingSql ? (
                    <div className="absolute inset-0 bg-ink-950/80 flex flex-col items-center justify-center gap-3">
                      <svg className="animate-spin h-6 w-6 text-amber-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      <span className="text-xs text-ink-400">Loading full SQL schema...</span>
                    </div>
                  ) : fetchError ? (
                    <div className="absolute inset-0 bg-ink-950/80 p-4 flex flex-col items-center justify-center gap-2 text-center">
                      <AlertTriangle className="h-6 w-6 text-error-500" />
                      <span className="text-xs text-error-400">{fetchError}</span>
                      <button
                        type="button"
                        onClick={fetchSql}
                        className="text-xs text-amber-500 hover:underline mt-1"
                      >
                        Retry Loading
                      </button>
                    </div>
                  ) : (
                    <>
                      <div className="overflow-y-auto flex-1 pr-2 scrollbar-thin select-all">
                        {sqlContent ? (
                          sqlContent.substring(0, 1500) + '\n\n... [remaining 180+ KB schema content] ...'
                        ) : (
                          '-- Click Load Schema or Download button to fetch content'
                        )}
                      </div>
                      <div className="border-t border-ink-800 pt-2 mt-2 flex items-center justify-between text-[10px] text-ink-400">
                        <span>Includes tables, enums, triggers, and full multi-wilaya setup</span>
                        <span className="font-bold text-amber-500">Fully Optimized</span>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="border-t border-ink-100 px-6 py-4 bg-ink-50 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowHelper(false)}
                className="kiyo-btn-secondary px-4 py-2 text-sm"
              >
                Close
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

function AppleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden>
      <path d="M17.05 20.28c-.98.95-2.05 1.6-3.13 2.01-.94.36-1.94.54-3.01.54-.87 0-1.68-.13-2.44-.4a6.6 6.6 0 0 1-2.02-1.14 8.3 8.3 0 0 1-1.57-1.74C4.12 18.17 3.5 16.5 3.5 14.6c0-1.89.56-3.58 1.67-5.03A8.96 8.96 0 0 1 9.9 6.04c.6-.14 1.22-.21 1.85-.21.66 0 1.3.08 1.92.24.62.16 1.2.4 1.76.72.35.2.66.43.95.68.26.23.5.48.7.75.12-.06.24-.12.37-.18.76-.35 1.57-.52 2.42-.52.34 0 .67.03.99.1.32.06.62.15.9.27.24.1.46.23.66.38.21.15.4.33.57.52.14.16.27.34.38.53.08.14.15.29.21.44l-.02.05c-.05.12-.14.23-.27.31-.15.1-.32.17-.52.23-.18.05-.38.1-.58.14a5.62 5.62 0 0 0-.62.18c-.43.16-.8.38-1.1.67-.3.29-.52.63-.67 1.03-.33.87-.27 1.83.17 2.8.43.93 1.12 1.67 2.04 2.17.29.16.6.29.93.38.33.1.68.15 1.04.17l.06.01.03.05c.02.04.03.1.03.18 0 .08-.01.18-.04.28-.02.1-.06.2-.1.3-.04.1-.09.18-.14.26-.11.17-.25.34-.4.49zm-5.82-15.2c.27-.44.48-.91.63-1.41.15-.5.23-1.01.23-1.53 0-.38-.05-.75-.15-1.11a4.48 4.48 0 0 0-.39-.97 4.45 4.45 0 0 0-.59-.83A4.56 4.56 0 0 0 10.08 0l-.06.01-.01.06c0 .3.04.6.12.9.08.3.2.59.36.87.16.28.36.54.59.78.23.24.5.45.78.62.39.24.71.54.97.89.25.35.44.73.56 1.14l.02.07-.06.02z" fill="currentColor"/>
    </svg>
  );
}
