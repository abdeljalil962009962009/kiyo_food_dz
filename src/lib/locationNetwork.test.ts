import { describe, expect, it, vi } from 'vitest';
import { getConnectionQuality, isRetryableMapError, withExponentialBackoff } from './locationNetwork';

describe('location network resilience', () => {
  it('classifies offline, constrained, and normal connections', () => {
    expect(getConnectionQuality(false)).toBe('offline');
    expect(getConnectionQuality(true, { effectiveType: '2g' })).toBe('slow');
    expect(getConnectionQuality(true, { effectiveType: '3g' })).toBe('slow');
    expect(getConnectionQuality(true, { downlink: 0.7 })).toBe('slow');
    expect(getConnectionQuality(true, { effectiveType: '4g', downlink: 8 })).toBe('online');
  });

  it('does not retry permanent Google configuration failures', () => {
    expect(isRetryableMapError(new Error('REQUEST_DENIED'))).toBe(false);
    expect(isRetryableMapError(new Error('temporary network failure'))).toBe(true);
  });

  it('retries transient failures and returns the successful result', async () => {
    const operation = vi.fn()
      .mockRejectedValueOnce(new Error('temporary network failure'))
      .mockResolvedValue('ok');
    await expect(withExponentialBackoff(operation, { baseDelayMs: 0 })).resolves.toBe('ok');
    expect(operation).toHaveBeenCalledTimes(2);
  });
});
