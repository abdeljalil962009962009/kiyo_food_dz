import type { ReviewRow } from './supabase';

type ReviewChange = {
  eventType: string;
  new: Record<string, unknown>;
  old: Record<string, unknown>;
};

export function applyReviewChange(current: ReviewRow[], change: ReviewChange): ReviewRow[] {
  const removedId = typeof change.old.id === 'string' ? change.old.id : null;
  const nextId = typeof change.new.id === 'string' ? change.new.id : null;

  if (change.eventType === 'DELETE' || change.new.is_hidden === true) {
    const id = nextId ?? removedId;
    return id ? current.filter((review) => review.id !== id) : current;
  }
  if (!nextId) return current;

  const nextReview = change.new as ReviewRow;
  const withoutExisting = current.filter((review) => review.id !== nextId);
  return [nextReview, ...withoutExisting]
    .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at));
}
