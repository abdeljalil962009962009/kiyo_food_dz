import { useEffect, useMemo, useRef, useState } from 'react';
import { Bell } from 'lucide-react';
import { useNotifications } from '../lib/useNotifications';
import { useAuth } from '../context/AuthContext';
import { relativeTime } from './ui';
import { useT } from '../lib/i18n-react';
import type { Notification } from '../lib/supabase';

type NotificationLocale = 'en' | 'fr' | 'ar';
type NotificationCopy = {
  title: string;
  markAll: string;
  empty: string;
  fallbackTitle: string;
  fallbackBody: string;
  restaurantSuffix: (restaurant: string, orderRef: string) => string;
  types: Record<string, { title: string; body: string }>;
};

const TYPE_ICONS: Record<string, string> = {
  new_order: '!',
  order_accepted: '+',
  order_preparing: '~',
  order_out_for_delivery: '>',
  order_delivered: 'OK',
  order_cancelled: 'x',
  order_failed_delivery: '!',
  order_refunded: '$',
  support_reply: '@',
  new_restaurant: 'R',
  high_cancellation: '%',
  failed_order: '!',
  suspicious_activity: '!',
  financial_inconsistency: '$',
  system_error: '!',
  settlement_due: '#',
  application_submitted: 'A',
  application_message: 'A',
  application_status_changed: 'A',
  application_under_review: 'A',
  application_changes_requested: 'A',
  application_preliminarily_approved: 'A',
  restaurant_ready_to_publish: 'R',
  restaurant_published: 'R',
  restaurant_suspended: 'R',
};

const TYPE_ALIASES: Record<string, string> = {
  applicant_replied: 'application_message',
  applicant_response: 'application_message',
  application_reply: 'application_message',
  application_replied: 'application_message',
  application_conversation_reply: 'application_message',
  restaurant_application_message: 'application_message',
  new_application_message: 'application_message',
  restaurant_application_submitted: 'application_submitted',
  restaurant_application_waiting_for_review: 'application_submitted',
  restaurant_application_pending_review: 'application_submitted',
  application_waiting_for_review: 'application_submitted',
  application_pending_review: 'application_submitted',
  new_restaurant_application: 'application_submitted',
  restaurant_application_approved: 'application_preliminarily_approved',
  application_approved: 'application_preliminarily_approved',
  restaurant_application_status_changed: 'application_status_changed',
  restaurant_application_under_review: 'application_under_review',
  restaurant_application_changes_requested: 'application_changes_requested',
  restaurant_application_preliminarily_approved: 'application_preliminarily_approved',
};

