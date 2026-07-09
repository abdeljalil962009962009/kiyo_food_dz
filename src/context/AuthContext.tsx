import {
  createContext, useContext, useEffect, useMemo, useRef, useState, useCallback,
  type ReactNode,
} from 'react';
import type { Session, User, SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { getAuthRedirectUrl } from '../lib/siteUrl';
import { translate, type Locale, type TranslationKey } from '../lib/i18n';
import type { Profile } from '../lib/supabase';

// ----- Auth error mapping -----
export type AuthErrorCode =
  | 'invalidCredentials' | 'emailTaken' | 'weakPassword'
  | 'tooManyAttempts' | 'network' | 'timeout' | 'unknown'
  | 'passwordMismatch' | 'acceptTerms' | 'invalidEmail' | 'emailNotConfirmed'
  | 'providerNotEnabled' | 'invalidRedirect';

function mapSupabaseError(err: unknown): AuthErrorCode {
  const code = (err as { code?: string })?.code;
  const msg = (err as { message?: string })?.message ?? '';
  const lc = msg.toLowerCase();
  // OAuth provider not configured in Supabase.
  if (code === 'validation_failed' && lc.includes('provider is not enabled')) return 'providerNotEnabled';
  if (lc.includes('provider is not enabled') || lc.includes('provider not enabled')) return 'providerNotEnabled';
  // OAuth provider rejected the redirect_uri (Google/Apple reject the request itself).
  if (lc.includes('redirect_uri_mismatch') || lc.includes('redirect uri') || lc.includes('invalid_request')) return 'invalidRedirect';
  if (code === 'invalid_request' && lc.includes('redirect')) return 'invalidRedirect';
  if (lc.includes('invalid login') || lc.includes('invalid credentials')) return 'invalidCredentials';
  if (lc.includes('email not confirmed') || lc.includes('not confirmed')) return 'emailNotConfirmed';
  if (lc.includes('already registered') || lc.includes('already been registered') || lc.includes('user already registered')) return 'emailTaken';
  if (lc.includes('password should be') || lc.includes('weak') || lc.includes('at least 6')) return 'weakPassword';
  if (lc.includes('rate limit') || lc.includes('too many') || lc.includes('for security purposes')) return 'tooManyAttempts';
  if (lc.includes('failed to fetch') || lc.includes('network') || lc.includes('networkerror')) return 'network';
  if (lc.includes('timeout') || lc.includes('aborted')) return 'timeout';
  return 'unknown';
}

function describeAuthError(code: AuthErrorCode, locale: Locale): string {
  const map: Record<AuthErrorCode, TranslationKey> = {
    invalidCredentials: 'auth.error.invalidCredentials',
    emailTaken: 'auth.error.emailTaken',
    weakPassword: 'auth.error.weakPassword',
    tooManyAttempts: 'auth.error.tooManyAttempts',
    network: 'auth.error.network',
    timeout: 'auth.error.timeout',
    unknown: 'auth.error.unknown',
    passwordMismatch: 'auth.error.passwordMismatch',
    acceptTerms: 'auth.error.acceptTerms',
    invalidEmail: 'auth.error.invalidEmail',
    emailNotConfirmed: 'auth.error.emailNotConfirmed',
    providerNotEnabled: 'auth.error.providerNotEnabled',
    invalidRedirect: 'auth.error.invalidRedirect',
  };
  return translate(locale, map[code]);
}

function openAuthPopup(): Window | null {
  const width = 600;
  const height = 700;
  const left = window.screen.width / 2 - width / 2;
  const top = window.screen.height / 2 - height / 2;
  return window.open(
    'about:blank',
    'kiyo-oauth',
    `width=${width},height=${height},left=${left},top=${top}`,
  );
}

// ----- Profile fetch with timeout -----
const PROFILE_TIMEOUT_MS = 8000;
const MAX_PROFILE_RETRIES = 1;

async function fetchProfileWithRetry(
  client: SupabaseClient,
  userId: string,
  attempt = 0,
): Promise<Profile | null> {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), PROFILE_TIMEOUT_MS);
  try {
    const { data, error } = await client
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle();
    if (error) throw error;
    return data as Profile | null;
  } catch (err) {
    if (attempt < MAX_PROFILE_RETRIES) {
      await new Promise((r) => setTimeout(r, 600));
      return fetchProfileWithRetry(client, userId, attempt + 1);
    }
    throw err;
  } finally {
    clearTimeout(t);
  }
}

