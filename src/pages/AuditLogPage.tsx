import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, ShieldCheck } from 'lucide-react';
import { useT } from '../lib/i18n-react';
import { supabase, type AuditLog } from '../lib/supabase';
import { AppShell } from '../components/AppShell';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { Skeleton, ErrorState, InlineLoader } from '../components/feedback';
import { userFacingError } from '../lib/userFacingError';

const PAGE_SIZE = 20;

export default function AuditLogPage() {
  const { t, locale } = useT();
  const [rows, setRows] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: e } = await supabase
        .from('audit_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(PAGE_SIZE);
      if (e) throw e;
      const fetched = (data as AuditLog[]) ?? [];
      setRows(fetched);
      setHasMore(fetched.length === PAGE_SIZE);
    } catch (err: unknown) {
      console.error(err);
      setError(userFacingError(err, locale, t('error.genericBody')));
    } finally {
      setLoading(false);
    }
  }, [locale, t]);

  useEffect(() => { void load(); }, [load]);

  return (
    <AppShell>
      <Link
        to="/dashboard"
        className="mb-4 inline-flex items-center gap-1 text-xs font-semibold text-ink-500 hover:text-ink-900"
      >
        <ChevronLeft className="h-4 w-4" />
        {t('common.back')}
      </Link>

      <div className="mb-6 flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-ink-900 text-white">
          <ShieldCheck className="h-5 w-5" />
        </span>
        <div>
          <h1 className="font-display text-xl font-extrabold tracking-tight text-ink-900">
            {t('audit.title')}
          </h1>
          <p className="text-xs text-ink-400">Super Admin · read-only</p>
        </div>
      </div>

      <ErrorBoundary variant="inline">
        {loading ? (
          <div className="kiyo-card p-4"><Skeleton count={6} /></div>
        ) : error ? (
          <ErrorState
            title={t('error.genericTitle')}
            message={error}
            onRetry={load}
            retryLabel={t('error.retry')}
          />
        ) : rows.length === 0 ? (
          <div className="kiyo-card p-8 text-center text-sm text-ink-400">
            {t('audit.empty')}
          </div>
        ) : (
          <div className="kiyo-card overflow-hidden">
            {/* table view on sm+, list on mobile */}
            <div className="hidden grid-cols-[1.2fr_1.4fr_1fr_0.8fr] gap-3 border-b border-ink-100 bg-ink-50 px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-ink-400 sm:grid">
              <div>{t('audit.action')}</div>
              <div>{t('audit.target')}</div>
              <div>{t('audit.actor')}</div>
              <div className="text-right">{t('audit.time')}</div>
            </div>
            <ul className="divide-y divide-ink-100">
              {rows.map((log) => (
                <li
                  key={log.id}
                  className="grid grid-cols-1 gap-1 px-4 py-3 text-sm sm:grid-cols-[1.2fr_1.4fr_1fr_0.8fr] sm:items-center sm:gap-3"
                >
                  <div className="font-semibold text-ink-900">
                    <span className="inline-flex items-center gap-2">
                      <span className="h-1.5 w-1.5 rounded-full bg-ember-500" />
                      {log.action.replace(/_/g, ' ')}
                    </span>
                  </div>
                  <div className="text-xs text-ink-500">
                    {log.target_type ?? t('common.none')}
                    {log.target_id ? ` · ${log.target_id.slice(0, 8)}` : ''}
                  </div>
                  <div className="text-xs text-ink-500">
                    {log.actor_id ? log.actor_id.slice(0, 8) : 'system'}
                  </div>
                  <div className="text-xs text-ink-400 sm:text-right">
                    {new Date(log.created_at).toLocaleString()}
                  </div>
                </li>
              ))}
            </ul>
            {hasMore && (
              <div className="px-4 py-3 text-center">
                <InlineLoader />
              </div>
            )}
          </div>
        )}
      </ErrorBoundary>
    </AppShell>
  );
}