const NOTIFICATION_COPY: Record<NotificationLocale, NotificationCopy> = {
  en: {
    title: 'Notifications',
    markAll: 'Mark all read',
    empty: 'No notifications',
    fallbackTitle: 'New update',
    fallbackBody: 'Open Kiyo Food for the latest details.',
    restaurantSuffix: (restaurant, orderRef) => [restaurant, orderRef ? `#${orderRef.slice(0, 8)}` : ''].filter(Boolean).join(' - '),
    types: {
      new_order: { title: 'New order received', body: 'A new order is waiting for your team.' },
      order_accepted: { title: 'Order accepted', body: 'Your order has been accepted by the restaurant.' },
      order_preparing: { title: 'Order in preparation', body: 'Your meal is now being prepared.' },
      order_out_for_delivery: { title: 'Order on the way', body: 'Your order is on its way to you.' },
      order_delivered: { title: 'Order delivered', body: 'Your order has been delivered. Enjoy your meal.' },
      order_cancelled: { title: 'Order cancelled', body: 'This order has been cancelled.' },
      order_failed_delivery: { title: 'Delivery issue', body: 'The delivery could not be completed. Please contact support.' },
      order_refunded: { title: 'Order refunded', body: 'A refund was recorded for this order.' },
      support_reply: { title: 'Support replied', body: 'You have a new reply from Kiyo Food support.' },
      new_restaurant: { title: 'New restaurant application', body: 'A restaurant application is waiting for review.' },
      application_submitted: { title: 'Restaurant application waiting for review', body: 'A restaurant application is waiting for review.' },
      application_message: { title: 'Restaurant application message', body: 'There is a new message in the application conversation.' },
      application_status_changed: { title: 'Restaurant application updated', body: 'The restaurant application status changed.' },
      high_cancellation: { title: 'High cancellation alert', body: 'A restaurant needs review because cancellations are increasing.' },
      failed_order: { title: 'Order failure detected', body: 'An order needs attention in the admin dashboard.' },
      suspicious_activity: { title: 'Security alert', body: 'Suspicious activity needs review.' },
      financial_inconsistency: { title: 'Financial check needed', body: 'A financial record needs admin review.' },
      system_error: { title: 'System alert', body: 'A platform issue needs attention.' },
      settlement_due: { title: 'Settlement due', body: 'A restaurant settlement is ready for review.' },
      application_under_review: { title: 'Application under review', body: 'Your restaurant application is now being reviewed.' },
      application_changes_requested: { title: 'Changes requested', body: 'Kiyo Food requested updates to your restaurant application.' },
      application_preliminarily_approved: { title: 'Application approved', body: 'Your restaurant can now continue onboarding.' },
      restaurant_ready_to_publish: { title: 'Restaurant ready to publish', body: 'A restaurant is ready for final publication review.' },
      restaurant_published: { title: 'Restaurant published', body: 'Your restaurant is now visible to customers.' },
      restaurant_suspended: { title: 'Restaurant suspended', body: 'This restaurant was suspended by Kiyo Food.' },
    },
  },
  fr: {
    title: 'Notifications',
    markAll: 'Tout marquer comme lu',
    empty: 'Aucune notification',
    fallbackTitle: 'Nouvelle mise à jour',
    fallbackBody: 'Ouvrez Kiyo Food pour voir les derniers détails.',
    restaurantSuffix: (restaurant, orderRef) => [restaurant, orderRef ? `#${orderRef.slice(0, 8)}` : ''].filter(Boolean).join(' - '),
    types: {
      new_order: { title: 'Nouvelle commande reçue', body: 'Une nouvelle commande attend votre équipe.' },
      order_accepted: { title: 'Commande acceptée', body: 'Votre commande a été acceptée par le restaurant.' },
      order_preparing: { title: 'Commande en préparation', body: 'Votre repas est maintenant en préparation.' },
      order_out_for_delivery: { title: 'Commande en route', body: 'Votre commande est en cours de livraison.' },
      order_delivered: { title: 'Commande livrée', body: 'Votre commande a été livrée. Bon appétit.' },
      order_cancelled: { title: 'Commande annulée', body: 'Cette commande a été annulée.' },
      order_failed_delivery: { title: 'Problème de livraison', body: 'La livraison n’a pas pu être terminée. Contactez le support.' },
      order_refunded: { title: 'Commande remboursée', body: 'Un remboursement a été enregistré pour cette commande.' },
      support_reply: { title: 'Réponse du support', body: 'Vous avez une nouvelle réponse du support Kiyo Food.' },
      new_restaurant: { title: 'Nouvelle demande restaurant', body: 'Une demande de restaurant attend votre examen.' },
      application_submitted: { title: 'Demande restaurant à examiner', body: 'Une demande de restaurant attend votre validation.' },
      application_message: { title: 'Message de demande restaurant', body: 'Un nouveau message a été ajouté à la discussion de la demande.' },
      application_status_changed: { title: 'Demande restaurant mise à jour', body: 'Le statut de la demande restaurant a changé.' },
      high_cancellation: { title: 'Alerte annulations', body: 'Un restaurant doit être vérifié car les annulations augmentent.' },
      failed_order: { title: 'Échec de commande détecté', body: 'Une commande demande votre attention dans le tableau admin.' },
      suspicious_activity: { title: 'Alerte sécurité', body: 'Une activité suspecte doit être vérifiée.' },
      financial_inconsistency: { title: 'Vérification financière', body: 'Un élément financier demande une revue administrateur.' },
      system_error: { title: 'Alerte système', body: 'Un problème de plateforme demande votre attention.' },
      settlement_due: { title: 'Règlement à traiter', body: 'Un règlement restaurant est prêt à être vérifié.' },
      application_under_review: { title: 'Demande en cours d’examen', body: 'Votre demande de restaurant est maintenant en cours d’examen.' },
      application_changes_requested: { title: 'Modifications demandées', body: 'Kiyo Food a demandé des corrections sur votre demande de restaurant.' },
      application_preliminarily_approved: { title: 'Demande approuvée', body: 'Votre restaurant peut continuer son intégration.' },
      restaurant_ready_to_publish: { title: 'Restaurant prêt à publier', body: 'Un restaurant est prêt pour la validation finale.' },
      restaurant_published: { title: 'Restaurant publié', body: 'Votre restaurant est maintenant visible par les clients.' },
      restaurant_suspended: { title: 'Restaurant suspendu', body: 'Ce restaurant a été suspendu par Kiyo Food.' },
    },
  },
  ar: {
    title: 'الإشعارات',
    markAll: 'تحديد الكل كمقروء',
    empty: 'لا توجد إشعارات',
    fallbackTitle: 'تحديث جديد',
    fallbackBody: 'افتح كيو فود للاطلاع على آخر التفاصيل.',
    restaurantSuffix: (restaurant, orderRef) => [restaurant, orderRef ? `#${orderRef.slice(0, 8)}` : ''].filter(Boolean).join(' - '),
    types: {
      new_order: { title: 'طلب جديد', body: 'يوجد طلب جديد بانتظار فريق المطعم.' },
      order_accepted: { title: 'تم قبول الطلب', body: 'قبل المطعم طلبك.' },
      order_preparing: { title: 'الطلب قيد التحضير', body: 'يتم الآن تحضير وجبتك.' },
      order_out_for_delivery: { title: 'الطلب في الطريق', body: 'طلبك في طريقه إليك.' },
      order_delivered: { title: 'تم تسليم الطلب', body: 'تم تسليم طلبك. شهية طيبة.' },
      order_cancelled: { title: 'تم إلغاء الطلب', body: 'تم إلغاء هذا الطلب.' },
      order_failed_delivery: { title: 'مشكلة في التوصيل', body: 'تعذر إكمال التوصيل. يرجى التواصل مع الدعم.' },
      order_refunded: { title: 'تم رد قيمة الطلب', body: 'تم تسجيل رد مالي لهذا الطلب.' },
      support_reply: { title: 'رد من الدعم', body: 'لديك رد جديد من دعم كيو فود.' },
      new_restaurant: { title: 'طلب مطعم جديد', body: 'يوجد طلب مطعم بانتظار المراجعة.' },
      application_submitted: { title: 'طلب مطعم بانتظار المراجعة', body: 'يوجد طلب مطعم جديد يحتاج إلى مراجعتك.' },
      application_message: { title: 'رسالة حول طلب مطعم', body: 'توجد رسالة جديدة في محادثة طلب المطعم.' },
      application_status_changed: { title: 'تم تحديث طلب المطعم', body: 'تم تغيير حالة طلب المطعم.' },
      high_cancellation: { title: 'تنبيه كثرة الإلغاءات', body: 'يحتاج أحد المطاعم إلى مراجعة بسبب زيادة الإلغاءات.' },
      failed_order: { title: 'تعثر طلب', body: 'يوجد طلب يحتاج إلى متابعة في لوحة الإدارة.' },
      suspicious_activity: { title: 'تنبيه أمني', body: 'يوجد نشاط مشبوه يحتاج إلى مراجعة.' },
      financial_inconsistency: { title: 'مراجعة مالية مطلوبة', body: 'يوجد سجل مالي يحتاج إلى مراجعة إدارية.' },
      system_error: { title: 'تنبيه النظام', body: 'توجد مشكلة في المنصة تحتاج إلى متابعة.' },
      settlement_due: { title: 'تسوية جاهزة', body: 'توجد تسوية مطعم جاهزة للمراجعة.' },
      application_under_review: { title: 'الطلب قيد المراجعة', body: 'طلب مطعمك قيد المراجعة الآن.' },
      application_changes_requested: { title: 'تعديلات مطلوبة', body: 'طلبت كيو فود تعديلات على طلب مطعمك.' },
      application_preliminarily_approved: { title: 'تمت الموافقة على الطلب', body: 'يمكن لمطعمك متابعة خطوات الإعداد.' },
      restaurant_ready_to_publish: { title: 'مطعم جاهز للنشر', body: 'يوجد مطعم جاهز للمراجعة النهائية قبل النشر.' },
      restaurant_published: { title: 'تم نشر المطعم', body: 'مطعمك أصبح ظاهراً للعملاء الآن.' },
      restaurant_suspended: { title: 'تم تعليق المطعم', body: 'تم تعليق هذا المطعم من طرف كيو فود.' },
    },
  },
};

