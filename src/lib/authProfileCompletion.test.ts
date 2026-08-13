import { describe, expect, it } from 'vitest';
import { isGoogleIdentity, requiresGooglePhoneCompletion } from './authProfileCompletion';

describe('Google profile completion', () => {
  it('recognizes Google as the primary provider', () => {
    expect(isGoogleIdentity({ app_metadata: { provider: 'google' } })).toBe(true);
  });

  it('recognizes Google in linked providers', () => {
    expect(isGoogleIdentity({ app_metadata: { providers: ['email', 'google'] } })).toBe(true);
  });

  it('does not gate password-only accounts', () => {
    expect(requiresGooglePhoneCompletion(
      { app_metadata: { provider: 'email', providers: ['email'] } },
      null,
    )).toBe(false);
  });

  it('gates Google users until an Algerian mobile number is saved', () => {
    const user = { app_metadata: { provider: 'google', providers: ['google'] } };
    expect(requiresGooglePhoneCompletion(user, null)).toBe(true);
    expect(requiresGooglePhoneCompletion(user, '0550 12 34 56')).toBe(false);
  });
});
