import type { RestaurantApplicationStatus } from './supabase';

export const RESTAURANT_APPLICATION_TRANSITIONS: Readonly<Record<RestaurantApplicationStatus, readonly RestaurantApplicationStatus[]>> = {
  draft: ['submitted', 'archived'],
  submitted: ['under_review', 'archived'],
  under_review: ['changes_requested', 'preliminarily_approved', 'rejected', 'archived'],
  changes_requested: ['resubmitted', 'archived'],
  resubmitted: ['under_review', 'archived'],
  preliminarily_approved: ['onboarding_in_progress'],
  onboarding_in_progress: ['menu_review', 'changes_requested', 'archived'],
  menu_review: ['ready_to_publish', 'changes_requested', 'archived'],
  ready_to_publish: ['published', 'archived'],
  published: ['suspended'],
  rejected: [],
  suspended: ['onboarding_in_progress', 'published'],
  archived: [],
};

export function canTransitionRestaurantApplication(
  from: RestaurantApplicationStatus,
  to: RestaurantApplicationStatus,
): boolean {
  return RESTAURANT_APPLICATION_TRANSITIONS[from].includes(to);
}

export function isApplicationWaitingOnAdmin(status: RestaurantApplicationStatus): boolean {
  return ['submitted', 'resubmitted', 'under_review', 'menu_review', 'ready_to_publish'].includes(status);
}

export function normalizeRestaurantApplicationStatus(status: string): RestaurantApplicationStatus {
  if (status === 'pending') return 'submitted';
  if (status === 'approved') return 'preliminarily_approved';
  if (status === 'withdrawn') return 'archived';
  return status as RestaurantApplicationStatus;
}