const valueFromMetadata = (metadata: Record<string, unknown> | null | undefined, keys: string[]) => {
  if (!metadata) return '';
  for (const key of keys) {
    const value = metadata[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
    if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  }
  return '';
};

const normalizeLocale = (locale: string): NotificationLocale => (
  locale === 'ar' || locale === 'en' ? locale : 'fr'
);

const containsMojibake = (value: string) => /Ã|Ø|Ù|�/.test(value);

function resolveNotificationType(notification: Notification) {
  const normalized = TYPE_ALIASES[notification.type] ?? notification.type;
  const title = notification.title?.trim().toLowerCase() ?? '';
  const body = notification.body?.trim().toLowerCase() ?? '';
  const text = `${title} ${body}`;

  if (
    text.includes('applicant replied') ||
    text.includes('applicant response') ||
    text.includes('new message about your restaurant application') ||
    text.includes('restaurant application message') ||
    text.includes('application conversation')
  ) {
    return 'application_message';
  }
  if (
    text.includes('restaurant application waiting for review') ||
    text.includes('application waiting for review') ||
    text.includes('restaurant application pending review') ||
    text.includes('new restaurant application') ||
    (text.includes('restaurant application') && text.includes('waiting for'))
  ) {
    return 'application_submitted';
  }
  if (text.includes('changes requested for your restaurant application') || text.includes('changes requested')) {
    return 'application_changes_requested';
  }
  if (text.includes('restaurant application approved') || text.includes('application approved')) {
    return 'application_preliminarily_approved';
  }
  if (text.includes('restaurant suspended')) {
    return 'restaurant_suspended';
  }

  return normalized;
}

export function localizeNotification(notification: Notification, locale: string) {
  const notificationLocale = normalizeLocale(locale);
  const copy = NOTIFICATION_COPY[notificationLocale];
  return localizedNotification(notification, copy);
}

function localizedNotification(notification: Notification, copy: NotificationCopy) {
  const resolvedType = resolveNotificationType(notification);
  const template = copy.types[resolvedType];
  const orderRef = valueFromMetadata(notification.metadata, ['order_number', 'order_id']);
  const restaurant = valueFromMetadata(notification.metadata, ['restaurant_name', 'restaurant']);
  const suffix = copy.restaurantSuffix(restaurant, orderRef);

  if (template) {
    return {
      title: template.title,
      body: suffix ? `${template.body} ${suffix}` : template.body,
    };
  }

  const rawTitle = notification.title?.trim();
  const rawBody = notification.body?.trim();
  return {
    title: rawTitle && !containsMojibake(rawTitle) ? rawTitle : copy.fallbackTitle,
    body: rawBody && !containsMojibake(rawBody) ? rawBody : copy.fallbackBody,
  };
}

export function NotificationBell() {
  const { profile } = useAuth();
  const { locale } = useT();
  const notificationLocale = normalizeLocale(locale);
  const copy = NOTIFICATION_COPY[notificationLocale];
  const { notifications, unreadCount, markRead, markAllRead } = useNotifications(profile?.id);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const direction = notificationLocale === 'ar' ? 'rtl' : 'ltr';

  const renderedNotifications = useMemo(
    () => notifications.slice(0, 20).map((notification) => ({
      notification,
      display: localizeNotification(notification, notificationLocale),
      iconType: resolveNotificationType(notification),
    })),
    [notificationLocale, notifications],
  );

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div ref={ref} className="relative" dir={direction}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="relative flex h-9 w-9 items-center justify-center rounded-lg text-ink-600 transition-colors hover:bg-ink-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ember-500"
        aria-label={copy.title}
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-ember-500 px-1 text-[10px] font-bold text-white">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute end-0 top-full z-50 mt-2 w-80 max-w-[calc(100vw-2rem)] overflow-hidden rounded-xl border border-ink-100 bg-white shadow-card-lg">
          <div className="flex items-center justify-between gap-3 border-b border-ink-100 px-4 py-3">
            <h3 className="font-display text-sm font-bold text-ink-900">{copy.title}</h3>
            {unreadCount > 0 && (
              <button
                onClick={markAllRead}
                className="min-h-8 rounded-md px-2 text-xs font-semibold text-ember-600 hover:bg-ember-50 hover:text-ember-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ember-500"
              >
                {copy.markAll}
              </button>
            )}
          </div>
          <div className="max-h-96 overflow-y-auto">
            {renderedNotifications.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-ink-400">{copy.empty}</div>
            ) : (
              <ul className="divide-y divide-ink-50">
                {renderedNotifications.map(({ notification, display, iconType }) => (
                  <li key={notification.id}>
                    <button
                      onClick={() => markRead(notification.id)}
                      className={`flex min-h-16 w-full items-start gap-3 px-4 py-3 text-start transition-colors hover:bg-ink-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ember-500 ${
                        !notification.is_read ? 'bg-ember-500/5' : ''
                      }`}
                    >
                      <span className="mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-ember-50 text-[10px] font-bold text-ember-600">
                        {TYPE_ICONS[iconType] ?? TYPE_ICONS[notification.type] ?? '!'}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-medium text-ink-900">{display.title}</span>
                        <span className="block text-xs leading-5 text-ink-500">{display.body}</span>
                        <span className="mt-0.5 block text-[10px] text-ink-400">{relativeTime(notification.created_at)}</span>
                      </span>
                      {!notification.is_read && <span className="mt-2 h-2 w-2 flex-shrink-0 rounded-full bg-ember-500" />}
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
