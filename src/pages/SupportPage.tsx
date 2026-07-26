import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase, type SupportTicket } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { useT } from '../lib/i18n-react';
import { type TranslationKey } from '../lib/i18n';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { Spinner, ErrorState, FullScreenLoader, Skeleton } from '../components/feedback';
import { AppShell } from '../components/AppShell';
import { MessageCircle, Plus, Send, ChevronLeft, Package, AlertCircle } from 'lucide-react';
import { callUserAction } from '../lib/userApi';
import { userFacingError } from '../lib/userFacingError';
import { withExponentialBackoff } from '../lib/locationNetwork';

type Message = {
  id: string;
  ticket_id: string;
  sender_id: string;
  body: string;
  is_admin: boolean;
  created_at: string;
};

const CATEGORIES = [
  { value: 'general' },
  { value: 'bug' },
  { value: 'abuse' },
  { value: 'complaint' },
  { value: 'billing' },
  { value: 'other' },
];

const PRIORITIES = [
  { value: 'low' },
  { value: 'normal' },
  { value: 'high' },
  { value: 'urgent' },
];

export function SupportPage() {
  const { profile } = useAuth();
  const { t, locale } = useT();
  const [search] = useSearchParams();
  const orderIdFromUrl = search.get('order') ?? '';
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(Boolean(orderIdFromUrl));
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const load = useCallback(async (foreground = true) => {
    if (!profile) return;
    if (foreground) {
      setLoading(true);
      setError(null);
    }
    try {
      const data = await withExponentialBackoff(async () => {
        const { data: ticketData, error: ticketError } = await supabase
          .from('support_tickets')
          .select('*')
          .eq('requester_id', profile.id)
          .order('created_at', { ascending: false });
        if (ticketError) throw ticketError;
        return (ticketData as SupportTicket[]) ?? [];
      }, { attempts: 3, baseDelayMs: 700, timeoutMs: 15000 });
      setTickets(data);
      setError(null);
    } catch (err: unknown) {
      console.error(err);
      if (foreground) setError(userFacingError(err, locale, t('error.genericBody')));
    } finally {
      if (foreground) setLoading(false);
    }
  }, [locale, profile, t]);

  useEffect(() => {
    void load();
    const refresh = () => {
      if (document.visibilityState === 'visible') void load(false);
    };
    const interval = window.setInterval(refresh, 30000);
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, [load]);

  if (!profile) return <FullScreenLoader />;
  if (loading) return (
    <AppShell>
      <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6">
        <div className="kiyo-card p-5"><Skeleton count={4} /></div>
      </div>
    </AppShell>
  );
  if (error) return (
    <AppShell>
      <ErrorState title={t('error.genericTitle')} message={error} onRetry={load} retryLabel={t('error.retry')} />
    </AppShell>
  );

  if (selectedId) {
    return <TicketDetail ticketId={selectedId} onBack={() => setSelectedId(null)} />;
  }

  return (
    <AppShell>
      <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="font-display text-2xl font-extrabold text-ink-900">{t('support.title')}</h1>
            <p className="mt-1 text-sm text-ink-500">{t('support.subtitle')}</p>
          </div>
          <button
            onClick={() => setShowForm((v) => !v)}
            className="kiyo-btn-primary"
          >
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">{t('support.newTicket')}</span>
          </button>
        </div>

        {showForm && (
          <TicketForm
            initialOrderId={orderIdFromUrl}
            onCreated={() => { setShowForm(false); void load(); }}
            onCancel={() => setShowForm(false)}
          />
        )}

        {tickets.length === 0 ? (
          <div className="kiyo-card flex flex-col items-center justify-center py-16 text-center">
            <MessageCircle className="mb-3 h-10 w-10 text-ink-300" />
            <p className="text-sm text-ink-400">{t('support.noTickets')}</p>
            <p className="mt-1 text-xs text-ink-400">{t('support.needHelp')}</p>
            <button type="button" onClick={() => setShowForm(true)} className="kiyo-btn-primary mt-4 min-h-11">{t('support.newTicket')}</button>
          </div>
        ) : (
          <ul className="space-y-3">
            {tickets.map((ticket) => (
              <li key={ticket.id}>
                <button
                  onClick={() => setSelectedId(ticket.id)}
                  className="kiyo-card flex min-h-11 w-full items-start gap-3 p-4 text-start transition-colors hover:bg-ink-50/50"
                >
                  <span className={`mt-0.5 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg ${
                    ticket.status === 'open' ? 'bg-warning-500/10 text-warning-600' :
                    ticket.status === 'in_progress' ? 'bg-blue-100 text-blue-600' :
                    ticket.status === 'resolved' ? 'bg-sage-500/10 text-sage-600' :
                    'bg-ink-100 text-ink-500'
                  }`}>
                    <MessageCircle className="h-4 w-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="truncate text-sm font-semibold text-ink-900">{ticket.subject}</h3>
                      <span className={`flex-shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium uppercase ${
                        ticket.status === 'open' ? 'bg-warning-500/10 text-warning-600' :
                        ticket.status === 'in_progress' ? 'bg-blue-100 text-blue-600' :
                        ticket.status === 'resolved' ? 'bg-sage-500/10 text-sage-600' :
                        'bg-ink-100 text-ink-500'
                      }`}>{t(`support.status.${ticket.status}` as TranslationKey)}</span>
                    </div>
                    <p className="mt-0.5 truncate text-xs text-ink-500">{ticket.body}</p>
                    <div className="mt-1.5 flex items-center gap-2 text-[10px] text-ink-400">
                      <span>{t(`support.category.${ticket.category}` as TranslationKey)}</span>
                      <span>·</span>
                      <span>{t(`support.priority.${ticket.priority}` as TranslationKey)} {t('support.prioritySuffix')}</span>
                      <span>·</span>
                      <span>{new Date(ticket.created_at).toLocaleDateString(locale === 'ar' ? 'ar-DZ' : locale === 'fr' ? 'fr-DZ' : 'en-DZ')}</span>
                    </div>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </AppShell>
  );
}

function TicketForm({ initialOrderId, onCreated, onCancel }: { initialOrderId: string; onCreated: () => void; onCancel: () => void }) {
  const { t, locale } = useT();
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [category, setCategory] = useState(initialOrderId ? 'complaint' : 'general');
  const [priority, setPriority] = useState(initialOrderId ? 'high' : 'normal');
  const [orderId, setOrderId] = useState(initialOrderId);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (subject.trim().length < 3 || body.trim().length < 10) {
      setError(t('support.form.validation'));
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const { error: e } = await callUserAction('create_support_ticket', {
        p_subject: subject.trim(),
        p_body: body.trim(),
        p_category: category,
        p_priority: priority,
        p_order_id: orderId.trim() || null,
      });
      if (e) throw e;
      onCreated();
    } catch (err: unknown) {
      setError(userFacingError(
        err,
        locale,
        locale === 'ar'
          ? 'تعذّر إرسال طلب الدعم. تحقق من رقم الطلب أو أعد المحاولة.'
          : locale === 'fr'
            ? 'La demande d’assistance n’a pas pu être envoyée. Vérifiez le numéro de commande ou réessayez.'
            : 'The support request could not be sent. Check the order number or try again.',
      ));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ErrorBoundary variant="inline">
      <div className="kiyo-card mb-4 space-y-4 p-5">
        <h2 className="font-display text-base font-bold text-ink-900">{t('support.newTicket')}</h2>
        {error && (
          <div className="flex items-center gap-2 rounded-lg bg-error-500/10 px-3 py-2 text-sm text-error-600">
            <AlertCircle className="h-4 w-4" /> {error}
          </div>
        )}
        <div>
          <label className="mb-1 block text-xs font-medium text-ink-500">{t('support.form.subject')}</label>
          <input
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder={t('support.form.subjectPlaceholder')}
            className="w-full rounded-lg border border-ink-100 bg-white px-3 py-2 text-sm focus:border-ember-500 focus:outline-none"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-ink-500">{t('support.form.category')}</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full rounded-lg border border-ink-100 bg-white px-3 py-2 text-sm focus:border-ember-500 focus:outline-none"
            >
              {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{t(`support.category.${c.value}` as TranslationKey)}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-ink-500">{t('support.form.priority')}</label>
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
              className="w-full rounded-lg border border-ink-100 bg-white px-3 py-2 text-sm focus:border-ember-500 focus:outline-none"
            >
              {PRIORITIES.map((p) => <option key={p.value} value={p.value}>{t(`support.priority.${p.value}` as TranslationKey)}</option>)}
            </select>
          </div>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-ink-500">{t('support.form.orderIdOptional')}</label>
          <input
            value={orderId}
            onChange={(e) => setOrderId(e.target.value)}
            placeholder={t('support.form.orderIdPlaceholder')}
            className="w-full rounded-lg border border-ink-100 bg-white px-3 py-2 text-sm focus:border-ember-500 focus:outline-none"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-ink-500">{t('support.form.description')}</label>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={4}
            placeholder={t('support.form.descriptionPlaceholder')}
            className="w-full rounded-lg border border-ink-100 bg-white px-3 py-2 text-sm focus:border-ember-500 focus:outline-none"
          />
        </div>
        <div className="flex gap-2">
          <button onClick={submit} disabled={submitting} className="kiyo-btn-primary">
            {submitting ? <Spinner className="h-4 w-4" /> : <Send className="h-4 w-4" />}
            {t('support.form.submit')}
          </button>
          <button onClick={onCancel} className="kiyo-btn-secondary">{t('common.cancel')}</button>
        </div>
      </div>
    </ErrorBoundary>
  );
}

function TicketDetail({ ticketId, onBack }: { ticketId: string; onBack: () => void }) {
  const { t, locale } = useT();
  const dateLocale = locale === 'ar' ? 'ar-DZ' : locale === 'fr' ? 'fr-DZ' : 'en-DZ';
  const { profile } = useAuth();
  const [ticket, setTicket] = useState<SupportTicket | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reply, setReply] = useState('');
  const [sending, setSending] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const load = useCallback(async (foreground = true) => {
    if (foreground) {
      setLoading(true);
      setError(null);
    }
    try {
      const result = await withExponentialBackoff(async () => {
        const [ticketRes, msgRes] = await Promise.all([
          supabase.from('support_tickets').select('*').eq('id', ticketId).single(),
          supabase.from('support_messages').select('*').eq('ticket_id', ticketId).order('created_at', { ascending: true }),
        ]);
        if (ticketRes.error) throw ticketRes.error;
        if (msgRes.error) throw msgRes.error;
        return {
          ticket: ticketRes.data as SupportTicket,
          messages: (msgRes.data as Message[]) ?? [],
        };
      }, { attempts: 3, baseDelayMs: 700, timeoutMs: 15000 });
      setTicket(result.ticket);
      setMessages(result.messages);
      setError(null);
    } catch (err: unknown) {
      console.error(err);
      if (foreground) setError(userFacingError(err, locale, t('error.genericBody')));
    } finally {
      if (foreground) setLoading(false);
    }
  }, [locale, ticketId, t]);

  useEffect(() => {
    void load();
    const refresh = () => {
      if (document.visibilityState === 'visible') void load(false);
    };
    const interval = window.setInterval(refresh, 20000);
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, [load]);

  const sendReply = async () => {
    if (reply.trim().length < 1 || !profile) return;
    setSending(true);
    setActionError(null);
    try {
      const { error: e } = await callUserAction('reply_to_ticket', {
        p_ticket_id: ticketId,
        p_body: reply.trim(),
        p_is_admin: false,
      });
      if (e) throw e;
      setReply('');
      await load(false);
    } catch (err: unknown) {
      setActionError(userFacingError(err, locale, t('error.genericBody')));
    } finally {
      setSending(false);
    }
  };

  if (loading) return (
    <AppShell>
      <div className="mx-auto max-w-2xl space-y-4 px-4 py-6 sm:px-6">
        <div className="kiyo-card p-5"><Skeleton count={2} /></div>
        <div className="kiyo-card p-5"><Skeleton count={4} /></div>
      </div>
    </AppShell>
  );
  if (error) return (
    <AppShell>
      <ErrorState title={t('error.genericTitle')} message={error} onRetry={load} retryLabel={t('error.retry')} />
    </AppShell>
  );
  if (!ticket) return null;

  return (
    <AppShell>
      <div className="mx-auto max-w-2xl px-4 py-6 sm:px-6">
        <button onClick={onBack} className="mb-4 inline-flex min-h-11 items-center gap-1 text-sm text-ink-500 hover:text-ink-900">
          <ChevronLeft className={`h-4 w-4 ${locale === 'ar' ? 'rotate-180' : ''}`} /> {t('support.backToTickets')}
        </button>

        <div className="kiyo-card mb-4 p-5">
          <div className="flex items-start justify-between gap-2">
            <h1 className="font-display text-lg font-bold text-ink-900">{ticket.subject}</h1>
            <span className={`flex-shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium uppercase ${
              ticket.status === 'open' ? 'bg-warning-500/10 text-warning-600' :
              ticket.status === 'in_progress' ? 'bg-blue-100 text-blue-600' :
              ticket.status === 'resolved' ? 'bg-sage-500/10 text-sage-600' :
              'bg-ink-100 text-ink-500'
            }`}>{t(`support.status.${ticket.status}` as TranslationKey)}</span>
          </div>
          <p className="mt-2 text-sm text-ink-600">{ticket.body}</p>
          <div className="mt-3 flex flex-wrap items-center gap-2 text-[10px] text-ink-400">
            <span className="rounded bg-ink-100 px-1.5 py-0.5">{t(`support.category.${ticket.category}` as TranslationKey)}</span>
            <span className="rounded bg-ink-100 px-1.5 py-0.5">{t(`support.priority.${ticket.priority}` as TranslationKey)} {t('support.prioritySuffix')}</span>
            {ticket.order_id && (
              <span className="flex items-center gap-1 rounded bg-ink-100 px-1.5 py-0.5">
                <Package className="h-3 w-3" /> {t('orders.id')}: {ticket.order_id.slice(0, 8)}
              </span>
            )}
            <span>{new Date(ticket.created_at).toLocaleString(dateLocale)}</span>
          </div>
        </div>

        <div className="kiyo-card mb-4">
          <div className="border-b border-ink-100 px-4 py-3">
            <h3 className="text-sm font-semibold text-ink-900">{t('support.conversation')}</h3>
          </div>
          <div className="max-h-96 space-y-3 overflow-y-auto p-4">
            {messages.length === 0 ? (
              <p className="py-8 text-center text-sm text-ink-400">{t('support.noMessages')}</p>
            ) : (
              messages.map((m) => (
                <div key={m.id} className={`flex ${m.is_admin ? 'justify-start' : 'justify-end'}`}>
                  <div className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${
                    m.is_admin
                      ? 'bg-ink-100 text-ink-800'
                      : 'bg-ember-500 text-white'
                  }`}>
                    <p className="whitespace-pre-wrap">{m.body}</p>
                    <p className={`mt-1 text-[10px] ${m.is_admin ? 'text-ink-400' : 'text-ember-100'}`}>
                      {m.is_admin ? t('support.staff') : t('support.you')} · {new Date(m.created_at).toLocaleString(dateLocale)}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {ticket.status !== 'closed' && (
          <div className="kiyo-card p-3">
            {actionError && (
              <div className="mb-3 flex items-start gap-2 rounded-lg bg-error-500/10 px-3 py-2 text-sm text-error-700" role="alert">
                <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
                <span className="flex-1">{actionError}</span>
                <button type="button" onClick={() => void sendReply()} className="min-h-11 font-semibold underline">
                  {t('error.retry')}
                </button>
              </div>
            )}
            <div className="flex items-end gap-2">
              <textarea
                value={reply}
                onChange={(e) => setReply(e.target.value)}
                rows={2}
                placeholder={t('support.typeReply')}
                aria-label={t('support.typeReply')}
                className="flex-1 resize-none rounded-lg border border-ink-100 bg-white px-3 py-2 text-sm focus:border-ember-500 focus:outline-none"
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void sendReply(); } }}
              />
              <button
                onClick={sendReply}
                disabled={sending || reply.trim().length < 1}
                className="kiyo-btn-primary min-h-11 min-w-11 flex-shrink-0"
                aria-label={t('support.form.submit')}
              >
                {sending ? <Spinner className="h-4 w-4" /> : <Send className="h-4 w-4" />}
              </button>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}

export default SupportPage;
