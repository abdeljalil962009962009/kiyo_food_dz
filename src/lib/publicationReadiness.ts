import type { Locale } from './i18n';

const blockerTranslations: Record<string, Record<Locale, string>> = {
  'Restaurant does not exist.': {
    en: 'The restaurant record does not exist.',
    fr: "Le dossier du restaurant n'existe pas.",
    ar: 'سجل المطعم غير موجود.',
  },
  'Application has not completed preliminary approval.': {
    en: 'The application has not received preliminary approval.',
    fr: "La demande n'a pas encore reçu l'approbation préliminaire.",
    ar: 'لم يحصل الطلب بعد على الموافقة الأولية.',
  },
  'No active restaurant owner membership exists.': {
    en: 'No active restaurant owner is assigned.',
    fr: "Aucun propriétaire actif n'est associé au restaurant.",
    ar: 'لا يوجد مالك مطعم نشط مرتبط بالمطعم.',
  },
  'Commercial terms are not approved and active.': {
    en: 'Commercial terms are not approved and active.',
    fr: 'Les conditions commerciales ne sont pas approuvées et actives.',
    ar: 'الشروط التجارية غير معتمدة ونشطة.',
  },
  'Public restaurant name is missing.': {
    en: 'The public restaurant name is missing.',
    fr: 'Le nom public du restaurant est manquant.',
    ar: 'اسم المطعم العام غير موجود.',
  },
  'Restaurant contact phone is missing.': {
    en: 'The restaurant contact phone is missing.',
    fr: 'Le numéro de téléphone du restaurant est manquant.',
    ar: 'رقم هاتف المطعم غير موجود.',
  },
  'Restaurant address is missing.': {
    en: 'The restaurant address is missing.',
    fr: "L'adresse du restaurant est manquante.",
    ar: 'عنوان المطعم غير موجود.',
  },
  'Restaurant coordinates are missing or unverified.': {
    en: 'The restaurant location is missing or unverified.',
    fr: "L'emplacement du restaurant est manquant ou non vérifié.",
    ar: 'موقع المطعم غير موجود أو غير موثق.',
  },
  'Opening hours are not configured.': {
    en: 'Opening hours are not configured.',
    fr: "Les horaires d'ouverture ne sont pas configurés.",
    ar: 'ساعات العمل غير مضبوطة.',
  },
  'A public restaurant image or logo is required.': {
    en: 'A public restaurant image or logo is required.',
    fr: 'Une image publique ou un logo du restaurant est requis.',
    ar: 'يجب إضافة صورة عامة أو شعار للمطعم.',
  },
  'Delivery coverage is not configured.': {
    en: 'Delivery coverage is not configured.',
    fr: "La zone de livraison n'est pas configurée.",
    ar: 'نطاق التوصيل غير مضبوط.',
  },
  'No menu category exists.': {
    en: 'Create at least one menu category.',
    fr: 'Créez au moins une catégorie de menu.',
    ar: 'أنشئ فئة واحدة على الأقل في القائمة.',
  },
  'No active, correctly priced dish exists.': {
    en: 'Add at least one available dish with a valid price.',
    fr: 'Ajoutez au moins un plat disponible avec un prix valide.',
    ar: 'أضف طبقًا متاحًا واحدًا على الأقل بسعر صالح.',
  },
  'A blocking change request is unresolved.': {
    en: 'A requested blocking change has not been resolved.',
    fr: "Une demande de modification bloquante n'est pas résolue.",
    ar: 'يوجد طلب تعديل إلزامي لم تتم معالجته.',
  },
};

export function localizePublicationBlocker(blocker: string, locale: Locale): string {
  return blockerTranslations[blocker]?.[locale] ?? blocker;
}

