import type { Locale } from './i18n';
import type { RestaurantApplicationStatus, RestaurantStatus, Settlement } from './supabase';

type SettlementStatus = Settlement['status'];

const APPLICATION_STATUS: Record<Locale, Record<RestaurantApplicationStatus, string>> = {
  en: {
    draft: 'Draft',
    submitted: 'Submitted',
    under_review: 'Under review',
    changes_requested: 'Changes requested',
    resubmitted: 'Resubmitted',
    preliminarily_approved: 'Preliminarily approved',
    onboarding_in_progress: 'Setup in progress',
    menu_review: 'Menu review',
    ready_to_publish: 'Ready to publish',
    published: 'Published',
    rejected: 'Rejected',
    suspended: 'Suspended',
    archived: 'Archived',
  },
  fr: {
    draft: 'Brouillon',
    submitted: 'Envoyée',
    under_review: 'En cours d’examen',
    changes_requested: 'Modifications demandées',
    resubmitted: 'Renvoyée',
    preliminarily_approved: 'Approuvée provisoirement',
    onboarding_in_progress: 'Configuration en cours',
    menu_review: 'Examen du menu',
    ready_to_publish: 'Prête à publier',
    published: 'Publiée',
    rejected: 'Rejetée',
    suspended: 'Suspendue',
    archived: 'Archivée',
  },
  ar: {
    draft: 'مسودة',
    submitted: 'تم الإرسال',
    under_review: 'قيد المراجعة',
    changes_requested: 'تعديلات مطلوبة',
    resubmitted: 'أعيد إرسالها',
    preliminarily_approved: 'موافقة أولية',
    onboarding_in_progress: 'الإعداد جارٍ',
    menu_review: 'مراجعة القائمة',
    ready_to_publish: 'جاهزة للنشر',
    published: 'منشورة',
    rejected: 'مرفوضة',
    suspended: 'معلّقة',
    archived: 'مؤرشفة',
  },
};

const RESTAURANT_STATUS: Record<Locale, Record<RestaurantStatus, string>> = {
  en: { draft: 'Draft', pending_approval: 'Pending approval', published: 'Published', hidden: 'Hidden', suspended: 'Suspended' },
  fr: { draft: 'Brouillon', pending_approval: 'En attente d’approbation', published: 'Publié', hidden: 'Masqué', suspended: 'Suspendu' },
  ar: { draft: 'مسودة', pending_approval: 'بانتظار الموافقة', published: 'منشور', hidden: 'مخفي', suspended: 'معلّق' },
};

const SETTLEMENT_STATUS: Record<Locale, Record<SettlementStatus, string>> = {
  en: { pending: 'Pending', paid: 'Paid', overdue: 'Overdue', disputed: 'Disputed', partially_paid: 'Partially paid' },
  fr: { pending: 'En attente', paid: 'Payée', overdue: 'En retard', disputed: 'Contestée', partially_paid: 'Partiellement payée' },
  ar: { pending: 'قيد الانتظار', paid: 'مدفوعة', overdue: 'متأخرة', disputed: 'متنازع عليها', partially_paid: 'مدفوعة جزئيا' },
};

const ORDER_STATUS: Record<Locale, Record<string, string>> = {
  en: {
    pending: 'Pending', pending_payment: 'Pending payment', placed: 'Placed', paid: 'Paid',
    accepted: 'Accepted', confirmed: 'Confirmed', preparing: 'Preparing', ready_for_pickup: 'Ready for pickup',
    assigned: 'Driver assigned', picked_up: 'Picked up', out_for_delivery: 'Out for delivery',
    delivered: 'Delivered', cancelled: 'Cancelled', failed_delivery: 'Delivery failed',
    refunded: 'Refunded', partially_refunded: 'Partially refunded',
  },
  fr: {
    pending: 'En attente', pending_payment: 'Paiement en attente', placed: 'Passée', paid: 'Payée',
    accepted: 'Acceptée', confirmed: 'Confirmée', preparing: 'En préparation', ready_for_pickup: 'Prête à récupérer',
    assigned: 'Livreur assigné', picked_up: 'Récupérée', out_for_delivery: 'En livraison',
    delivered: 'Livrée', cancelled: 'Annulée', failed_delivery: 'Échec de livraison',
    refunded: 'Remboursée', partially_refunded: 'Partiellement remboursée',
  },
  ar: {
    pending: 'قيد الانتظار', pending_payment: 'بانتظار الدفع', placed: 'تم إرسال الطلب', paid: 'مدفوع',
    accepted: 'مقبول', confirmed: 'مؤكد', preparing: 'قيد التحضير', ready_for_pickup: 'جاهز للاستلام',
    assigned: 'تم تعيين الموصّل', picked_up: 'تم الاستلام', out_for_delivery: 'في الطريق',
    delivered: 'تم التوصيل', cancelled: 'ملغى', failed_delivery: 'فشل التوصيل',
    refunded: 'تم رد المبلغ', partially_refunded: 'تم رد جزء من المبلغ',
  },
};

