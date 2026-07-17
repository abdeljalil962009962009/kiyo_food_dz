import { useState } from 'react';
import { X, Star } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useT } from '../lib/i18n-react';
import { Spinner } from './feedback';

type ReviewModalProps = {
  orderId: string;
  restaurantId: string;
  restaurantName: string;
  onClose: () => void;
  onSubmit: () => void;
};

const copy = {
  en: { title: 'How was your order?', comment: 'Comment (optional)', placeholder: 'Tell us what was good or what should improve...', cancel: 'Not now', submit: 'Send review', close: 'Close', error: 'Your review was not sent. Check your connection and try again.' },
  fr: { title: 'Comment \u00e9tait votre commande ?', comment: 'Commentaire (optionnel)', placeholder: 'Dites-nous ce qui \u00e9tait bien ou ce qui doit \u00eatre am\u00e9lior\u00e9...', cancel: 'Pas maintenant', submit: 'Envoyer l\u2019avis', close: 'Fermer', error: 'Votre avis n\u2019a pas \u00e9t\u00e9 envoy\u00e9. V\u00e9rifiez la connexion puis r\u00e9essayez.' },
  ar: { title: '\u0643\u064a\u0641 \u0643\u0627\u0646 \u0637\u0644\u0628\u0643\u061f', comment: '\u062a\u0639\u0644\u064a\u0642 (\u0627\u062e\u062a\u064a\u0627\u0631\u064a)', placeholder: '\u0623\u062e\u0628\u0631\u0646\u0627 \u0645\u0627 \u0627\u0644\u0630\u064a \u0623\u0639\u062c\u0628\u0643 \u0623\u0648 \u0645\u0627 \u0627\u0644\u0630\u064a \u064a\u062c\u0628 \u062a\u062d\u0633\u064a\u0646\u0647...', cancel: '\u0644\u064a\u0633 \u0627\u0644\u0622\u0646', submit: '\u0625\u0631\u0633\u0627\u0644 \u0627\u0644\u062a\u0642\u064a\u064a\u0645', close: '\u0625\u063a\u0644\u0627\u0642', error: '\u0644\u0645 \u064a\u062a\u0645 \u0625\u0631\u0633\u0627\u0644 \u0627\u0644\u062a\u0642\u064a\u064a\u0645. \u062a\u062d\u0642\u0642 \u0645\u0646 \u0627\u0644\u0627\u062a\u0635\u0627\u0644 \u062b\u0645 \u062d\u0627\u0648\u0644 \u0645\u062c\u062f\u062f\u0627.' },
} as const;

export function ReviewModal({ orderId, restaurantId, restaurantName, onClose, onSubmit }: ReviewModalProps) {
  const { locale } = useT();
  const tx = copy[locale];
  const [rating, setRating] = useState(5);
  const [hovered, setHovered] = useState<number | null>(null);
  const [comment, setComment] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    setLoading(true);
    setError(null);
    try {
      const { error: submitError } = await supabase.from('reviews').insert({
        order_id: orderId, restaurant_id: restaurantId, rating, comment: comment.trim() || null,
      });
      if (submitError) throw submitError;
      onSubmit();
    } catch {
      setError(tx.error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => !loading && onClose()}>
      <div className="w-full max-w-md rounded-xl bg-white p-5 shadow-card-lg" onClick={(event) => event.stopPropagation()} role="dialog" aria-modal="true">
        <div className="mb-4 flex items-start justify-between">
          <div><h3 className="font-display text-lg font-bold text-ink-900">{tx.title}</h3><p className="text-sm text-ink-500">{restaurantName}</p></div>
          <button onClick={() => !loading && onClose()} className="flex h-11 w-11 items-center justify-center rounded-lg text-ink-400 hover:bg-ink-100" aria-label={tx.close}><X className="h-4 w-4" /></button>
        </div>
        <div className="mb-4 flex justify-center gap-1" aria-label={tx.title}>
          {[1, 2, 3, 4, 5].map((value) => (
            <button key={value} onClick={() => setRating(value)} onMouseEnter={() => setHovered(value)} onMouseLeave={() => setHovered(null)} disabled={loading} className="flex h-11 w-11 items-center justify-center transition-transform hover:scale-110" aria-label={`${value}/5`}>
              <Star className={`h-8 w-8 ${value <= (hovered ?? rating) ? 'fill-amber-400 text-amber-400' : 'text-ink-200'}`} />
            </button>
          ))}
        </div>
        <label className="mb-1.5 block text-xs font-medium text-ink-600">{tx.comment}</label>
        <textarea value={comment} onChange={(event) => setComment(event.target.value)} placeholder={tx.placeholder} rows={3} className="kiyo-input w-full resize-none" disabled={loading} />
        {error && <p className="mt-3 text-xs text-error-600" role="alert">{error}</p>}
        <div className="mt-4 flex gap-2">
          <button onClick={onClose} disabled={loading} className="kiyo-btn-secondary min-h-11 flex-1">{tx.cancel}</button>
          <button onClick={handleSubmit} disabled={loading || rating === 0} className="kiyo-btn-primary min-h-11 flex-1">{loading ? <Spinner className="h-4 w-4" /> : tx.submit}</button>
        </div>
      </div>
    </div>
  );
}
