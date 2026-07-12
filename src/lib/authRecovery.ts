export const RECOVERY_REQUEST_COOLDOWN_SECONDS = 60;

export type PendingRecovery =
  | { kind: 'token_hash'; value: string }
  | { kind: 'code'; value: string };

export function parsePendingRecovery(url: string): PendingRecovery | null {
  const parsed = new URL(url);
  const hashParams = new URLSearchParams(parsed.hash.replace(/^#/, ''));
  const tokenHash = parsed.searchParams.get('token_hash') ?? hashParams.get('token_hash');
  const type = parsed.searchParams.get('type') ?? hashParams.get('type');

  if (tokenHash && type === 'recovery') {
    return { kind: 'token_hash', value: tokenHash };
  }

  const code = parsed.searchParams.get('code') ?? hashParams.get('code');
  if (code) return { kind: 'code', value: code };

  return null;
}

export function retryAfterSeconds(error: unknown): number | null {
  const message = (error as { message?: string })?.message ?? '';
  const code = (error as { code?: string })?.code ?? '';
  const status = (error as { status?: number })?.status;
  const match = message.match(/(?:after|in|wait)\s+(\d+)\s*(?:seconds?|secs?|s)\b/i)
    ?? message.match(/(\d+)\s*(?:seconds?|secs?)\b/i);

  if (match) return Math.max(1, Number.parseInt(match[1], 10));
  if (
    status === 429
    || code === 'over_email_send_rate_limit'
    || /rate limit|too many|security purposes/i.test(message)
  ) {
    return RECOVERY_REQUEST_COOLDOWN_SECONDS;
  }
  return null;
}

export function cooldownSecondsRemaining(until: number, now = Date.now()): number {
  return Math.max(0, Math.ceil((until - now) / 1000));
}
