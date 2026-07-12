import { describe, expect, it } from 'vitest';
import {
  RECOVERY_REQUEST_COOLDOWN_SECONDS,
  cooldownSecondsRemaining,
  parsePendingRecovery,
  retryAfterSeconds,
} from './authRecovery';

describe('password recovery helpers', () => {
  it('parses scanner-safe recovery token hashes', () => {
    expect(parsePendingRecovery(
      'https://kiyo-food.store/reset-password?token_hash=secure-hash&type=recovery',
    )).toEqual({ kind: 'token_hash', value: 'secure-hash' });
  });

  it('rejects a token hash for another auth purpose', () => {
    expect(parsePendingRecovery(
      'https://kiyo-food.store/reset-password?token_hash=secure-hash&type=signup',
    )).toBeNull();
  });

  it('keeps compatibility with PKCE recovery codes', () => {
    expect(parsePendingRecovery(
      'https://kiyo-food.store/reset-password?code=legacy-code',
    )).toEqual({ kind: 'code', value: 'legacy-code' });
  });

  it('extracts the server retry duration', () => {
    expect(retryAfterSeconds({
      code: 'over_email_send_rate_limit',
      message: 'For security purposes, you can only request this after 43 seconds.',
      status: 429,
    })).toBe(43);
  });

  it('uses a safe default for rate-limit errors without a duration', () => {
    expect(retryAfterSeconds({ status: 429, message: 'Too many requests' }))
      .toBe(RECOVERY_REQUEST_COOLDOWN_SECONDS);
  });

  it('rounds the visible cooldown up and never returns a negative value', () => {
    expect(cooldownSecondsRemaining(61_001, 1_001)).toBe(60);
    expect(cooldownSecondsRemaining(1_000, 1_001)).toBe(0);
  });
});
