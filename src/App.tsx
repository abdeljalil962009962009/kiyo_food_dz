import { lazy, Suspense } from 'react';
import {
  createBrowserRouter,
  RouterProvider,
  Navigate,
} from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { CartProvider } from './context/CartContext';
import { WilayaProvider } from './context/WilayaContext';
import { ErrorBoundary } from './components/ErrorBoundary';
import { FullScreenLoader } from './components/feedback';
import { SettingsProvider } from './context/SettingsContext';
import { CookieConsentBanner } from './components/CookieConsentBanner';
import { ProtectedRoute, PublicOnlyRoute, RoleRoute } from './components/ProtectedRoute';

const HomePage = lazy(() => import('./pages/HomePage').then((m) => ({ default: m.HomePage })));
const NotFoundPage = lazy(() => import('./pages/HomePage').then((m) => ({ default: m.NotFoundPage })));
const AuthCallbackPage = lazy(() => import('./pages/HomePage').then((m) => ({ default: m.AuthCallbackPage })));
const LoginPage = lazy(() => import('./pages/LoginPage'));
const SignupPage = lazy(() => import('./pages/SignupPage'));
const ForgotPasswordPage = lazy(() => import('./pages/ForgotPasswordPage'));
const DashboardPage = lazy(() => import('./pages/DashboardPage'));
const ProfilePage = lazy(() => import('./pages/ProfilePage'));
const AuditLogPage = lazy(() => import('./pages/AuditLogPage'));
const TermsOfUsePage = lazy(() => import('./pages/LegalPages').then((m) => ({ default: m.TermsOfUsePage })));
const PrivacyPolicyPage = lazy(() => import('./pages/LegalPages').then((m) => ({ default: m.PrivacyPolicyPage })));
const RefundPolicyPage = lazy(() => import('./pages/LegalPages').then((m) => ({ default: m.RefundPolicyPage })));
const RestaurantAgreementPage = lazy(() => import('./pages/LegalPages').then((m) => ({ default: m.RestaurantAgreementPage })));
const CookiePolicyPage = lazy(() => import('./pages/LegalPages').then((m) => ({ default: m.CookiePolicyPage })));
const AccountDeletionPage = lazy(() => import('./pages/LegalPages').then((m) => ({ default: m.AccountDeletionPage })));

const RestaurantsPage = lazy(() => import('./pages/RestaurantsPage'));
const RestaurantDetailPage = lazy(() => import('./pages/RestaurantDetailPage'));
const CartPage = lazy(() => import('./pages/CartPage'));
const CheckoutPage = lazy(() => import('./pages/CheckoutPage'));
const OrdersPage = lazy(() => import('./pages/OrdersPage'));
const RestaurantOnboardingPage = lazy(() => import('./pages/RestaurantOnboardingPage'));
const RestaurantDashboardPage = lazy(() => import('./pages/RestaurantDashboardPage'));
const RestaurantMenuPage = lazy(() => import('./pages/RestaurantMenuPage'));
const RestaurantSettingsPage = lazy(() => import('./pages/RestaurantSettingsPage'));
const AdminRestaurantsPage = lazy(() => import('./pages/AdminRestaurantsPage'));
const AdminControlCenterPage = lazy(() => import('./pages/AdminControlCenterPage'));
const SupportPage = lazy(() => import('./pages/SupportPage'));

function HomeRedirect() {
  const { state } = useAuth();
  if (state === 'authenticated') return <Navigate to="/dashboard" replace />;
  if (state === 'restoring') return <FullScreenLoader />;
  return <HomePage />;
}

function withSuspense(el: React.ReactNode) {
  return (
    <ErrorBoundary variant="page">
      <Suspense fallback={<FullScreenLoader />}>{el}</Suspense>
    </ErrorBoundary>
  );
}

