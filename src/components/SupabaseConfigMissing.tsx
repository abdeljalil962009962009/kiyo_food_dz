import { useState } from 'react';
import { AlertTriangle, Check, Copy, Database, Key, RefreshCw, ShieldCheck, Sparkles } from 'lucide-react';
import type { Locale } from '../lib/i18n';

const CONFIG_COPY = {
  en: {
    title: 'Supabase production setup required',
    body: 'Kiyo Food is blocking startup because the Supabase environment variables are missing or invalid. This is intentional: production must never connect silently to a placeholder database.',
    copyError: 'The checklist could not be copied. Select it manually and try again.',
    variablesTitle: '1. Add Vercel environment variables',
    variablesBody: 'In Vercel, open Project Settings, then Environment Variables, and add the production Supabase values:',
    projectUrl: 'Supabase project URL', publicKey: 'Public anonymous key',
    schemaTitle: '2. Apply the database schema',
    schemaBody: 'Apply the SQL files in supabase/migrations to production in filename order. These versioned migrations are the source of truth for tables, security, maps, finance, delivery rules, and owner controls.',
    schemaWarning: 'Do not use old copied setup snippets in production. They may omit later security migrations.',
    ownerTitle: '3. Verify owner access through RBAC',
    ownerBody: 'Do not rely on a hardcoded email or a browser-only permission. Create the owner account, assign super_admin in the production database, and confirm RLS blocks unauthorized users.',
    copied: 'Checklist copied', copy: 'Copy production checklist', recheck: 'Recheck configuration',
    footer: 'Kiyo Food DZ · secure production configuration',
    checklist: 'KIYO FOOD PRODUCTION CHECKLIST\n\n1. Configure Vercel production variables.\n2. Apply every Supabase migration in order.\n3. Verify RLS and owner RBAC.\n4. Verify login, checkout, restaurant orders, delivery, and owner controls.',
  },
  fr: {
    title: 'Configuration Supabase de production requise',
    body: 'Kiyo Food bloque le démarrage car les variables Supabase sont absentes ou invalides. C’est volontaire : la production ne doit jamais se connecter silencieusement à une base factice.',
    copyError: 'Impossible de copier la liste. Sélectionnez-la manuellement puis réessayez.',
    variablesTitle: '1. Ajouter les variables Vercel',
    variablesBody: 'Dans Vercel, ouvrez Paramètres du projet, puis Variables d’environnement, et ajoutez les valeurs Supabase de production :',
    projectUrl: 'URL du projet Supabase', publicKey: 'Clé publique anonyme',
    schemaTitle: '2. Appliquer le schéma de base de données',
    schemaBody: 'Appliquez les fichiers SQL de supabase/migrations en production selon l’ordre des noms. Ces migrations versionnées sont la référence pour les tables, la sécurité, les cartes, la finance, la livraison et les contrôles propriétaire.',
    schemaWarning: 'N’utilisez pas d’anciens extraits de configuration en production. Ils peuvent omettre des migrations de sécurité récentes.',
    ownerTitle: '3. Vérifier l’accès propriétaire avec le RBAC',
    ownerBody: 'Ne vous fiez pas à un e-mail codé en dur ni à une permission côté navigateur. Créez le compte propriétaire, attribuez super_admin dans la base de production et vérifiez que RLS bloque les accès non autorisés.',
    copied: 'Liste copiée', copy: 'Copier la liste de production', recheck: 'Revérifier la configuration',
    footer: 'Kiyo Food DZ · configuration de production sécurisée',
    checklist: 'LISTE DE CONTRÔLE PRODUCTION KIYO FOOD\n\n1. Configurer les variables Vercel de production.\n2. Appliquer toutes les migrations Supabase dans l’ordre.\n3. Vérifier RLS et le RBAC propriétaire.\n4. Vérifier la connexion, le paiement, les commandes, la livraison et les contrôles propriétaire.',
  },
  ar: {
    title: 'يلزم إعداد Supabase لبيئة الإنتاج',
    body: 'أوقفت Kiyo Food التشغيل لأن متغيرات Supabase مفقودة أو غير صالحة. هذا إجراء مقصود: يجب ألا تتصل بيئة الإنتاج بقاعدة تجريبية دون تنبيه.',
    copyError: 'تعذر نسخ القائمة. حدّد النص يدويًا ثم حاول مجددًا.',
    variablesTitle: '1. إضافة متغيرات Vercel',
    variablesBody: 'في Vercel افتح إعدادات المشروع ثم متغيرات البيئة، وأضف قيم Supabase الخاصة بالإنتاج:',
    projectUrl: 'رابط مشروع Supabase', publicKey: 'المفتاح العام المجهول',
    schemaTitle: '2. تطبيق مخطط قاعدة البيانات',
    schemaBody: 'طبّق ملفات SQL داخل supabase/migrations على الإنتاج حسب ترتيب أسماء الملفات. هذه الترحيلات المرقّمة هي المرجع للجداول والأمان والخرائط والمالية وقواعد التوصيل ولوحة المالك.',
    schemaWarning: 'لا تستخدم نسخ إعداد قديمة في الإنتاج، فقد تفتقد ترحيلات الأمان الحديثة.',
    ownerTitle: '3. التحقق من صلاحية المالك عبر نظام الأدوار',
    ownerBody: 'لا تعتمد على بريد ثابت أو صلاحية داخل المتصفح فقط. أنشئ حساب المالك، وامنحه super_admin داخل قاعدة الإنتاج، وتأكد أن RLS يمنع المستخدمين غير المصرح لهم.',
    copied: 'تم نسخ القائمة', copy: 'نسخ قائمة إعداد الإنتاج', recheck: 'إعادة فحص الإعداد',
    footer: 'Kiyo Food DZ · إعداد إنتاج آمن',
    checklist: 'قائمة فحص إنتاج KIYO FOOD\n\n1. ضبط متغيرات Vercel للإنتاج.\n2. تطبيق كل ترحيلات Supabase بالترتيب.\n3. التحقق من RLS وصلاحية المالك.\n4. التحقق من الدخول والطلب وطلبات المطعم والتوصيل ولوحة المالك.',
  },
} as const;

