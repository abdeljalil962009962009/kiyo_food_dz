import { supabase } from './supabase';

export type UserActionResult<T = unknown> = {
  data: T | null;
  error: { message: string; code?: string } | null;
};

type UserActionOptions = {
  signal?: AbortSignal;
};

export async function callUserAction<T = unknown>(
  action: string,
  args: Record<string, unknown> = {},
  options: UserActionOptions = {},
): Promise<UserActionResult<T>> {
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token;
  if (!token) return { data: null, error: { code: 'authentication_required', message: 'Sign in again.' } };

  try {
    const response = await fetch('/api/user-action', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ action, args, requestId: crypto.randomUUID() }),
      signal: options.signal,
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
          code: payload?.code ?? 'user_action_failed',
          message: payload?.message ?? 'The secure action could not be completed.',
        },
      };
    }
    return { data: payload?.data ?? null, error: null };
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error;
    return {
      data: null,
      error: { code: 'network_error', message: 'The secure server could not be reached. Try again.' },
    };
  }
}

export async function fetchLocationInsights<T>(latitude: number, longitude: number): Promise<UserActionResult<T>> {
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token;
  try {
    const response = await fetch('/api/location-insights', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ latitude, longitude }),
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
          code: payload?.code ?? 'location_insights_failed',
          message: payload?.message ?? 'Location availability could not be checked.',
        },
      };
    }
    return { data: payload?.data ?? null, error: null };
  } catch {
    return {
      data: null,
      error: { code: 'network_error', message: 'Location availability could not be checked.' },
    };
  }
}
