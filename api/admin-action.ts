import { createClient } from '@supabase/supabase-js';
import { bearerToken, parseActionRequest, statusForDatabaseError } from './_shared/actionRequest.js';

declare const process: { env: Record<string, string | undefined> };

export const config = { maxDuration: 30 };

type RequestLike = {
  method?: string;
  headers: Record<string, string | string[] | undefined>;
  body?: unknown;
};

type ResponseLike = {
  status(code: number): ResponseLike;
  json(body: unknown): void;
  setHeader(name: string, value: string): void;
};

const ALLOWED_ACTIONS = new Set([
  'get_platform_analytics',
  'get_admin_alerts',
  'get_settlement_overview',
  'generate_monthly_settlement',
  'mark_settlement_paid',
  'set_user_suspended',
  'update_restaurant_admin',
  'update_platform_setting',
  'update_ticket_status',
  'review_restaurant_application',
  'preliminarily_approve_restaurant_application',
  'publish_restaurant',
  'update_restaurant_application_internal_notes',
  'set_restaurant_status',
  'set_marketplace_rule_override',
  'remove_marketplace_rule_override',
]);

export default async function handler(request: RequestLike, response: ResponseLike) {
  response.setHeader('Cache-Control', 'no-store');
  response.setHeader('Content-Type', 'application/json; charset=utf-8');
  if (request.method !== 'POST') {
    response.status(405).json({ code: 'method_not_allowed', message: 'Use POST.' });
    return;
  }

  const supabaseUrl = process.env.VITE_SUPABASE_URL?.replace(/\/+$/, '');
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    response.status(503).json({ code: 'server_not_configured', message: 'Owner operations are temporarily unavailable.' });
    return;
  }

  const token = bearerToken(request.headers);
  if (!token) {
    response.status(401).json({ code: 'authentication_required', message: 'Sign in again.' });
    return;
  }

  const parsed = parseActionRequest(request.body, ALLOWED_ACTIONS);
  if (!parsed) {
    response.status(400).json({ code: 'invalid_admin_action', message: 'The owner action request is invalid.' });
    return;
  }
  const { action, requestId, args } = parsed;

  const authClient = createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: authData, error: authError } = await authClient.auth.getUser(token);
  if (authError || !authData.user) {
    response.status(401).json({ code: 'invalid_session', message: 'Your session expired. Sign in again.' });
    return;
  }

  const serviceClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: profile, error: profileError } = await serviceClient
    .from('profiles')
    .select('id,role,is_suspended')
    .eq('id', authData.user.id)
    .maybeSingle();
  if (profileError || !profile || profile.role !== 'super_admin' || profile.is_suspended) {
    response.status(403).json({ code: 'owner_access_required', message: 'Only an active platform owner can perform this action.' });
    return;
  }

  const { data, error } = await serviceClient.rpc('execute_owner_action', {
    p_actor_id: authData.user.id,
    p_request_id: requestId,
    p_action: action,
    p_args: args,
  });
  if (error) {
    response.status(statusForDatabaseError(error.code)).json({
      code: error.code ?? 'admin_action_failed',
      message: error.message,
    });
    return;
  }

  response.status(200).json({ data });
}