function preferredSetupLocale(): Locale {
  const stored = typeof window !== 'undefined' ? window.localStorage.getItem('kiyo-locale') : null;
  if (stored === 'ar' || stored === 'en' || stored === 'fr') return stored;
  if (typeof navigator !== 'undefined' && navigator.language.toLowerCase().startsWith('ar')) return 'ar';
  if (typeof navigator !== 'undefined' && navigator.language.toLowerCase().startsWith('en')) return 'en';
  return 'fr';
}

export function SupabaseConfigMissing() {
  const locale = preferredSetupLocale();
  const tx = CONFIG_COPY[locale];
  const [copiedChecklist, setCopiedChecklist] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleReload = () => {
    window.location.reload();
  };

  const productionChecklist = tx.checklist;

  const handleCopyChecklist = async () => {
    try {
      await navigator.clipboard.writeText(productionChecklist);
      setCopiedChecklist(true);
      setTimeout(() => setCopiedChecklist(false), 3000);
    } catch (err) {
      console.error('[Kiyo] Production checklist copy failed:', err);
      setError(tx.copyError);
    }
  };

  return (
    <div dir={locale === 'ar' ? 'rtl' : 'ltr'} lang={locale} className="flex min-h-screen flex-col items-center justify-center bg-[#fdfdfc] p-6 text-slate-800 antialiased selection:bg-amber-100">
      <div className="w-full max-w-2xl rounded-3xl border border-amber-100 bg-white p-8 shadow-md md:p-12">
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-50 text-amber-600">
            <Database className="h-6 w-6" />
          </div>
          <div>
            <span className="text-xs font-semibold uppercase tracking-wider text-amber-600">
              Kiyo Food DZ
            </span>
            <h1 className="font-display text-2xl font-black tracking-tight text-slate-900 md:text-3xl">
              {tx.title}
            </h1>
          </div>
        </div>

        <p className="mt-6 text-sm leading-relaxed text-slate-600">
          {tx.body}
        </p>

        {error && (
          <div className="mt-4 flex items-center gap-2 rounded-xl border border-red-100 bg-red-50 p-4 text-xs font-medium text-red-600">
            <AlertTriangle className="h-4 w-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="mt-8 space-y-6">
          <div className="rounded-2xl border border-slate-100 bg-slate-50 p-5">
            <h2 className="flex items-center gap-2 text-sm font-bold text-slate-900">
              <Key className="h-4 w-4 text-amber-500" />
              {tx.variablesTitle}
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              {tx.variablesBody}
            </p>
            <div className="mt-3 space-y-2">
              <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2">
                <code className="select-all font-mono text-xs font-bold text-amber-600">VITE_SUPABASE_URL</code>
                <span className="text-[10px] font-medium text-slate-400">{tx.projectUrl}</span>
              </div>
              <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2">
                <code className="select-all font-mono text-xs font-bold text-amber-600">VITE_SUPABASE_ANON_KEY</code>
                <span className="text-[10px] font-medium text-slate-400">{tx.publicKey}</span>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-amber-100/50 bg-amber-50/40 p-5">
            <h2 className="flex items-center gap-2 text-sm font-bold text-slate-900">
              <Sparkles className="h-4 w-4 text-amber-500" />
              {tx.schemaTitle}
            </h2>
            <p className="mt-1.5 text-xs text-slate-600">
              {tx.schemaBody}
            </p>

            <p className="mt-3 rounded-xl border border-amber-100 bg-white/70 px-3 py-2 text-xs text-slate-600">
              {tx.schemaWarning}
            </p>
          </div>

          <div className="rounded-2xl border border-blue-100/50 bg-blue-50/50 p-5">
            <h2 className="flex items-center gap-2 text-sm font-bold text-blue-900">
              <ShieldCheck className="h-4 w-4 text-blue-600" />
              {tx.ownerTitle}
            </h2>
            <p className="mt-1.5 text-xs leading-relaxed text-slate-600">
              {tx.ownerBody}
            </p>
            <button
              onClick={handleCopyChecklist}
              className="mt-3 flex items-center gap-2 rounded-lg bg-blue-100/70 px-3 py-1.5 text-[11px] font-semibold text-blue-900 transition-all hover:bg-blue-100"
            >
              {copiedChecklist ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
              {copiedChecklist ? tx.copied : tx.copy}
            </button>
          </div>
        </div>

        <div className="mt-10 flex flex-col gap-3 sm:flex-row">
          <button
            onClick={handleReload}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-amber-500 px-5 py-4 text-sm font-bold text-white shadow-md shadow-amber-500/10 transition-all hover:bg-amber-600 active:scale-[0.98]"
          >
            <RefreshCw className="h-4 w-4" />
            {tx.recheck}
          </button>
        </div>
      </div>
      <p className="mt-6 text-xs text-slate-400">
        {tx.footer}
      </p>
    </div>
  );
}
