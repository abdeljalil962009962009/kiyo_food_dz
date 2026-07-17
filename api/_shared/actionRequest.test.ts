import { describe, expect, it } from 'vitest';
import {
  bearerToken,
  MAX_ACTION_ARGS_BYTES,
  parseActionRequest,
  statusForDatabaseError,
} from './actionRequest';

const ACTIONS = new Set(['allowed_action']);
const REQUEST_ID = '11111111-1111-4111-8111-111111111111';

describe('trusted action request validation', () => {
  it('accepts a case-insensitive Bearer token and rejects other schemes', () => {
    expect(bearerToken({ authorization: 'bearer secure-token' })).toBe('secure-token');
    expect(bearerToken({ authorization: 'Basic secure-token' })).toBeNull();
  });

  it('accepts only allowlisted actions with a structurally valid UUID', () => {
    expect(parseActionRequest({
      action: 'allowed_action',
      requestId: REQUEST_ID,
      args: { value: 1 },
    }, ACTIONS)).toEqual({
      action: 'allowed_action',
      requestId: REQUEST_ID,
      args: { value: 1 },
    });
    expect(parseActionRequest({ action: 'owner_only', requestId: REQUEST_ID }, ACTIONS)).toBeNull();
    expect(parseActionRequest({ action: 'allowed_action', requestId: 'not-a-uuid' }, ACTIONS)).toBeNull();
  });

  it('rejects payloads above the shared UTF-8 byte limit', () => {
    const oversized = 'x'.repeat(MAX_ACTION_ARGS_BYTES + 1);
    expect(parseActionRequest({
      action: 'allowed_action',
      requestId: REQUEST_ID,
      args: { oversized },
    }, ACTIONS)).toBeNull();
  });

  it('maps authorization, validation, conflict, and missing-row errors consistently', () => {
    expect(statusForDatabaseError('42501')).toBe(403);
    expect(statusForDatabaseError('P0002')).toBe(404);
    expect(statusForDatabaseError('23514')).toBe(400);
    expect(statusForDatabaseError('40001')).toBe(409);
    expect(statusForDatabaseError('unexpected')).toBe(422);
  });
});
