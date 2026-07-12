import { describe, expect, it } from 'vitest';
import { isValidAlgerianPhone, normalizeAlgerianPhone } from './phone';

describe('Algerian phone numbers', () => {
  it.each([
    ['0551 23 45 67', '+213551234567'],
    ['06-61-23-45-67', '+213661234567'],
    ['0771.23.45.67', '+213771234567'],
    ['+213 551 23 45 67', '+213551234567'],
    ['00213 (661) 23 45 67', '+213661234567'],
    ['+213 0 771 23 45 67', '+213771234567'],
  ])('normalizes %s', (input, expected) => {
    expect(normalizeAlgerianPhone(input)).toBe(expected);
  });

  it.each(['', '041234567', '0812345678', '+33123456789', '06AB123456', '06123456'])('rejects %s', (input) => {
    expect(isValidAlgerianPhone(input)).toBe(false);
  });
});
