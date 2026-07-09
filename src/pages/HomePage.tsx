import { Link, useNavigate } from 'react-router-dom';
import { useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Zap, ShieldCheck, Tag, Wallet, MapPin, ArrowRight } from 'lucide-react';
import { useT } from '../lib/i18n-react';
import { Logo } from '../components/Logo';
import { FullScreenLoader } from '../components/feedback';
import { getPublicSiteUrl } from '../lib/siteUrl';

export function HomePage() {
  const { t } = useT();
  const siteUrl = getPublicSiteUrl();
  return (
    <div className="relative min-h-screen overflow-hidden bg-ink-900 text-white">
      <div
        className="absolute inset-0 opacity-60"
        style={{
          backgroundImage:
            'radial-gradient(60% 50% at 20% 10%, rgba(251,79,10,0.45) 0%, transparent 60%), radial-gradient(50% 50% at 90% 80%, rgba(79,122,91,0.4) 0%, transparent 60%)',
        }}
        aria-hidden
      />
      <header className="relative mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
        <Logo size={36} />
        <div className="flex items-center gap-2">
          <Link to="/login" className="kiyo-btn-ghost text-ink-200 hover:bg-white/10 hover:text-white">
            {t('auth.login')}
          </Link>
          <Link to="/signup" className="kiyo-btn-primary bg-white text-ink-900 hover:bg-ink-100">
            {t('auth.signup')}
          </Link>
        </div>
      </header>

      <main className="relative mx-auto flex max-w-6xl flex-col items-start px-4 pb-20 pt-16 sm:pt-24">
        <p className="text-sm font-medium uppercase tracking-wide text-ember-400">
          {t('brand.name')}
        </p>
        <h1 className="mt-2 max-w-2xl font-display text-4xl font-extrabold leading-tight sm:text-6xl">
          {t('brand.tagline')}
        </h1>
        <p className="mt-4 max-w-md text-sm text-ink-200 sm:text-base">
          {t('brand.heroSubtitle')}
        </p>
        <div className="mt-6 flex gap-3">
          <Link to="/signup" className="kiyo-btn-primary bg-ember-500 hover:bg-ember-600">
            {t('auth.signup')}
          </Link>
          <Link
            to="/login"
            className="kiyo-btn-secondary bg-white/10 text-white border-white/20 hover:bg-white/20 hover:border-white/40"
          >
            {t('auth.login')}
          </Link>
        </div>

        {/* Why Choose Kiyo Food */}
        <div className="mt-16 w-full">
          <h2 className="font-display text-2xl font-extrabold tracking-tight sm:text-3xl">
            {t('brand.whyKiyo')}
          </h2>
          <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <FeatureCard
              icon={Zap}
              title={t('brand.heroFeature1Title')}
              desc={t('brand.heroFeature1Desc')}
            />
            <FeatureCard
              icon={ShieldCheck}
              title={t('brand.heroFeature2Title')}
              desc={t('brand.heroFeature2Desc')}
            />
            <FeatureCard
              icon={Tag}
              title={t('brand.heroFeature3Title')}
              desc={t('brand.heroFeature3Desc')}
            />
            <FeatureCard
              icon={Wallet}
              title={t('brand.heroFeature4Title')}
              desc={t('brand.heroFeature4Desc')}
            />
            <FeatureCard
              icon={MapPin}
              title={t('brand.heroFeature5Title')}
              desc={t('brand.heroFeature5Desc')}
            />
            <FeatureCard
              icon={ArrowRight}
              title={t('brand.heroFeature6Title')}
              desc={t('brand.heroFeature6Desc')}
            />
          </div>
        </div>

        <p className="mt-12 text-xs text-ink-400">
          <Link to="/legal/terms" className="hover:text-ink-200">Terms</Link>
          {' · '}
          <Link to="/legal/privacy" className="hover:text-ink-200">Privacy</Link>
          {' · '}
          <Link to="/legal/refund" className="hover:text-ink-200">Refunds</Link>
          {' · '}
          <Link to="/legal/cookies" className="hover:text-ink-200">Cookies</Link>
        </p>
      </main>

      {/* Structured data for SEO */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'FoodEstablishment',
        name: 'Kiyo Food',
        description: t('brand.seoDescription'),
        areaServed: t('brand.areaServed'),
        servesCuisine: ['Algerian', 'Fast Food', 'International'],
        url: siteUrl,
      }) }} />
    </div>
  );
}

function FeatureCard({ icon: Icon, title, desc }: { icon: React.ElementType; title: string; desc: string }) {
  return (
    <div className="group rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur-sm transition-all hover:border-ember-500/30 hover:bg-white/10">
      <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-ember-500/15 text-ember-400 transition-transform group-hover:scale-110">
        <Icon className="h-5 w-5" />
      </div>
      <h3 className="mt-4 font-display text-lg font-bold text-white">{title}</h3>
      <p className="mt-1 text-sm text-ink-300">{desc}</p>
    </div>
  );
}

export function NotFoundPage() {
  const { t } = useT();
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-ink-50 px-4 text-center">
      <Logo size={48} withText={false} />
      <p className="font-display text-6xl font-extrabold text-ink-900">404</p>
      <h1 className="font-display text-lg font-bold text-ink-900">
        {t('error.pageNotFound')}
      </h1>
      <p className="max-w-sm text-sm text-ink-500">{t('error.pageNotFoundBody')}</p>
      <Link to="/" className="kiyo-btn-primary mt-2">
        {t('error.goHome')}
      </Link>
    </div>
  );
}

export function AuthCallbackPage() {
  const { t } = useT();
  const navigate = useNavigate();
  const { state } = useAuth();

  useEffect(() => {
    if (window.opener) {
      // In OAuth popup window
      if (state === 'authenticated') {
        window.opener.postMessage({ type: 'OAUTH_AUTH_SUCCESS' }, '*');
        window.close();
      }
    } else {
      // Direct window redirect
      if (state === 'authenticated') {
        navigate('/dashboard', { replace: true });
      } else if (state === 'unauthenticated') {
        navigate('/login', { replace: true });
      }
    }
  }, [state, navigate]);

  return <FullScreenLoader label={t('auth.sessionRestoring')} />;
}
