import { Link, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { ArrowRight, ClipboardCheck, ShieldCheck, Tag, Wallet, MapPin, LifeBuoy } from 'lucide-react';
import { useT } from '../lib/i18n-react';
import { Logo } from '../components/Logo';
import { FullScreenLoader } from '../components/feedback';
import { getPublicSiteUrl } from '../lib/siteUrl';
import { LocaleSwitcher } from '../components/LocaleSwitcher';
import { supabase } from '../lib/supabase';
import { withExponentialBackoff } from '../lib/locationNetwork';

const HERO_IMAGE = 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=1800&q=82&auto=format&fit=crop';

type HomepageCampaign = {
  id: string;
  name: string;
  content: Record<string, unknown>;
  ctaLabel: string | null;
  ctaHref: string | null;
};

function readCampaignText(content: Record<string, unknown>, key: string): string | null {
  const value = content[key];
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

export function HomePage() {
  const { t } = useT();
  const { locale, setLocale } = useAuth();
  const siteUrl = getPublicSiteUrl();
  const [campaign, setCampaign] = useState<HomepageCampaign | null>(null);

  useEffect(() => {
    let active = true;
    void withExponentialBackoff(async () => {
      const { data, error } = await supabase
        .from('marketing_campaigns')
        .select('id, name, content')
        .eq('is_active', true)
        .eq('campaign_type', 'in_app')
        .in('target_audience', ['all', 'customers'])
        .or(`scheduled_start.is.null,scheduled_start.lte.${new Date().toISOString()}`)
        .or(`scheduled_end.is.null,scheduled_end.gt.${new Date().toISOString()}`)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data ? {
        id: data.id,
        name: data.name,
        content: (data.content && typeof data.content === 'object' ? data.content : {}) as Record<string, unknown>,
        ctaLabel: null,
        ctaHref: null,
      } satisfies HomepageCampaign : null;
    }, { attempts: 2, timeoutMs: 8000 })
      .then((data) => {
        if (active) setCampaign(data);
      })
      .catch((error) => {
        console.error('[Kiyo] Homepage campaign could not be loaded:', error);
        if (active) setCampaign(null);
      });
    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="min-h-screen bg-ink-900 text-white">
      <section className="relative min-h-[74svh] overflow-hidden">
        <img
          src={HERO_IMAGE}
          alt=""
          className="absolute inset-0 h-full w-full object-cover"
          decoding="async"
        />
        <div className="absolute inset-0 bg-black/60" aria-hidden />

        <header className="relative mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <Logo size={36} />
          <div className="flex items-center gap-2">
            <LocaleSwitcher locale={locale} onChange={setLocale} inverted />
            <Link to="/login" className="kiyo-btn-ghost min-h-11 text-white hover:bg-white/10 hover:text-white">
              {t('auth.login')}
            </Link>
            <Link to="/signup" className="kiyo-btn-primary hidden min-h-11 bg-white text-ink-900 hover:bg-ink-100 sm:inline-flex">
              {t('auth.signup')}
            </Link>
          </div>
        </header>

        <main className="relative mx-auto flex max-w-6xl flex-col items-start px-4 pb-16 pt-16 sm:px-6 sm:pt-24">
          <p className="text-sm font-bold text-ember-300">{t('brand.name')}</p>
          <h1 className="mt-2 max-w-2xl font-display text-4xl font-extrabold leading-tight sm:text-6xl">
            {t('brand.tagline')}
          </h1>
          <p className="mt-4 max-w-xl text-sm leading-6 text-white/85 sm:text-base">
            {t('brand.heroSubtitle')}
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Link to="/restaurants" className="kiyo-btn-primary min-h-11 bg-ember-500 hover:bg-ember-600">
              {t('market.browse')}
            </Link>
            <Link
              to="/login"
              className="kiyo-btn-secondary min-h-11 border-white/30 bg-black/20 text-white hover:border-white/50 hover:bg-black/35"
            >
              {t('auth.login')}
            </Link>
          </div>
          {campaign && (
            <div className="mt-7 max-w-2xl rounded-lg border border-white/15 bg-black/35 p-4 shadow-card backdrop-blur">
              <p className="text-xs font-bold uppercase tracking-[0.12em] text-ember-300">
                {readCampaignText(campaign.content, 'title') ?? campaign.name}
              </p>
              <p className="mt-2 text-sm leading-6 text-white/90">
                {readCampaignText(campaign.content, 'subtitle') ?? readCampaignText(campaign.content, 'message') ?? campaign.name}
              </p>
              {(readCampaignText(campaign.content, 'cta_href') ?? campaign.ctaHref) && (readCampaignText(campaign.content, 'cta_label') ?? campaign.ctaLabel) && (
                <Link
                  to={readCampaignText(campaign.content, 'cta_href') ?? campaign.ctaHref ?? '/restaurants'}
                  className="mt-3 inline-flex min-h-11 items-center gap-2 text-sm font-bold text-white underline underline-offset-4"
                >
                  {readCampaignText(campaign.content, 'cta_label') ?? campaign.ctaLabel}
                  <ArrowRight className="h-4 w-4" />
                </Link>
              )}
            </div>
          )}
        </main>
      </section>

      <section className="border-t border-white/10 bg-ink-900">
        <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-16">
          <h2 className="font-display text-2xl font-extrabold tracking-tight sm:text-3xl">
            {t('brand.whyKiyo')}
          </h2>
          <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <FeatureCard
              icon={ClipboardCheck}
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
              icon={LifeBuoy}
              title={t('brand.heroFeature6Title')}
              desc={t('brand.heroFeature6Desc')}
            />
          </div>
          <footer className="mt-12 flex flex-wrap gap-x-4 gap-y-2 border-t border-white/10 pt-6 text-xs text-ink-400">
            <Link to="/legal/terms" className="hover:text-ink-200">{t('auth.termsLink')}</Link>
            <Link to="/legal/privacy" className="hover:text-ink-200">{t('auth.privacyLink')}</Link>
            <Link to="/legal/refund" className="hover:text-ink-200">{t('common.refunds')}</Link>
            <Link to="/legal/cookies" className="hover:text-ink-200">{t('common.cookies')}</Link>
          </footer>
        </div>
      </section>

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
    <div className="group rounded-lg border border-white/10 bg-white/5 p-5 transition-colors hover:border-ember-500/30 hover:bg-white/10">
      <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-ember-500/15 text-ember-400">
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
  const { state, needsPhoneCompletion } = useAuth();

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
        navigate(needsPhoneCompletion ? '/complete-profile' : '/dashboard', { replace: true });
      } else if (state === 'unauthenticated') {
        navigate('/login', { replace: true });
      }
    }
  }, [state, needsPhoneCompletion, navigate]);

  return <FullScreenLoader label={t('auth.sessionRestoring')} />;
}
