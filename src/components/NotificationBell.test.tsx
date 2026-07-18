import { describe, expect, it } from 'vitest';
import { localizeNotification } from './NotificationBell';
import type { Notification } from '../lib/supabase';

function notification(overrides: Partial<Notification>): Notification {
  return {
    id: 'notification-1',
    user_id: 'user-1',
    type: 'system',
    title: 'New update',
    body: 'Open Kiyo Food for details.',
    metadata: {},
    is_read: false,
    created_at: '2026-07-18T10:00:00.000Z',
    ...overrides,
  };
}

describe('notification localization', () => {
  it('localizes legacy applicant-replied rows instead of showing stored English in Arabic', () => {
    const display = localizeNotification(notification({
      type: 'legacy_admin_notice',
      title: 'Applicant replied',
      body: 'Bonjour, je confirme que les horaires sont valides.',
      metadata: { restaurant_name: 'Kiyo Test' },
    }), 'ar');

    expect(display.title).toBe('\u0631\u0633\u0627\u0644\u0629 \u062d\u0648\u0644 \u0637\u0644\u0628 \u0645\u0637\u0639\u0645');
    expect(display.body).not.toContain('Bonjour');
    expect(display.body).toContain('Kiyo Test');
  });

  it('localizes legacy waiting-for-review rows instead of showing stored English in Arabic', () => {
    const display = localizeNotification(notification({
      type: 'legacy_admin_notice',
      title: 'Restaurant application waiting for review',
      body: 'Kiyo E2E Test Restaurant',
      metadata: { restaurant_name: 'Kiyo E2E Test Restaurant' },
    }), 'ar');

    expect(display.title).toBe('\u0637\u0644\u0628 \u0645\u0637\u0639\u0645 \u0628\u0627\u0646\u062a\u0638\u0627\u0631 \u0627\u0644\u0645\u0631\u0627\u062c\u0639\u0629');
    expect(display.body).not.toContain('Restaurant application waiting');
    expect(display.body).toContain('Kiyo E2E Test Restaurant');
  });

  it('uses localized templates for application review notifications', () => {
    const display = localizeNotification(notification({
      type: 'application_submitted',
      title: 'Restaurant application waiting for review',
      body: 'Kiyo E2E Test Restaurant',
      metadata: { restaurant_name: 'Kiyo E2E Test Restaurant' },
    }), 'fr');

    expect(display.title).toBe('Demande restaurant \u00e0 examiner');
    expect(display.body).toContain('Kiyo E2E Test Restaurant');
  });
});
