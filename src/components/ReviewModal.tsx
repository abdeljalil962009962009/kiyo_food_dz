import { useState } from 'react';
import { X, Star } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { Spinner } from './feedback';

type ReviewModalProps = {
  orderId: string;
  restaurantId: string;
  restaurantName: string;
  onClose: () => void;
  onSubmit: () => void;
};

export function ReviewModal({ orderId, restaurantId, restaurantName, onClose, onSubmit }: ReviewModalProps) {
  const [rating, setRating] = useState(5);
  const [hovered, setHovered] = useState<number | null>(null);
  const [comment, setComment] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    setLoading(true);
    setError(null);
    try {
      const { error: e } = await supabase
        .from('reviews')
        .insert({
          order_id: orderId,
          restaurant_id: restaurantId,
          rating,
          comment: comment.trim() || null,
        });
      if (e) throw e;
      onSubmit();
    } catch {
      setError('Failed to submit review. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={() => !loading && onClose()}
    >
      <div
        className="w-full max-w-md rounded-2xl bg-white p-5 shadow-card-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between">
          <div>
            <h3 className="font-display text-lg font-bold text-ink-900">
              Rate your order
            </h3>
            <p className="text-sm text-ink-500">{restaurantName}</p>
          </div>
          <button
            onClick={() => !loading && onClose()}
            className="rounded p-1 text-ink-400 hover:bg-ink-100"
            aria-label="close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Star rating */}
        <div className="mb-4 flex justify-center gap-1">
          {[1, 2, 3, 4, 5].map((i) => (
            <button
              key={i}
              onClick={() => setRating(i)}
              onMouseEnter={() => setHovered(i)}
              onMouseLeave={() => setHovered(null)}
              disabled={loading}
              className="p-1 transition-transform hover:scale-110"
            >
              <Star
                className={`h-8 w-8 ${
                  i <= (hovered ?? rating)
                    ? 'fill-amber-400 text-amber-400'
                    : 'text-ink-200'
                }`}
              />
            </button>
          ))}
        </div>

        {/* Comment */}
        <div className="mb-4">
          <label className="mb-1.5 block text-xs font-medium text-ink-600">
            Leave a comment (optional)
          </label>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Tell others about your experience..."
            rows={3}
            className="kiyo-input w-full resize-none"
            disabled={loading}
          />
        </div>

        {error && (
          <p className="mb-3 text-xs text-error-600">{error}</p>
        )}

        <div className="flex gap-2">
          <button
            onClick={onClose}
            disabled={loading}
            className="kiyo-btn-secondary flex-1"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading || rating === 0}
            className="kiyo-btn-primary flex-1"
          >
            {loading ? <Spinner size="sm" /> : 'Submit Review'}
          </button>
        </div>
      </div>
    </div>
  );
}
