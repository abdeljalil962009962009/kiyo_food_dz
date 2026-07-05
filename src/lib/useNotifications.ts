import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase, type Notification } from './supabase';
import { useRealtime } from './useRealtime';

/**
 * Unified notification hook: loads recent notifications, subscribes to realtime
 * inserts, deduplicates by ID, and tracks unread count.
 *
 * Reconnects automatically on disconnect (via useRealtime's exponential backoff).
 * Survives refresh — missed notifications are loaded from the DB on mount.
 */
export function useNotifications(userId: string | undefined) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const seenIds = useRef<Set<string>>(new Set());

  const load = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) return;
      const list = (data as Notification[]) ?? [];
      list.forEach((n) => seenIds.current.add(n.id));
      setNotifications(list);
      setUnreadCount(list.filter((n) => !n.is_read).length);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => { void load(); }, [load]);

  // Realtime subscription — deduplicate by ID to prevent duplicate events
  useRealtime(
    'notifications',
    (payload) => {
      const n = payload.new as Notification;
      if (!n || n.user_id !== userId) return;
      if (seenIds.current.has(n.id)) return;
      seenIds.current.add(n.id);
      setNotifications((prev) => [n, ...prev].slice(0, 50));
      if (!n.is_read) setUnreadCount((c) => c + 1);
    },
    { enabled: !!userId, filter: userId ? { user_id: `eq.${userId}` } : undefined },
  );

  const markRead = useCallback(async (id: string) => {
    setNotifications((prev) => prev.map((n) => n.id === id ? { ...n, is_read: true } : n));
    setUnreadCount((c) => Math.max(0, c - 1));
    await supabase.rpc('mark_notification_read', { p_notification_id: id });
  }, []);

  const markAllRead = useCallback(async () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    setUnreadCount(0);
    await supabase.rpc('mark_all_notifications_read');
  }, []);

  return { notifications, unreadCount, loading, markRead, markAllRead, reload: load };
}
