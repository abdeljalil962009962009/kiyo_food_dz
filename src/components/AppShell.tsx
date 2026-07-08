import type { ReactNode } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { LayoutDashboard, User, LogOut, ChevronDown, Menu, X, ShoppingBag, Store, Utensils, ShieldCheck, MessageCircle, Heart, Bike } from 'lucide-react';
import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useSettings } from '../context/SettingsContext';
import { useCart } from '../context/CartContext';
import { useWilaya } from '../context/WilayaContext';
import { useT } from '../lib/i18n-react';
import { Logo } from './Logo';
import { NotificationBell } from './NotificationBell';
import { WilayaSelector } from './WilayaSelector';
import type { Locale } from '../lib/i18n';

export function AppShell({ children }: { children: ReactNode }) {
  const { profile, signOut, locale, setLocale } = useAuth();
  const { totalItems } = useCart();
  const { loading: wilayaLoading } = useWilaya();
  const { t } = useT();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);

  const ROLE_LABEL: Record<string, string> = {
    super_admin: t('role.super_admin'),
    restaurant_owner: t('role.restaurant_owner'),
    customer: t('role.customer'),
    driver: t('role.driver'),
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/login', { replace: true });
  };

  // Role-adaptive primary nav.
  const role = profile?.role ?? 'customer';
  const navItems = [
    { to: '/dashboard', label: t('nav.dashboard'), icon: LayoutDashboard },
    ...(role === 'customer' ? [
      { to: '/restaurants', label: t('market.browse'), icon: ShoppingBag },
      { to: '/restaurant/apply', label: t('restaurant.apply.nav'), icon: Store },
      { to: '/favorites', label: t('nav.favorites'), icon: Heart },
      { to: '/orders', label: t('orders.title'), icon: Utensils },
      { to: '/support', label: t('nav.support'), icon: MessageCircle },
    ] : []),
    ...(role === 'restaurant_owner' ? [
      { to: '/restaurant', label: t('restaurant.dashboard'), icon: Store, end: true },
      { to: '/restaurant/menu', label: t('restaurant.manageMenu'), icon: Utensils },
    ] : []),
    ...(role === 'driver' ? [
      { to: '/driver', label: t('nav.driverDashboard'), icon: Bike },
    ] : []),
    ...(role === 'super_admin' ? [
      { to: '/restaurants', label: t('market.browse'), icon: ShoppingBag },
      { to: '/admin', label: t('nav.controlCenter'), icon: ShieldCheck, end: true },
      { to: '/admin/restaurants', label: t('admin.restaurantsManagement'), icon: Store },
      { to: '/admin/audit', label: t('audit.title'), icon: ShieldCheck },
    ] : []),
    { to: '/profile', label: t('nav.profile'), icon: User },
  ];

  const { isMaintenance } = useSettings();

  if (isMaintenance) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-ink-50 px-4">
        <div className="max-w-md text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-ember-500/10">
            <Utensils className="h-8 w-8 text-ember-500" />
          </div>
          <h1 className="font-display text-2xl font-extrabold text-ink-900">{t('sys.underMaintenance')}</h1>
          <p className="mt-2 text-sm text-ink-500">
            {t('sys.maintenanceDesc')}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-ink-50">
      <header
        className="sticky top-0 z-30 border-b border-ink-100 bg-white/80 backdrop-blur-xl"
        style={{ paddingTop: 'var(--kiyo-safe-top)' }}
      >
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-2">
            <button
              className="kiyo-btn-ghost -ml-2 p-2 lg:hidden"
              onClick={() => setMobileOpen((v) => !v)}
              aria-label="Toggle menu"
            >
              {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
            <Link to="/dashboard" className="flex items-center">
              <Logo size={32} />
            </Link>
            {role === 'customer' && !wilayaLoading && (
              <div className="ml-2 hidden sm:block">
                <WilayaSelector />
              </div>
            )}
          </div>

          <nav className="hidden items-center gap-1 lg:flex">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  `inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                    isActive ? 'bg-ink-900 text-white' : 'text-ink-600 hover:bg-ink-100 hover:text-ink-900'
                  }`
                }
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </NavLink>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            <NotificationBell />
            <LocaleSwitcher locale={locale} onChange={setLocale} />
            {role === 'customer' && totalItems > 0 && (
              <Link
                to="/cart"
                className="relative inline-flex items-center gap-1 rounded-lg border border-ink-100 bg-white px-2.5 py-2 text-xs font-semibold text-ink-700 hover:bg-ink-50"
                aria-label={t('cart.title')}
              >
                <ShoppingBag className="h-4 w-4" />
                <span className="hidden sm:inline">{t('cart.title')}</span>
                <span className="ml-0.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-ember-500 px-1 text-[10px] font-bold text-white">
                  {totalItems}
                </span>
              </Link>
            )}
            <div className="hidden items-center gap-2 sm:flex">
              <div className="flex items-center gap-2 rounded-xl border border-ink-100 bg-ink-50 px-3 py-1.5">
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-ember-500 text-xs font-bold text-white">
                  {(profile?.full_name ?? profile?.email ?? '?').charAt(0).toUpperCase()}
                </div>
                <div className="hidden text-left leading-tight md:block">
                  <div className="max-w-[120px] truncate text-xs font-medium text-ink-900">
                    {profile?.full_name ?? profile?.email}
                  </div>
                  <div className="text-[10px] uppercase tracking-wide text-ink-400">
                    {ROLE_LABEL[profile?.role ?? 'customer']}
                  </div>
                </div>
              </div>
            </div>
            <button
              onClick={handleSignOut}
              className="kiyo-btn-secondary px-3 py-2"
              aria-label={t('auth.logout')}
              title={t('auth.logout')}
            >
              <LogOut className="h-4 w-4" />
              <span className="hidden sm:inline">{t('auth.logout')}</span>
            </button>
          </div>
        </div>

        {mobileOpen && (
          <nav className="border-t border-ink-100 bg-white px-4 pb-4 pt-2 lg:hidden">
            {role === 'customer' && (
              <div className="mb-3 border-b border-ink-100 pb-3">
                <WilayaSelector variant="inline" />
              </div>
            )}
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                onClick={() => setMobileOpen(false)}
                className={({ isActive }) =>
                  `flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium ${
                    isActive ? 'bg-ink-900 text-white' : 'text-ink-700 hover:bg-ink-100'
                  }`
                }
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </NavLink>
            ))}
          </nav>
        )}
      </header>

      <main className="mx-auto max-w-6xl px-4 pb-24 pt-6 sm:px-6 sm:pt-8">
        <div className="route-enter">{children}</div>
      </main>
    </div>
  );
}

