export const MAX_ACTION_ARGS_BYTES = 250_000;

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type Headers = Record<string, string | string[] | undefined>;

export type ParsedActionRequest = {
  action: string;
  requestId: string;
  args: Record<string, unknown>;
};

export function bearerToken(headers: Headers) {
  const value = headers.authorization;
  const header = Array.isArray(value) ? value[0] : value;
  if (!header) return null;
  const match = /^Bearer\s+(.+)$/i.exec(header.trim());
  return match?.[1]?.trim() || null;
}

export function parseActionRequest(
  body: unknown,
  allowedActions: ReadonlySet<string>,
): ParsedActionRequest | null {
  const payload = body && typeof body === 'object' && !Array.isArray(body)
    ? body as Record<string, unknown>
    : {};
  const action = typeof payload.action === 'string' ? payload.action : '';
  const requestId = typeof payload.requestId === 'string' ? payload.requestId : '';
  const args = payload.args && typeof payload.args === 'object' && !Array.isArray(payload.args)
    ? payload.args as Record<string, unknown>
    : {};

  if (!allowedActions.has(action) || !UUID_PATTERN.test(requestId)) return null;

  try {
    const byteLength = new TextEncoder().encode(JSON.stringify(args)).byteLength;
    if (byteLength > MAX_ACTION_ARGS_BYTES) return null;
  } catch {
    return null;
  }

  return { action, requestId, args };
}

export function statusForDatabaseError(code?: string) {
  if (code === '42501') return 403;
  if (code === 'P0002') return 404;
  if (code === '22023' || code === '22P02' || code === '23514') return 400;
  if (code === 'PT409' || code === '40001' || code === '23505') return 409;
  return 422;
}
