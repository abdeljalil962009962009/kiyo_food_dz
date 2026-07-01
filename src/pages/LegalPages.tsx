import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import { Logo } from '../components/Logo';

export default function LegalPage({
  title,
  lastUpdated,
  body,
}: {
  title: string;
  lastUpdated: string;
  body: ReactNode;
}) {
  return (
    <div className="min-h-screen bg-ink-50">
      <header className="border-b border-ink-100 bg-white/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-3xl items-center justify-between px-4">
          <Link to="/" className="flex items-center">
            <Logo size={32} />
          </Link>
          <Link
            to="/login"
            className="inline-flex items-center gap-1 text-xs font-semibold text-ink-500 hover:text-ink-900"
          >
            <ChevronLeft className="h-4 w-4" />
            Back
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-10 sm:py-14">
        <div className="route-enter">
          <p className="text-xs font-medium uppercase tracking-wide text-ember-600">
            Legal
          </p>
          <h1 className="mt-1 font-display text-3xl font-extrabold tracking-tight text-ink-900">
            {title}
          </h1>
          <p className="mt-1 text-xs text-ink-400">Last updated: {lastUpdated}</p>
          <div className="prose mt-8 space-y-5 text-sm leading-relaxed text-ink-700">
            {body}
          </div>
        </div>
      </main>
    </div>
  );
}

function Section({ h, p }: { h: string; p: string }) {
  return (
    <section>
      <h2 className="font-display text-base font-bold text-ink-900">{h}</h2>
      <p>{p}</p>
    </section>
  );
}

export function TermsOfUsePage() {
  return (
    <LegalPage
      title="Terms of Use"
      lastUpdated="June 2026"
      body={
        <>
          {[
            { h: '1. Acceptance of Terms', p: 'By accessing Kiyo, you agree to these Terms. If you do not agree, do not use the platform.' },
            { h: '2. Platform role', p: 'Kiyo is an intermediary marketplace. We connect customers with independent restaurants. Restaurants are responsible for the preparation, quality, and delivery of their food, including their own delivery staff.' },
            { h: '3. Orders & payment', p: 'All orders are placed Cash on Delivery unless stated otherwise. Orders and delivery fees are validated server-side; tampering with prices or fees is prohibited and will void the order.' },
            { h: '4. Accounts', p: 'You are responsible for safeguarding your account credentials. We may suspend accounts engaged in fraudulent or abusive behavior.' },
            { h: '5. Liability', p: 'Kiyo is not liable for the acts or omissions of restaurants or their delivery staff, except where required by law.' },
            { h: '6. Changes', p: 'We may revise these Terms. Continued use after changes constitutes acceptance.' },
          ].map((s) => <Section key={s.h} {...s} />)}
        </>
      }
    />
  );
}

export function PrivacyPolicyPage() {
  return (
    <LegalPage
      title="Privacy Policy"
      lastUpdated="June 2026"
      body={
        <>
          {[
            { h: '1. What we collect', p: 'We collect your name, email, phone, and delivery address — only what is needed to fulfil your orders.' },
            { h: '2. How we use data', p: 'To authenticate you, process orders, notify restaurants, and comply with legal obligations. We never sell your data.' },
            { h: '3. Restaurant visibility', p: 'Restaurants see only the information needed to prepare and deliver your order. They may not access other customers\' data.' },
            { h: '4. Storage & security', p: 'Data is stored securely with row-level security enforced in our database. Access is scoped to your role.' },
            { h: '5. Your rights', p: 'You may request access, correction, or deletion of your personal data at any time from your profile page. See our Account Deletion policy and Refund & Cancellation Policy for details.' },
          ].map((s) => <Section key={s.h} {...s} />)}
        </>
      }
    />
  );
}

export function RefundPolicyPage() {
  return (
    <LegalPage
      title="Refund & Cancellation Policy"
      lastUpdated="June 2026"
      body={
        <>
          {[
            { h: '1. Order cancellation by customer', p: 'You may cancel an order free of charge before the restaurant accepts it (status "pending"). Once accepted, cancellation is at the restaurant\'s discretion and may incur a fee for items already prepared.' },
            { h: '2. Order cancellation by restaurant', p: 'Restaurants may reject a pending order at any time. If they cancel after accepting, Kiyo support will follow up to arrange compensation where applicable.' },
            { h: '3. Refunds (Cash on Delivery)', p: 'Because Kiyo currently operates Cash on Delivery, no cash was collected at order time. If you paid the restaurant directly for a cancelled or undelivered order, contact Kiyo support with your order ID and we will mediate a refund with the restaurant.' },
            { h: '4. Non-delivery or partial delivery', p: 'If your order does not arrive or arrives incomplete, report the issue within 24 hours via your order history. We will investigate with the restaurant and arrange compensation as appropriate.' },
            { h: '5. Quality complaints', p: 'Quality of food is the restaurant\'s responsibility. Kiyo will mediate complaints but cannot guarantee refunds for taste preferences. Substantiated food safety issues will be escalated immediately and may result in restaurant suspension.' },
            { h: '6. Processing time', p: 'Refund resolutions can take up to 7 business days for investigation. You will be notified via the contact method on your account.' },
          ].map((s) => <Section key={s.h} {...s} />)}
        </>
      }
    />
  );
}

