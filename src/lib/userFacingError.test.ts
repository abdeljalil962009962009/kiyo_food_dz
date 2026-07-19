import { describe, expect, it } from 'vitest';
import { userFacingError } from './userFacingError';

describe('userFacingError', () => {
  it('never exposes raw database details', () => {
    const message = userFacingError(
      { message: 'permission denied for function public.secret_rpc', code: '42501' },
      'en',
      'Please try again.',
    );
    expect(message).toContain('not available for your account');
    expect(message).not.toContain('public.secret_rpc');
  });

  it('localizes network and timeout recovery', () => {
    expect(userFacingError(new TypeError('Failed to fetch'), 'fr', 'fallback')).toContain('hors ligne');
    expect(userFacingError(new DOMException('aborted', 'AbortError'), 'ar', 'fallback')).toContain('أطول من المتوقع');
  });

  it('uses the supplied contextual fallback for unknown failures', () => {
    expect(userFacingError(new Error('unexpected vendor failure'), 'en', 'Order could not be placed.'))
      .toBe('Order could not be placed.');
  });
});
