import { beforeEach, describe, expect, it, vi } from 'vitest';

const { createClientMock } = vi.hoisted(() => ({ createClientMock: vi.fn() }));

vi.mock('@supabase/supabase-js', () => ({ createClient: createClientMock }));

import adminHandler from './admin-action.js';
import userHandler from './user-action.js';

const ACTOR_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const REQUEST_ID = '11111111-1111-4111-8111-111111111111';

function makeResponse() {
  const state: { status: number; body: unknown } = { status: 200, body: null };
  const response = {
    setHeader: vi.fn(),
    status: vi.fn((code: number) => {
      state.status = code;
      return response;
    }),
    json: vi.fn((body: unknown) => {
      state.body = body;
    }),
  };
  return { response, state };
}

function queueClients(profile: Record<string, unknown>, rpcResult: Record<string, unknown> = { data: { ok: true }, error: null }) {
  const getUser = vi.fn().mockResolvedValue({ data: { user: { id: ACTOR_ID } }, error: null });
  const maybeSingle = vi.fn().mockResolvedValue({ data: profile, error: null });
  const eq = vi.fn().mockReturnValue({ maybeSingle });
  const select = vi.fn().mockReturnValue({ eq });
  const rpc = vi.fn().mockResolvedValue(rpcResult);
  createClientMock
    .mockReturnValueOnce({ auth: { getUser } })
    .mockReturnValueOnce({ from: vi.fn().mockReturnValue({ select }), rpc });
  return { getUser, rpc };
}

beforeEach(() => {
  createClientMock.mockReset();
  vi.stubEnv('VITE_SUPABASE_URL', 'https://staging.supabase.co');
  vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'staging-anon');
  vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'staging-service');
});