export function RestaurantAgreementPage() {
  return (
    <LegalPage
      title="Restaurant Partnership Agreement"
      lastUpdated="June 2026"
      body={
        <>
          {[
            { h: '1. Parties', p: 'This agreement is between Kiyo (the "Platform") and the restaurant owner (the "Partner") whose account is associated with the restaurant profile on the Platform.' },
            { h: '2. Platform role', p: 'Kiyo provides the marketplace technology, customer-facing apps, order routing, and financial calculations. Kiyo does not prepare, package, or deliver food. Kiyo does not employ the restaurant\'s delivery staff.' },
            { h: '3. Partner responsibilities', p: 'The Partner is fully responsible for: (a) food preparation and quality, (b) menu accuracy including prices and availability, (c) all delivery operations including hiring, training, and insuring delivery staff, (d) compliance with local food safety and hygiene regulations, and (e) maintaining valid business licenses and permits.' },
            { h: '4. Delivery operations', p: 'The Partner handles all delivery execution. The Platform only sets the delivery pricing rules shown to customers (per-km rate, minimum fee). The Partner\'s delivery staff must comply with traffic and safety laws.' },
            { h: '5. Commission & fees', p: 'The Platform charges a commission on each completed order, currently set at 7% of (subtotal + delivery fee), plus a 1% platform service fee. These rates are configurable and may change with 30 days written notice. The Partner may review their settlement report from the restaurant dashboard at any time.' },
            { h: '6. Acceptance criteria', p: 'Restaurants created on the Platform start in "pending_approval" status. The Platform reserves the right to publish, hide, or suspend any restaurant based on quality, customer feedback, or compliance concerns. Suspended restaurants receive written notice and have 14 days to remedy.' },
            { h: '7. Data & privacy', p: 'The Partner only sees the customer information needed to fulfil an order (name, phone, delivery address). The Partner may not retain, reuse, or share this data outside of fulfilling the order. Breach of this clause is grounds for immediate suspension.' },
            { h: '8. Term & termination', p: 'This agreement begins when the restaurant is published and continues until either party terminates with 30 days notice. The Platform may terminate immediately for breach, fraud, or food safety violations. Upon termination, final settlement is processed within 30 days.' },
            { h: '9. Liability', p: 'The Partner indemnifies the Platform against claims arising from the Partner\'s food, delivery, or conduct. The Platform\'s liability is capped at the commission earned from the Partner in the preceding 3 months.' },
          ].map((s) => <Section key={s.h} {...s} />)}
        </>
      }
    />
  );
}

export function CookiePolicyPage() {
  return (
    <LegalPage
      title="Cookie Policy"
      lastUpdated="June 2026"
      body={
        <>
          {[
            { h: '1. What cookies we use', p: 'Kiyo uses only essential cookies required for authentication and session persistence (the "kiyo-auth" cookie). We do not currently use analytics, advertising, or tracking cookies.' },
            { h: '2. Session storage', p: 'Your cart and language preference are stored in your browser\'s localStorage. This data never leaves your device unless you place an order or update your profile.' },
            { h: '3. Third-party cookies', p: 'When you sign in with Google OAuth, Google may set cookies on its own domains. These are governed by Google\'s privacy policy, not ours.' },
            { h: '4. If we add analytics', p: 'If we later introduce analytics tools, we will display a cookie consent banner on your first visit and only set non-essential cookies after you opt in. You can withdraw consent at any time via the cookie banner in the footer.' },
            { h: '5. Managing cookies', p: 'You can clear cookies and localStorage at any time from your browser settings. Doing so will sign you out and reset your locale to the platform default (French).' },
          ].map((s) => <Section key={s.h} {...s} />)}
        </>
      }
    />
  );
}

export function AccountDeletionPage() {
  return (
    <LegalPage
      title="Account Deletion Policy"
      lastUpdated="June 2026"
      body={
        <>
          {[
            { h: '1. Your right to delete', p: 'You may delete your Kiyo account at any time from your Profile page. Account deletion is irrevocable after a 14-day grace window.' },
            { h: '2. What gets deleted', p: 'Within 14 days of deletion: your profile, your saved addresses and favorites, and your active session. After 14 days: your account metadata is purged.' },
            { h: '3. What we keep (legal retention)', p: 'Completed orders and their financial records are retained for 7 years to comply with tax and accounting regulations. These records are anonymized — they no longer link to your identity after deletion but remain in the immutable financial ledger for audit.' },
            { h: '4. Reviews & ratings', p: 'Your reviews are anonymized but retained if you wrote any, because other users and restaurants rely on aggregated ratings.' },
            { h: '5. Restaurant owner accounts', p: 'Restaurant owner accounts cannot self-delete if they have an active restaurant. Contact Kiyo support to transfer ownership or close the restaurant first.' },
            { h: '6. Data export', p: 'Before deletion, you can request a full export of your personal data from your Profile page. The export is delivered as a JSON file within 48 hours.' },
          ].map((s) => <Section key={s.h} {...s} />)}
        </>
      }
    />
  );
}
