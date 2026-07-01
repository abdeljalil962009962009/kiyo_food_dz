import { useState, useRef, useEffect } from 'react';
import { Bell } from 'lucide-react';
import { useNotifications } from '../lib/useNotifications';
import { useAuth } from '../context/AuthContext';
import { relativeTime } from './ui';

const TYPE_ICONS: Record<string, string> = {
  new_order: '🔔',
  order_accepted: '✅',
  order_preparing: '👨‍🍳',
  order_out_for_delivery: '🛵',
  order_delivered: '📦',
  order_cancelled: '❌',
  order_failed_delivery: '⚠️',
  order_refunded: '💰',
  new_restaurant: '🏪',
  high_cancellation: '📊',
  failed_order: '🔴',
  suspicious_activity: '🚨',
  financial_inconsistency: '💸',
  system_error: '⚙️',
  settlement_due: '📅',
};

export function NotificationBell() {
  const { profile } = useAuth();
  const { notifications, unreadCount, markRead, markAllRead } = useNotifications(profile?.id);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="relative flex h-9 w-9 items-center justify-center rounded-lg text-ink-600 transition-colors hover:bg-ink-100"
        aria-label="Notifications"
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-ember-500 px-1 text-[10px] font-bold text-white">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-80 max-w-[calc(100vw-2rem)] overflow-hidden rounded-xl border border-ink-100 bg-white shadow-card-lg">
          <div className="flex items-center justify-between border-b border-ink-100 px-4 py-3">
            <h3 className="font-display text-sm font-bold text-ink-900">Notifications</h3>
            {unreadCount > 0 && (
              <button
                onClick={markAllRead}
                className="text-xs font-semibold text-ember-600 hover:text-ember-700"
              >
                Mark all read
              </button>
            )}
          </div>
          <div className="max-h-96 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-ink-400">No notifications</div>
            ) : (
              <ul className="divide-y divide-ink-50">
                {notifications.slice(0, 20).map((n) => (
                  <li key={n.id}>
                    <button
                      onClick={() => markRead(n.id)}
                      className={`flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-ink-50 ${
                        !n.is_read ? 'bg-ember-500/5' : ''
                      }`}
                    >
                      <span className="mt-0.5 text-base">{TYPE_ICONS[n.type] ?? '🔔'}</span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-ink-900">{n.title}</p>
                        <p className="truncate text-xs text-ink-500">{n.body}</p>
                        <p className="mt-0.5 text-[10px] text-ink-400">{relativeTime(n.created_at)}</p>
                      </div>
                      {!n.is_read && <span className="mt-1.5 h-2 w-2 flex-shrink-0 rounded-full bg-ember-500" />}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
