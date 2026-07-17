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
  'create_order_with_items',
  'get_restaurant_analytics_summary',
  'get_restaurant_financials',
  'get_restaurant_publication_readiness',
  'get_top_products',
  'mark_restaurant_application_messages_read',
  'quote_delivery_order_by_route',
  'reply_to_ticket',
  'request_account_deletion',
  'request_personal_data_export',
  'send_restaurant_application_message',
  'submit_restaurant_application',
  'transition_delivery_status',
  'transition_order_status',
  'update_driver_live_location',
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
    response.status(503).json({ code: 'server_not_configured', message: 'Secure operations are temporarily unavailable.' });
    return;
  }

  const token = bearerToken(request.headers);
  if (!token) {
    response.status(401).json({ code: 'authentication_required', message: 'Sign in again.' });
    return;
  }

  const parsed = parseActionRequest(request.body, ALLOWED_ACTIONS);
  if (!parsed) {
    response.status(400).json({ code: 'invalid_user_action', message: 'The secure action request is invalid.' });
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
    .select('id,is_suspended')
    .eq('id', authData.user.id)
    .maybeSingle();
  if (profileError || !profile || profile.is_suspended) {
    response.status(403).json({ code: 'active_account_required', message: 'This action requires an active account.' });
    return;
  }

  const { data, error } = await serviceClient.rpc('execute_user_action', {
    p_actor_id: authData.user.id,
    p_request_id: requestId,
    p_action: action,
    p_args: args,
  });
  if (error) {
    response.status(statusForDatabaseError(error.code)).json({
      code: error.code ?? 'user_action_failed',
      message: error.message,
    });
    return;
  }

  response.status(200).json({ data });
}
