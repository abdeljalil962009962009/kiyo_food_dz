import { supabase } from './supabase';

export type AdminActionResult<T = unknown> = {
  data: T | null;
  error: { message: string; code?: string } | null;
};

export async function callAdminAction<T = unknown>(
  action: string,
  args: Record<string, unknown> = {},
): Promise<AdminActionResult<T>> {
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token;
  if (!token) return { data: null, error: { code: 'authentication_required', message: 'Sign in again.' } };

  try {
    const response = await fetch('/api/admin-action', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ action, args, requestId: crypto.randomUUID() }),
    });
    const payload = await response.json().catch(() => null) as {
      data?: T;
      code?: string;
      message?: string;
    } | null;
    if (!response.ok) {
      return {
        data: null,
        error: {
          code: payload?.code ?? 'admin_action_failed',
          message: payload?.message ?? 'The owner action could not be completed.',
        },
      };
    }
    return { data: payload?.data ?? null, error: null };
  } catch {
    return {
      data: null,
      error: { code: 'network_error', message: 'The owner action could not reach the secure server. Try again.' },
    };
  }
}
