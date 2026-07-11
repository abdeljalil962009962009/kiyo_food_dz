export type ConnectionQuality = 'offline' | 'slow' | 'online';

export type NetworkInformationLike = {
  effectiveType?: string;
  downlink?: number;
  saveData?: boolean;
};

export function getConnectionQuality(
  online: boolean,
  connection?: NetworkInformationLike | null,
): ConnectionQuality {
  if (!online) return 'offline';
  if (!connection) return 'online';
  if (connection.saveData) return 'slow';
  if (connection.effectiveType === 'slow-2g' || connection.effectiveType === '2g' || connection.effectiveType === '3g') return 'slow';
  if (typeof connection.downlink === 'number' && connection.downlink > 0 && connection.downlink < 1) return 'slow';
  return 'online';
}

export function isRetryableMapError(error: unknown): boolean {
  const value = String(
    typeof error === 'object' && error && 'code' in error
      ? (error as { code?: unknown }).code
      : typeof error === 'object' && error && 'message' in error
        ? (error as { message?: unknown }).message
        : error,
  ).toUpperCase();

  return ![
    'REQUEST_DENIED',
    'INVALID_REQUEST',
    'ZERO_RESULTS',
    'API_NOT_ACTIVATED',
    'INVALID_KEY',
    'REFERER_NOT_ALLOWED',
  ].some((code) => value.includes(code));
}

export async function withTimeout<T>(
  operation: () => Promise<T>,
  timeoutMs: number,
): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      operation(),
      new Promise<T>((_, reject) => {
        timeoutId = setTimeout(() => reject(new Error('map_request_timeout')), timeoutMs);
      }),
    ]);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

export async function withExponentialBackoff<T>(
  operation: () => Promise<T>,
  options: {
    attempts?: number;
    baseDelayMs?: number;
    timeoutMs?: number;
    shouldRetry?: (error: unknown) => boolean;
  } = {},
): Promise<T> {
  const attempts = Math.max(1, options.attempts ?? 3);
  const baseDelayMs = Math.max(0, options.baseDelayMs ?? 650);
  const timeoutMs = Math.max(1000, options.timeoutMs ?? 12000);
  const shouldRetry = options.shouldRetry ?? isRetryableMapError;
  let lastError: unknown;

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      return await withTimeout(operation, timeoutMs);
    } catch (error) {
      lastError = error;
      if (attempt === attempts - 1 || !shouldRetry(error)) throw error;
      const delay = baseDelayMs * 2 ** attempt;
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}
