import { useCallback, useEffect, useState } from 'react';
import { MessageSquare, Send } from 'lucide-react';
import { supabase, type RestaurantApplicationMessage } from '../lib/supabase';
import { useT } from '../lib/i18n-react';
import { Spinner } from './feedback';
import { callUserAction } from '../lib/userApi';

type Props = {
  applicationId: string;
  viewer: 'applicant' | 'super_admin';
};

const copy = {
  en: { title: 'Application conversation', empty: 'No messages yet.', placeholder: 'Write a clear message...', send: 'Send', unavailable: 'Conversation becomes available after the marketplace workflow migration is applied.' },
  fr: { title: 'Conversation de la demande', empty: 'Aucun message pour le moment.', placeholder: 'Écrivez un message clair…', send: 'Envoyer', unavailable: 'La conversation sera disponible après l’application de la migration du workflow marketplace.' },
  ar: { title: 'محادثة الطلب', empty: 'لا توجد رسائل بعد.', placeholder: 'اكتب رسالة واضحة…', send: 'إرسال', unavailable: 'ستصبح المحادثة متاحة بعد تطبيق ترحيل نظام السوق.' },
} as const;

export function RestaurantApplicationThread({ applicationId, viewer }: Props) {
  const { locale } = useT();
  const labels = copy[locale];
  const [messages, setMessages] = useState<RestaurantApplicationMessage[]>([]);
  const [body, setBody] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [unavailable, setUnavailable] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data, error: loadError } = await supabase
      .from('restaurant_application_messages')
      .select('*')
      .eq('application_id', applicationId)
      .order('created_at', { ascending: true });
    setLoading(false);
    if (loadError) {
      if (loadError.code === '42P01' || loadError.code === 'PGRST205') {
        setUnavailable(true);
        return;
      }
      setError(loadError.message);
      return;
    }
    setMessages((data as RestaurantApplicationMessage[]) ?? []);
    setError(null);
    void callUserAction('mark_restaurant_application_messages_read', {
      p_application_id: applicationId,
    });
  }, [applicationId]);

  useEffect(() => {
    void load();
    const channel = supabase
      .channel(`restaurant-application-thread-${applicationId}`)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'restaurant_application_messages',
        filter: `application_id=eq.${applicationId}`,
      }, () => { void load(); })
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [applicationId, load]);

  const send = async () => {
    const message = body.trim();
    if (!message || sending) return;
    setSending(true);
    setError(null);
    const { error: sendError } = await callUserAction('send_restaurant_application_message', {
      p_application_id: applicationId,
      p_body: message,
      p_client_message_id: crypto.randomUUID(),
    });
    setSending(false);
    if (sendError) {
      setError(sendError.message);
      return;
    }
    setBody('');
    await load();
  };

  if (unavailable) return <p className="text-xs text-ink-400">{labels.unavailable}</p>;

  return (
    <section className="space-y-3" aria-label={labels.title}>
      <h3 className="flex items-center gap-2 text-sm font-bold text-ink-900">
        <MessageSquare className="h-4 w-4 text-ember-600" />
        {labels.title}
      </h3>
      <div className="max-h-72 space-y-2 overflow-y-auto rounded-xl border border-ink-100 bg-ink-50 p-3" aria-live="polite">
        {loading ? <Spinner className="mx-auto h-4 w-4" /> : messages.length === 0 ? (
          <p className="py-4 text-center text-xs text-ink-400">{labels.empty}</p>
        ) : messages.map((message) => {
          const mine = message.sender_role === viewer;
          return (
            <div key={message.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[85%] rounded-xl px-3 py-2 text-sm ${mine ? 'bg-ink-900 text-white' : 'border border-ink-100 bg-white text-ink-800'}`}>
                <p className="whitespace-pre-wrap break-words">{message.body}</p>
                <time className={`mt-1 block text-[10px] ${mine ? 'text-white/60' : 'text-ink-400'}`}>
                  {new Date(message.created_at).toLocaleString(locale)}
                </time>
              </div>
            </div>
          );
        })}
      </div>
      <div className="flex gap-2">
        <textarea
          value={body}
          onChange={(event) => setBody(event.target.value.slice(0, 5000))}
          placeholder={labels.placeholder}
          className="kiyo-input min-h-12 flex-1 resize-y"
          aria-label={labels.placeholder}
        />
        <button type="button" onClick={send} disabled={sending || !body.trim()} className="kiyo-btn-primary min-h-11 min-w-11 px-3" title={labels.send}>
          {sending ? <Spinner className="h-4 w-4" /> : <Send className="h-4 w-4" />}
          <span className="sr-only">{labels.send}</span>
        </button>
      </div>
      {error && <p className="text-xs font-medium text-error-600">{error}</p>}
    </section>
  );
}