describe('owner action gateway', () => {
  it('rejects an ordinary customer before any privileged RPC is called', async () => {
    const { rpc } = queueClients({ id: ACTOR_ID, role: 'customer', is_suspended: false });
    const { response, state } = makeResponse();

    await adminHandler({
      method: 'POST',
      headers: { authorization: 'Bearer customer-token' },
      body: { action: 'publish_restaurant', requestId: REQUEST_ID, args: {} },
    }, response);

    expect(state.status).toBe(403);
    expect(state.body).toMatchObject({ code: 'owner_access_required' });
    expect(rpc).not.toHaveBeenCalled();
  });

  it('uses the verified owner identity instead of accepting an actor from the payload', async () => {
    const { rpc } = queueClients({ id: ACTOR_ID, role: 'super_admin', is_suspended: false });
    const { response, state } = makeResponse();

    await adminHandler({
      method: 'POST',
      headers: { authorization: 'Bearer owner-token' },
      body: {
        action: 'publish_restaurant',
        requestId: REQUEST_ID,
        args: { p_restaurant_id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' },
        actorId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
      },
    }, response);

    expect(state.status).toBe(200);
    expect(rpc).toHaveBeenCalledWith('execute_owner_action', {
      p_actor_id: ACTOR_ID,
      p_request_id: REQUEST_ID,
      p_action: 'publish_restaurant',
      p_args: { p_restaurant_id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' },
    });
  });

  it('routes settlement generation only through the verified owner boundary', async () => {
    const { rpc } = queueClients({ id: ACTOR_ID, role: 'super_admin', is_suspended: false });
    const { response, state } = makeResponse();
    const args = {
      p_restaurant_id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      p_period_start: '2026-07-01',
    };

    await adminHandler({
      method: 'POST',
      headers: { authorization: 'Bearer owner-token' },
      body: { action: 'generate_monthly_settlement', requestId: REQUEST_ID, args },
    }, response);

    expect(state.status).toBe(200);
    expect(rpc).toHaveBeenCalledWith('execute_owner_action', {
      p_actor_id: ACTOR_ID,
      p_request_id: REQUEST_ID,
      p_action: 'generate_monthly_settlement',
      p_args: args,
    });
  });

  it('routes driver review through the locked service-only review function', async () => {
    const { rpc } = queueClients({ id: ACTOR_ID, role: 'super_admin', is_suspended: false });
    const { response, state } = makeResponse();
    const args = {
      p_driver_id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      p_target_status: 'approved',
      p_expected_version: 0,
    };

    await adminHandler({
      method: 'POST',
      headers: { authorization: 'Bearer owner-token' },
      body: { action: 'review_driver_application', requestId: REQUEST_ID, args },
    }, response);

    expect(state.status).toBe(200);
    expect(rpc).toHaveBeenCalledWith('review_driver_application', {
      p_actor_id: ACTOR_ID,
      p_driver_id: args.p_driver_id,
      p_target_status: 'approved',
      p_reason: null,
      p_expected_version: 0,
    });
  });

  it('rejects oversized owner payloads before authentication or database access', async () => {
    const { response, state } = makeResponse();
    await adminHandler({
      method: 'POST',
      headers: { authorization: 'Bearer owner-token' },
      body: {
        action: 'update_platform_setting',
        requestId: REQUEST_ID,
        args: { value: 'x'.repeat(250_001) },
      },
    }, response);
    expect(state.status).toBe(400);
    expect(createClientMock).not.toHaveBeenCalled();
  });
});

describe('user action gateway', () => {
  it('rejects a suspended account before the canonical RPC is called', async () => {
    const { rpc } = queueClients({ id: ACTOR_ID, is_suspended: true });
    const { response, state } = makeResponse();

    await userHandler({
      method: 'POST',
      headers: { authorization: 'Bearer suspended-token' },
      body: { action: 'request_personal_data_export', requestId: REQUEST_ID, args: {} },
    }, response);

    expect(state.status).toBe(403);
    expect(rpc).not.toHaveBeenCalled();
  });

  it('forwards an allowlisted action with the independently verified actor', async () => {
    const { rpc } = queueClients({ id: ACTOR_ID, is_suspended: false });
    const { response, state } = makeResponse();

    await userHandler({
      method: 'POST',
      headers: { authorization: 'Bearer customer-token' },
      body: {
        action: 'submit_restaurant_application',
        requestId: REQUEST_ID,
        args: { p_payload: { restaurant_name: 'Kiyo Test' } },
      },
    }, response);

    expect(state.status).toBe(200);
    expect(rpc).toHaveBeenCalledWith('execute_user_action', {
      p_actor_id: ACTOR_ID,
      p_request_id: REQUEST_ID,
      p_action: 'submit_restaurant_application',
      p_args: { p_payload: { restaurant_name: 'Kiyo Test' } },
    });
  });

  it('submits driver applications only through the verified server identity', async () => {
    const { rpc } = queueClients({ id: ACTOR_ID, is_suspended: false });
    const { response, state } = makeResponse();
    const submissionKey = '22222222-2222-4222-8222-222222222222';
    const payload = { vehicle_type: 'bicycle', documents: [] };

    await userHandler({
      method: 'POST',
      headers: { authorization: 'Bearer driver-token' },
      body: {
        action: 'submit_driver_application',
        requestId: REQUEST_ID,
        args: { p_payload: payload, p_submission_key: submissionKey },
      },
    }, response);

    expect(state.status).toBe(200);
    expect(rpc).toHaveBeenCalledWith('submit_driver_application', {
      p_actor_id: ACTOR_ID,
      p_payload: payload,
      p_submission_key: submissionKey,
    });
  });

  it('submits reviews only through the verified customer identity', async () => {
    const { rpc } = queueClients({ id: ACTOR_ID, is_suspended: false });
    const { response, state } = makeResponse();
    const args = {
      p_order_id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      p_rating: 5,
      p_comment: 'Careful packaging.',
    };

    await userHandler({
      method: 'POST',
      headers: { authorization: 'Bearer customer-token' },
      body: { action: 'submit_order_review', requestId: REQUEST_ID, args },
    }, response);

    expect(state.status).toBe(200);
    expect(rpc).toHaveBeenCalledWith('submit_order_review', {
      p_actor_id: ACTOR_ID,
      p_order_id: args.p_order_id,
      p_rating: 5,
      p_comment: 'Careful packaging.',
    });
  });

  it('routes restaurant review replies through the verified account', async () => {
    const { rpc } = queueClients({ id: ACTOR_ID, is_suspended: false });
    const { response, state } = makeResponse();

    await userHandler({
      method: 'POST',
      headers: { authorization: 'Bearer restaurant-token' },
      body: {
        action: 'reply_to_restaurant_review',
        requestId: REQUEST_ID,
        args: {
          p_review_id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
          p_reply: 'Thank you for your feedback.',
        },
      },
    }, response);

    expect(state.status).toBe(200);
    expect(rpc).toHaveBeenCalledWith('reply_to_restaurant_review', {
      p_actor_id: ACTOR_ID,
      p_review_id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      p_reply: 'Thank you for your feedback.',
    });
  });

  it('does not allow a customer to route an owner action through the user endpoint', async () => {
    const { response, state } = makeResponse();
    await userHandler({
      method: 'POST',
      headers: { authorization: 'Bearer customer-token' },
      body: { action: 'mark_settlement_paid', requestId: REQUEST_ID, args: {} },
    }, response);
    expect(state.status).toBe(400);
    expect(createClientMock).not.toHaveBeenCalled();
  });
});