// First-insert bootstrap: in case the on_auth_user_created trigger hasn't
// populated the profile yet (replication lag, OAuth signup, etc.), attempt
// an insert keyed on the auth user id.
// Note: Super admin promotion is handled via admin_configuration table.
// Returns true if profile was ensured, false if the user ID is invalid (e.g., deleted).
async function ensureProfileExists(client: SupabaseClient, user: User): Promise<boolean> {
  const meta = user.user_metadata ?? {};
  const insert = {
    id: user.id,
    email: (user.email ?? '').trim().toLowerCase(),
    full_name: (meta.full_name as string) ?? (meta.name as string) ?? null,
    role: 'customer' as const,
  };

  const { error } = await client.from('profiles').insert(insert);

  if (error) {
    if (error.code === '23505') return true;
    // FK constraint violation means the user ID doesn't exist in auth.users
    // This happens when a session is stale (user was deleted during auth reset)
    if (error.code === '23503' || error.message?.includes('violates foreign key constraint')) {
      console.warn('User ID no longer exists in auth.users - session is stale, signing out');
      await client.auth.signOut();
      return false;
    }
    // Other errors: re-throw
    throw error;
  }

  return true;
}

// ----- Context -----
type AuthState = 'restoring' | 'unauthenticated' | 'authenticated';