const DELIVERY_STATUS: Record<Locale, Record<string, string>> = {
  en: {
    assigned: 'Assigned', driver_accepted: 'Accepted', driver_declined: 'Declined',
    picking_up: 'Heading to restaurant', picked_up: 'Order collected', en_route: 'On the way',
    arrived: 'Arrived', delivered: 'Delivered', failed: 'Delivery failed',
  },
  fr: {
    assigned: 'Assignée', driver_accepted: 'Acceptée', driver_declined: 'Refusée',
    picking_up: 'En route vers le restaurant', picked_up: 'Commande récupérée', en_route: 'En route',
    arrived: 'Arrivé', delivered: 'Livrée', failed: 'Échec de livraison',
  },
  ar: {
    assigned: 'تم التعيين', driver_accepted: 'تم القبول', driver_declined: 'تم الرفض',
    picking_up: 'في الطريق إلى المطعم', picked_up: 'تم استلام الطلب', en_route: 'في الطريق',
    arrived: 'تم الوصول', delivered: 'تم التوصيل', failed: 'فشل التوصيل',
  },
};

const AUDIT_ACTION: Record<Locale, Record<string, string>> = {
  en: {
    status_change: 'Status changed', application_submitted: 'Application submitted',
    application_transition: 'Application status changed', internal_notes_updated: 'Internal notes updated',
    preliminary_approval: 'Preliminary approval granted', restaurant_published: 'Restaurant published',
    rule_override_set: 'Business rule override saved', rule_override_removed: 'Business rule override removed',
    delivery_status_transition: 'Delivery status changed', data_export_requested: 'Data export requested',
    account_deletion_requested: 'Account deletion requested', settlement_generated: 'Settlement generated',
    settlement_marked_paid: 'Settlement marked paid', user_suspended: 'User suspended',
    user_restored: 'User restored', restaurant_admin_update: 'Restaurant updated by admin',
    platform_setting_updated: 'Platform setting updated', force_close_order: 'Order force-closed',
    update_ticket_status: 'Support ticket status changed',
  },
  fr: {
    status_change: 'Statut modifié', application_submitted: 'Candidature envoyée',
    application_transition: 'Statut de candidature modifié', internal_notes_updated: 'Notes internes mises à jour',
    preliminary_approval: 'Approbation préliminaire accordée', restaurant_published: 'Restaurant publié',
    rule_override_set: 'Exception de règle enregistrée', rule_override_removed: 'Exception de règle supprimée',
    delivery_status_transition: 'Statut de livraison modifié', data_export_requested: 'Export de données demandé',
    account_deletion_requested: 'Suppression de compte demandée', settlement_generated: 'Règlement généré',
    settlement_marked_paid: 'Règlement marqué payé', user_suspended: 'Utilisateur suspendu',
    user_restored: 'Utilisateur rétabli', restaurant_admin_update: 'Restaurant mis à jour par l’administration',
    platform_setting_updated: 'Paramètre de plateforme modifié', force_close_order: 'Commande clôturée par l’administration',
    update_ticket_status: 'Statut du ticket d’assistance modifié',
  },
  ar: {
    status_change: 'تم تغيير الحالة', application_submitted: 'تم إرسال طلب الانضمام',
    application_transition: 'تم تغيير حالة الطلب', internal_notes_updated: 'تم تحديث الملاحظات الداخلية',
    preliminary_approval: 'تمت الموافقة الأولية', restaurant_published: 'تم نشر المطعم',
    rule_override_set: 'تم حفظ استثناء قاعدة العمل', rule_override_removed: 'تم حذف استثناء قاعدة العمل',
    delivery_status_transition: 'تم تغيير حالة التوصيل', data_export_requested: 'تم طلب تصدير البيانات',
    account_deletion_requested: 'تم طلب حذف الحساب', settlement_generated: 'تم إنشاء التسوية',
    settlement_marked_paid: 'تم تسجيل التسوية كمدفوعة', user_suspended: 'تم تعليق المستخدم',
    user_restored: 'تمت إعادة تفعيل المستخدم', restaurant_admin_update: 'تم تحديث المطعم من الإدارة',
    platform_setting_updated: 'تم تحديث إعداد المنصة', force_close_order: 'تم إغلاق الطلب إداريًا',
    update_ticket_status: 'تم تغيير حالة تذكرة الدعم',
  },
};

function fallbackStatus(status: string) {
  return status.replace(/_/g, ' ');
}

export function applicationStatusLabel(status: RestaurantApplicationStatus, locale: Locale) {
  return APPLICATION_STATUS[locale][status] ?? fallbackStatus(status);
}

export function restaurantStatusLabel(status: RestaurantStatus | string, locale: Locale) {
  return RESTAURANT_STATUS[locale][status as RestaurantStatus] ?? fallbackStatus(status);
}

export function settlementStatusLabel(status: SettlementStatus | string, locale: Locale) {
  return SETTLEMENT_STATUS[locale][status as SettlementStatus] ?? fallbackStatus(status);
}

export function orderStatusLabel(status: string, locale: Locale) {
  return ORDER_STATUS[locale][status] ?? fallbackStatus(status);
}

export function deliveryStatusLabel(status: string, locale: Locale) {
  return DELIVERY_STATUS[locale][status] ?? fallbackStatus(status);
}

export function auditActionLabel(action: string, locale: Locale) {
  return AUDIT_ACTION[locale][action] ?? fallbackStatus(action);
}
