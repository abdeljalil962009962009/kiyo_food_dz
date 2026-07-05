import { useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from './supabase';

type RealtimeStatus = 'connecting' | 'connected' | 'error' | 'closed';

type Options = {
  enabled?: boolean;
  // Filter object passed to channel.filter(...) — scope to rows we're allowed to see.
  // MUST include restaurant_id/customer_id/doer to avoid global broadcasts.
  filter?: Record<string, string>;
  // Reconnect delay in ms. Doubles each backoff up to max.
  backoffMs?: number;
  backoffMaxMs?: number;
};

/**
 * Subscribe to Postgres changes on a single table for the current authenticated
 * user, with auto-reconnect and exponential backoff.
 *
 * SECURITY: pass an RLS-equivalent filter (e.g. { restaurant_id: 'eq.<uuid>' }).
 * Even without it, RLS still gates which rows we receive — but the filter is
 * defense-in-depth: prevents the channel from ever broadcasting rows we'd be
 * denied anyway, and reduces payload noise.
 *
 * @returns latest payload(s) + status for UI surfacing.
 */
export function useRealtime(
  table: string,
  callback: (payload: { eventType: string; new: Record<string, unknown>; old: Record<string, unknown> }) => void,
  options: Options = {},
) {
  const { enabled = true, filter, backoffMs = 1000, backoffMaxMs = 30000 } = options;
  const [status, setStatus] = useState<RealtimeStatus>('connecting');
  const callbackRef = useRef(callback);
  callbackRef.current = callback;

  // Memoize filter string to prevent unnecessary reconnections
  const filterStr = useMemo(() =>
    filter ? Object.keys(filter).map((k) => `${k}=${filter[k]}`).join(',') : undefined,
    [filter]
  );

  useEffect(() => {
    if (!enabled) return;

    let channel: ReturnType<typeof supabase.channel> | null = null;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    let attempt = 0;
    let cancelled = false;

    const connect = () => {
      if (cancelled) return;
      setStatus('connecting');

      let chan = supabase.channel(`kiyo:${table}:${Math.random().toString(36).slice(2, 8)}`);

      chan = chan.on(
        'postgres_changes',
        { event: '*', schema: 'public', table, filter: filterStr },
        (payload: { eventType: string; new: Record<string, unknown>; old: Record<string, unknown> }) => {
          callbackRef.current(payload);
        },
      );

      chan.subscribe((s: string) => {
        if (cancelled) return;
        if (s === 'SUBSCRIBED') {
          attempt = 0;
          setStatus('connected');
        } else if (s === 'CHANNEL_ERROR' || s === 'TIMED_OUT' || s === 'CLOSED') {
          setStatus(s === 'CLOSED' ? 'closed' : 'error');
          // Reconnect with exponential backoff (max 30s).
          const delay = Math.min(backoffMs * Math.pow(2, attempt), backoffMaxMs);
          attempt += 1;
          retryTimer = setTimeout(connect, delay);
        }
      });

      channel = chan;
    };

    connect();

    return () => {
      cancelled = true;
      if (retryTimer) clearTimeout(retryTimer);
      if (channel) supabase.removeChannel(channel);
    };
  }, [table, enabled, filterStr, backoffMs, backoffMaxMs]);

  return { status };
}
