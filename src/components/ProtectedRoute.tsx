import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { FullScreenLoader, ErrorState } from './feedback';
import { useT } from '../lib/i18n-react';
import type { UserRole } from '../lib/supabase';

/**
 * Route gate:
 *  - restoring session -> show loader
 *  - authenticated + profileError -> show retry UI (NOT a bounce to /login)
 *  - authenticated + profile -> render children
 *  - unauthenticated -> redirect to /login (preserve destination)
 */
export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { state, profile, profileError, refreshProfile, needsPhoneCompletion } = useAuth();
  const { t } = useT();
  const location = useLocation();

  if (state === 'restoring') {
    return <FullScreenLoader label={t('auth.sessionRestoring')} />;
  }
  if (profileError && !profile) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-ink-50 px-4">
        <ErrorState
          title={t('auth.error.timeout')}
          message={t('error.genericBody')}
          onRetry={refreshProfile}
          retryLabel={t('error.retry')}
        />
      </div>
    );
  }
  if (state === 'unauthenticated' || !profile) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }
  if (needsPhoneCompletion && location.pathname !== '/complete-profile') {
    return <Navigate to="/complete-profile" replace state={{ from: location }} />;
  }
  return <>{children}</>;
}

/**
 * Role gate. Use inside ProtectedRoute to restrict a route by role.
 */
export function RoleRoute({ role, children }: { role: UserRole | UserRole[]; children: ReactNode }) {
  const { profile } = useAuth();
  const roles = Array.isArray(role) ? role : [role];
  if (!profile || !roles.includes(profile.role)) {
    return <Navigate to="/dashboard" replace />;
  }
  return <>{children}</>;
}

/**
 * Inverse route for auth pages: /login, /signup. If already authenticated,
 * bounce to dashboard.
 */
export function PublicOnlyRoute({ children }: { children: ReactNode }) {
  const { state, needsPhoneCompletion } = useAuth();
  const location = useLocation();
  const from = (location.state as {
    from?: { pathname?: string; search?: string; hash?: string };
  } | null)?.from;
  const dest = from?.pathname?.startsWith('/')
    ? `${from.pathname}${from.search ?? ''}${from.hash ?? ''}`
    : '/dashboard';
  if (state === 'authenticated') {
    return <Navigate to={needsPhoneCompletion ? '/complete-profile' : dest} replace />;
  }
  if (state === 'restoring') return <FullScreenLoader />;
  return <>{children}</>;
}

/**
 * Public browsing remains available to signed-out visitors. A signed-in
 * Google user with an incomplete profile must finish the required phone step
 * before continuing through public discovery pages as an account holder.
 */
export function PhoneCompletionRoute({ children }: { children: ReactNode }) {
  const { state, needsPhoneCompletion } = useAuth();
  const location = useLocation();
  if (state === 'authenticated' && needsPhoneCompletion) {
    return <Navigate to="/complete-profile" replace state={{ from: location }} />;
  }
  return <>{children}</>;
}