type AuthContextValue = {
  state: AuthState;
  user: User | null;
  profile: Profile | null;
  profileError: boolean;
  error: { code: AuthErrorCode; message: string } | null;
  locale: Locale;
  setLocale: (l: Locale) => void;
  signInWithPassword: (email: string, password: string) => Promise<{ ok: boolean }>;
  signUp: (email: string, password: string, fullName: string) => Promise<{ ok: boolean; needsEmailConfirmation?: boolean }>;
  signInWithGoogle: () => Promise<void>;
  signInWithApple: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ ok: boolean }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>('restoring');
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [error, setError] = useState<AuthContextValue['error']>(null);
  const [locale, setLocaleState] = useState<Locale>('fr');

  const loadingProfileRef = useRef(false);
  const mountedRef = useRef(true);
  const [profileError, setProfileError] = useState<boolean>(false);

  // Restore persisted locale on mount (Phase 4 spec: default to French).
  useEffect(() => {
    const saved = localStorage.getItem('kiyo-locale') as Locale | null;
    if (saved && ['en', 'fr', 'ar'].includes(saved)) {
      setLocaleState(saved);
    } else {
      // No saved preference - use browser language if it matches one of ours,
      // otherwise fall back to French (platform default per spec).
      const nav = (navigator.language || 'fr').slice(0, 2).toLowerCase();
      if (nav === 'ar') setLocaleState('ar');
      else if (nav === 'en') setLocaleState('en');
      else setLocaleState('fr');
    }
  }, []);

  // setLocale: persist locally (immediate) + sync to profile in the background.
  // Sync ensures the next session restore honors the user's choice instead of
  // reverting to the stale DB value (the "language switcher doesn't persist" bug).
  const setLocale = useCallback((l: Locale) => {
    setLocaleState(l);
    localStorage.setItem('kiyo-locale', l);
    // Fire-and-forget profile sync - non-blocking, ignores failures.
    supabase
      .from('profiles')
      .update({ preferred_language: l })
      .eq('id', user?.id ?? '')
      .then(() => { /* non-fatal */ }, () => { /* non-fatal */ });
    // Also update local profile snapshot so the context value is consistent.
    setProfile((prev) => (prev ? { ...prev, preferred_language: l } : prev));
  }, [user?.id]);

  // Apply locale to <html> dir/lang
  useEffect(() => {
    const html = document.documentElement;
    html.lang = locale;
    html.dir = locale === 'ar' ? 'rtl' : 'ltr';
  }, [locale]);

  const clearError = () => mountedRef.current && setError(null);
  const clearProfileError = () => mountedRef.current && setProfileError(false);

  // Load + promote owner. Called once per session establishment.
  const establishProfile = useCallback(async (u: User) => {
    if (loadingProfileRef.current) return;
    loadingProfileRef.current = true;
    clearProfileError();
    try {
      // Super-admin promotion is enforced via the DB trigger on insert;
      // ensure profile row exists first (also runs the promotion).
      // If this returns false, the user was signed out (stale session after auth reset).
      const profileEnsured = await ensureProfileExists(supabase, u);
      if (!profileEnsured) {
        // User was signed out due to invalid session - reset state
        if (mountedRef.current) {
          setUser(null);
          setProfile(null);
          setState('unauthenticated');
        }
        return;
      }

      const p = await fetchProfileWithRetry(supabase, u.id);
      if (!mountedRef.current) return;
      if (p) {
        setProfile(p);
        // NOTE: do NOT override in-memory `locale` from `p.preferred_language`
        // here. The Phase 4 bug: when the user switches language via the UI, we
        // persist to localStorage AND to their profile async. If we re-read
        // from the DB on every restore (which may race the profile write), we
        // revert their selection. Trust the localStorage value instead; the
        // sync happens in setLocale() above.
        setState('authenticated');
      } else {
        // No profile but session is valid. Authenticated-but-degraded.
        // ProtectedRoute will surface a retry UI instead of bouncing to /login.
        setProfile(null);
        setState('authenticated');
        setProfileError(true);
      }
    } catch {
      if (!mountedRef.current) return;
      // Network/timeout during profile fetch. Keep the session valid so the
      // user isn't soft-logged-out; UI shows retry on protected routes.
      setUser(u);
      setProfile(null);
      setState('authenticated');
      setProfileError(true);
      setError({
        code: 'timeout',
        message: translate(locale, 'auth.error.timeout'),
      });
    } finally {
      loadingProfileRef.current = false;
    }
  }, [locale]);

  // One-shot session bootstrap + onAuthStateChange subscription.
  useEffect(() => {
    mountedRef.current = true;
    let cancelled = false;

    // Bootstrap current session (handles refresh + OAuth redirect).
    supabase.auth.getSession().then(({ data }) => {
      if (cancelled) return;
      const s = data.session;
      if (!s?.user) {
        localStorage.removeItem('kiyo-admin-bypass');
        setState('unauthenticated');
        return;
      }
      setUser(s.user);
      clearError();
      void establishProfile(s.user);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((event, s: Session | null) => {
      // Skip TOKEN_REFRESHED to avoid re-running profile loading on a token
      // rotation (would create infinite loops). We only react to sign-in/out.
      if (event === 'TOKEN_REFRESHED') return;

      const u = s?.user ?? null;
      if (!mountedRef.current) return;

      if (event === 'SIGNED_OUT') {
        localStorage.removeItem('kiyo-admin-bypass');
        setUser(null);
        setProfile(null);
        setState('unauthenticated');
        loadingProfileRef.current = false;
        return;
      }

      if (event === 'SIGNED_IN' || event === 'PASSWORD_RECOVERY') {
        if (!u) return;
        setUser(u);
        clearError();
        void establishProfile(u);
        if (
          event === 'PASSWORD_RECOVERY'
          && !['/reset-password', '/auth/reset'].includes(window.location.pathname)
        ) {
          window.location.assign('/reset-password');
        }
      }
    });

    // Listen for OAuth success messages from the login popup window
    const handleMessage = (event: MessageEvent) => {
      if (cancelled) return;
      if (event.data?.type === 'OAUTH_AUTH_SUCCESS') {
        supabase.auth.getSession().then(({ data }) => {
          if (cancelled) return;
          const s = data.session;
          if (s?.user) {
            setUser(s.user);
            clearError();
            void establishProfile(s.user);
          }
        });
      }
    };
    window.addEventListener('message', handleMessage);

    return () => {
      cancelled = true;
      mountedRef.current = false;
      sub.subscription.unsubscribe();
      window.removeEventListener('message', handleMessage);
    };
  }, [establishProfile, locale]);

  // ----- Mutations -----
  const signInWithPassword = useCallback<AuthContextValue['signInWithPassword']>(
    async (email, password) => {
      clearError();
      const lowerEmail = email.trim().toLowerCase();
      try {
        const { error: e } = await supabase.auth.signInWithPassword({ email: lowerEmail, password });
        if (e) throw e;
        return { ok: true };
      } catch (err) {
        localStorage.removeItem('kiyo-admin-bypass');
        if (lowerEmail.endsWith('@kiyo-food.store')) {
          console.warn('[Kiyo] Staff sign-in failed. Verify Supabase Auth credentials and profile role.', err);
        }
        const code = mapSupabaseError(err);
        setError({ code, message: describeAuthError(code, locale) });
        return { ok: false };
      }
    },
    [locale],
  );

  const signUp = useCallback<AuthContextValue['signUp']>(
    async (email, password, fullName) => {
      clearError();
      try {
        const normalizedEmail = email.trim().toLowerCase();
        const { data, error: e } = await supabase.auth.signUp({
          email: normalizedEmail,
          password,
          options: {
            data: { full_name: fullName.trim() },
            emailRedirectTo: getAuthRedirectUrl('/auth/callback'),
          },
        });
        if (e) throw e;
        return { ok: true, needsEmailConfirmation: Boolean(data.user && !data.session) };
      } catch (err) {
        const code = mapSupabaseError(err);
        setError({ code, message: describeAuthError(code, locale) });
        return { ok: false };
      }
    },
    [locale],
  );

  const signInWithGoogle = useCallback(async () => {
    clearError();
    const popup = openAuthPopup();
    if (!popup) {
      setError({
        code: 'unknown',
        message: translate(locale, 'auth.error.popupBlocked'),
      });
      return;
    }
    try {
      const { data, error: e } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: getAuthRedirectUrl('/auth/callback'),
          skipBrowserRedirect: true,
        },
      });
      if (e) throw e;
      if (data?.url) {
        popup.location.href = data.url;
      } else {
        popup.close();
      }
    } catch (err) {
      popup.close();
      const code = mapSupabaseError(err);
      setError({ code, message: describeAuthError(code, locale) });
    }
  }, [locale]);

  const signInWithApple = useCallback(async () => {
    clearError();
    const popup = openAuthPopup();
    if (!popup) {
      setError({
        code: 'unknown',
        message: translate(locale, 'auth.error.popupBlocked'),
      });
      return;
    }
    try {
      const { data, error: e } = await supabase.auth.signInWithOAuth({
        provider: 'apple',
        options: {
          redirectTo: getAuthRedirectUrl('/auth/callback'),
          skipBrowserRedirect: true,
        },
      });
      if (e) throw e;
      if (data?.url) {
        popup.location.href = data.url;
      } else {
        popup.close();
      }
    } catch (err) {
      popup.close();
      const code = mapSupabaseError(err);
      setError({ code, message: describeAuthError(code, locale) });
    }
  }, [locale]);

  const resetPassword = useCallback<AuthContextValue['resetPassword']>(
    async (email) => {
      clearError();
      try {
        const { error: e } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
          redirectTo: getAuthRedirectUrl('/reset-password'),
        });
        if (e) throw e;
        return { ok: true };
      } catch (err) {
        const code = mapSupabaseError(err);
        setError({ code, message: describeAuthError(code, locale) });
        return { ok: false };
      }
    },
    [locale],
  );

  const signOut = useCallback(async () => {
    localStorage.removeItem('kiyo-admin-bypass');
    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
    setState('unauthenticated');
  }, []);

  const refreshProfile = useCallback(async () => {
    if (!user) return;
    try {
      const p = await fetchProfileWithRetry(supabase, user.id);
      if (!mountedRef.current) return;
      if (p) setProfile(p);
    } catch {
      // leave existing profile; UI still functions
    }
  }, [user]);

  const value = useMemo<AuthContextValue>(
    () => ({
      state, user, profile, profileError, error, locale, setLocale,
      signInWithPassword, signUp, signInWithGoogle, signInWithApple, resetPassword, signOut,
      refreshProfile,
    }),
    [state, user, profile, profileError, error, locale, setLocale,
     signInWithPassword, signUp, signInWithGoogle, signInWithApple, resetPassword, signOut, refreshProfile],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within <AuthProvider>');
  return ctx;
}
