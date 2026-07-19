import { Link } from 'react-router-dom';
import { ChevronLeft, MessageCircle } from 'lucide-react';
import { Logo } from '../components/Logo';
import { LocaleSwitcher } from '../components/LocaleSwitcher';
import { useAuth } from '../context/AuthContext';
import { useT } from '../lib/i18n-react';
import { legalDocuments, legalUi, type LegalDocumentId } from '../lib/legalContent';

function LegalPage({ documentId }: { documentId: LegalDocumentId }) {
  const { locale } = useT();
  const { setLocale } = useAuth();
  const document = legalDocuments[locale][documentId];
  const ui = legalUi[locale];

  return (
    <div className="min-h-screen bg-ink-50">
      <header className="border-b border-ink-100 bg-white/90 backdrop-blur-xl">
        <div className="mx-auto flex min-h-16 max-w-3xl items-center justify-between gap-3 px-4 py-2">
          <Link to="/" className="flex items-center" aria-label="Kiyo Food">
            <Logo size={32} />
          </Link>
          <div className="flex items-center gap-2">
            <LocaleSwitcher locale={locale} onChange={setLocale} />
            <Link to="/login" className="kiyo-btn-ghost min-h-11">
              <ChevronLeft className={`h-4 w-4 ${locale === 'ar' ? 'rotate-180' : ''}`} />
              {ui.back}
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-10 sm:py-14">
        <article className="route-enter">
          <p className="text-xs font-bold uppercase text-ember-600">{ui.legal}</p>
          <h1 className="mt-1 font-display text-3xl font-extrabold text-ink-900">{document.title}</h1>
          <p className="mt-2 text-xs text-ink-400">{ui.lastUpdated}: {document.lastUpdated}</p>

          <div className="mt-6 flex items-start gap-3 rounded-lg border border-sage-100 bg-sage-50 p-4 text-sm leading-6 text-sage-800">
            <MessageCircle className="mt-0.5 h-5 w-5 flex-shrink-0" aria-hidden />
            <p>{ui.notice}</p>
          </div>

          <div className="mt-8 space-y-7 text-sm leading-7 text-ink-700">
            {document.sections.map((section) => (
              <section key={section.heading}>
                <h2 className="font-display text-base font-bold text-ink-900">{section.heading}</h2>
                <p className="mt-1">{section.body}</p>
              </section>
            ))}
          </div>

          <div className="mt-10 border-t border-ink-100 pt-6">
            <Link to="/support" className="kiyo-btn-secondary min-h-11">
              <MessageCircle className="h-4 w-4" />
              {locale === 'ar' ? 'التواصل مع الدعم' : locale === 'fr' ? 'Contacter le support' : 'Contact support'}
            </Link>
          </div>
        </article>
      </main>
    </div>
  );
}

export function TermsOfUsePage() { return <LegalPage documentId="terms" />; }
export function PrivacyPolicyPage() { return <LegalPage documentId="privacy" />; }
export function RefundPolicyPage() { return <LegalPage documentId="refund" />; }
export function RestaurantAgreementPage() { return <LegalPage documentId="restaurantAgreement" />; }
export function CookiePolicyPage() { return <LegalPage documentId="cookies" />; }
export function AccountDeletionPage() { return <LegalPage documentId="accountDeletion" />; }

export default LegalPage;
