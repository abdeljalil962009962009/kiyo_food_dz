import { BadgeCheck, MessageSquareReply, Star } from 'lucide-react';
import type { Locale } from '../lib/i18n';
import type { ReviewRow } from '../lib/supabase';

const copy = {
  en: {
    title: 'Verified customer reviews',
    subtitle: 'Only customers with a delivered Kiyo Food order can leave a review.',
    verified: 'Verified delivery',
    response: 'Restaurant response',
    reply: 'Reply',
    empty: 'No verified reviews yet.',
  },
  fr: {
    title: 'Avis clients vérifiés',
    subtitle: 'Seuls les clients ayant reçu une commande Kiyo Food peuvent publier un avis.',
    verified: 'Livraison vérifiée',
    response: 'Réponse du restaurant',
    reply: 'Répondre',
    empty: 'Aucun avis vérifié pour le moment.',
  },
  ar: {
    title: 'تقييمات العملاء الموثقة',
    subtitle: 'لا يمكن نشر تقييم إلا بعد استلام طلب عبر كيو فود.',
    verified: 'طلب موثق',
    response: 'رد المطعم',
    reply: 'الرد',
    empty: 'لا توجد تقييمات موثقة بعد.',
  },
} as const;

type RestaurantReviewsProps = {
  reviews: ReviewRow[];
  locale: Locale;
  ownerMode?: boolean;
  pendingReviewId?: string | null;
  onReply?: (review: ReviewRow) => void;
};

export function RestaurantReviews({
  reviews,
  locale,
  ownerMode = false,
  pendingReviewId = null,
  onReply,
}: RestaurantReviewsProps) {
  const tx = copy[locale];

  return (
    <section className="mt-6" aria-labelledby="verified-reviews-title">
      <div className="mb-3">
        <h2 id="verified-reviews-title" className="font-display text-lg font-bold text-ink-900">
          {tx.title}
        </h2>
        <p className="mt-1 text-xs leading-5 text-ink-500">{tx.subtitle}</p>
      </div>

      {reviews.length === 0 ? (
        <div className="rounded-lg border border-dashed border-ink-200 bg-ink-50 px-4 py-6 text-center text-sm text-ink-500">
          {tx.empty}
        </div>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {reviews.map((review) => (
            <article key={review.id} className="kiyo-card p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-1" aria-label={`${review.rating} / 5`}>
                  {Array.from({ length: 5 }, (_, index) => (
                    <Star
                      key={index}
                      className={`h-4 w-4 ${
                        index < review.rating
                          ? 'fill-amber-400 text-amber-400'
                          : 'text-ink-200'
                      }`}
                      aria-hidden
                    />
                  ))}
                </div>
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-sage-700">
                  <BadgeCheck className="h-3.5 w-3.5" aria-hidden />
                  {tx.verified}
                </span>
              </div>

              {review.comment && (
                <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-ink-700">
                  {review.comment}
                </p>
              )}
              <time className="mt-2 block text-[11px] text-ink-400" dateTime={review.created_at}>
                {new Intl.DateTimeFormat(locale === 'ar' ? 'ar-DZ' : locale, {
                  dateStyle: 'medium',
                }).format(new Date(review.created_at))}
              </time>

              {review.owner_reply && (
                <div className="mt-3 rounded-lg border-s-2 border-s-ember-500 bg-ember-50/70 px-3 py-2.5">
                  <p className="text-[11px] font-bold uppercase text-ember-700">{tx.response}</p>
                  <p className="mt-1 whitespace-pre-wrap text-sm leading-5 text-ink-700">
                    {review.owner_reply}
                  </p>
                </div>
              )}

              {ownerMode && onReply && (
                <button
                  type="button"
                  onClick={() => onReply(review)}
                  disabled={pendingReviewId === review.id}
                  className="kiyo-btn-secondary mt-3 min-h-11 text-xs"
                >
                  <MessageSquareReply className="h-4 w-4" aria-hidden />
                  {tx.reply}
                </button>
              )}
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