function LocaleSwitcher({ locale, onChange }: {
  locale: Locale; onChange: (l: Locale) => void;
}) {
  const [open, setOpen] = useState(false);
  const langs: { code: Locale; label: string; flag: string }[] = [
    { code: 'en', label: 'English', flag: 'EN' },
    { code: 'fr', label: 'Français', flag: 'FR' },
    { code: 'ar', label: 'العربية', flag: 'AR' },
  ];
  const current = langs.find((l) => l.code === locale) ?? langs[0];

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1 rounded-lg border border-ink-100 bg-white px-2.5 py-2 text-xs font-semibold text-ink-700 hover:bg-ink-50"
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        {current.flag}
        <ChevronDown className="h-3 w-3 opacity-60" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <ul className="absolute right-0 z-20 mt-1 w-32 overflow-hidden rounded-lg border border-ink-100 bg-white shadow-card-lg">
            {langs.map((l) => (
              <li key={l.code}>
                <button
                  onClick={() => { onChange(l.code); setOpen(false); }}
                  className={`flex w-full items-center justify-between px-3 py-2 text-xs ${
                    l.code === locale ? 'bg-ink-50 font-semibold text-ink-900' : 'text-ink-600 hover:bg-ink-50'
                  }`}
                >
                  {l.label}
                  <span className="opacity-60">{l.flag}</span>
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