const router = createBrowserRouter([
  { path: '/', element: withSuspense(<HomeRedirect />) },
  { path: '/login', element: withSuspense(<PublicOnlyRoute><LoginPage /></PublicOnlyRoute>) },
  { path: '/signup', element: withSuspense(<PublicOnlyRoute><SignupPage /></PublicOnlyRoute>) },
  { path: '/auth/callback', element: withSuspense(<AuthCallbackPage />) },
  { path: '/auth/forgot', element: withSuspense(<ForgotPasswordPage />) },
  { path: '/legal/terms', element: withSuspense(<TermsOfUsePage />) },
  { path: '/legal/privacy', element: withSuspense(<PrivacyPolicyPage />) },
  { path: '/legal/refund', element: withSuspense(<RefundPolicyPage />) },
  { path: '/legal/restaurant-agreement', element: withSuspense(<RestaurantAgreementPage />) },
  { path: '/legal/cookies', element: withSuspense(<CookiePolicyPage />) },
  { path: '/legal/account-deletion', element: withSuspense(<AccountDeletionPage />) },
  // Customer + shared
  { path: '/dashboard', element: withSuspense(<ProtectedRoute><DashboardPage /></ProtectedRoute>) },
  { path: '/profile', element: withSuspense(<ProtectedRoute><ProfilePage /></ProtectedRoute>) },
  { path: '/restaurants', element: withSuspense(<ProtectedRoute><RestaurantsPage /></ProtectedRoute>) },
  { path: '/restaurant/:id', element: withSuspense(<ProtectedRoute><RestaurantDetailPage /></ProtectedRoute>) },
  { path: '/cart', element: withSuspense(<ProtectedRoute><CartPage /></ProtectedRoute>) },
  { path: '/checkout', element: withSuspense(<ProtectedRoute><CheckoutPage /></ProtectedRoute>) },
  { path: '/orders', element: withSuspense(<ProtectedRoute><OrdersPage /></ProtectedRoute>) },
  { path: '/support', element: withSuspense(<ProtectedRoute><SupportPage /></ProtectedRoute>) },
  // Restaurant owner
  { path: '/restaurant/onboarding', element: withSuspense(
    <ProtectedRoute><RoleRoute role="super_admin"><RestaurantOnboardingPage /></RoleRoute></ProtectedRoute>,
  ) },
  { path: '/restaurant', element: withSuspense(
    <ProtectedRoute><RoleRoute role={['restaurant_owner','super_admin']}><RestaurantDashboardPage /></RoleRoute></ProtectedRoute>,
  ) },
  { path: '/restaurant/menu', element: withSuspense(
    <ProtectedRoute><RoleRoute role={['restaurant_owner','super_admin']}><RestaurantMenuPage /></RoleRoute></ProtectedRoute>,
  ) },
  { path: '/restaurant/settings', element: withSuspense(
    <ProtectedRoute><RoleRoute role={['restaurant_owner','super_admin']}><RestaurantSettingsPage /></RoleRoute></ProtectedRoute>,
  ) },
  // Super admin
  { path: '/admin', element: withSuspense(
    <ProtectedRoute><RoleRoute role="super_admin"><AdminControlCenterPage /></RoleRoute></ProtectedRoute>,
  ) },
  { path: '/admin/restaurants', element: withSuspense(
    <ProtectedRoute><RoleRoute role="super_admin"><AdminRestaurantsPage /></RoleRoute></ProtectedRoute>,
  ) },
  { path: '/admin/audit', element: withSuspense(
    <ProtectedRoute><RoleRoute role="super_admin"><AuditLogPage /></RoleRoute></ProtectedRoute>,
  ) },
  { path: '*', element: withSuspense(<NotFoundPage />) },
]);

export default function App() {
  return (
    <ErrorBoundary variant="page">
      <AuthProvider>
        <SettingsProvider>
          <WilayaProviderBridge>
            <CartProvider>
              <RouterProvider router={router} />
              <CookieConsentBanner />
            </CartProvider>
          </WilayaProviderBridge>
        </SettingsProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}

function WilayaProviderBridge({ children }: { children: React.ReactNode }) {
  const { locale } = useAuth();
  return (
    <WilayaProvider locale={locale}>
      {children}
    </WilayaProvider>
  );
}
