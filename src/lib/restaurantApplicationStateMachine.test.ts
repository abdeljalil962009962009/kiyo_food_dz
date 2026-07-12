import { describe, expect, it } from 'vitest';
import {
  canTransitionRestaurantApplication,
  isApplicationWaitingOnAdmin,
  normalizeRestaurantApplicationStatus,
} from './restaurantApplicationStateMachine';

describe('restaurant application state machine', () => {
  it('normalizes legacy statuses without losing records', () => {
    expect(normalizeRestaurantApplicationStatus('pending')).toBe('submitted');
    expect(normalizeRestaurantApplicationStatus('approved')).toBe('preliminarily_approved');
    expect(normalizeRestaurantApplicationStatus('withdrawn')).toBe('archived');
  });

  it('permits the canonical review path', () => {
    expect(canTransitionRestaurantApplication('submitted', 'under_review')).toBe(true);
    expect(canTransitionRestaurantApplication('under_review', 'preliminarily_approved')).toBe(true);
    expect(canTransitionRestaurantApplication('menu_review', 'ready_to_publish')).toBe(true);
    expect(canTransitionRestaurantApplication('ready_to_publish', 'published')).toBe(true);
  });

  it('blocks skipped or unsafe transitions', () => {
    expect(canTransitionRestaurantApplication('submitted', 'published')).toBe(false);
    expect(canTransitionRestaurantApplication('changes_requested', 'published')).toBe(false);
    expect(canTransitionRestaurantApplication('published', 'rejected')).toBe(false);
  });

  it('identifies the owner review queue', () => {
    expect(isApplicationWaitingOnAdmin('submitted')).toBe(true);
    expect(isApplicationWaitingOnAdmin('ready_to_publish')).toBe(true);
    expect(isApplicationWaitingOnAdmin('changes_requested')).toBe(false);
  });
});
