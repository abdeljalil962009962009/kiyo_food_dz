import type { Locale } from './i18n';

type ErrorCopy = {
  offline: string;
  timeout: string;
  rateLimited: string;
  forbidden: string;
  conflict: string;
  unavailable: string;
};

const ERROR_COPY: Record<Locale, ErrorCopy> = {
  en: {
    offline: 'You appear to be offline. Reconnect, then try again.',
    timeout: 'This is taking longer than expected. Check your connection and try again.',
    rateLimited: 'Too many attempts were made. Wait a moment, then try again.',
    forbidden: 'This action is not available for your account. Refresh the page or contact Kiyo Food support.',
    conflict: 'This information changed in another session. Refresh it before trying again.',
    unavailable: 'This service is temporarily unavailable. Your information is safe; try again shortly.',
  },
  fr: {
    offline: 'Vous semblez hors ligne. Reconnectez-vous, puis réessayez.',
    timeout: 'Cette opération prend plus de temps que prévu. Vérifiez votre connexion puis réessayez.',
    rateLimited: 'Trop de tentatives ont été effectuées. Patientez un instant puis réessayez.',
    forbidden: 'Cette action n’est pas disponible pour votre compte. Actualisez la page ou contactez le support Kiyo Food.',
    conflict: 'Ces informations ont changé dans une autre session. Actualisez-les avant de réessayer.',
    unavailable: 'Ce service est temporairement indisponible. Vos informations sont conservées ; réessayez dans un instant.',
  },
  ar: {
    offline: 'يبدو أنك غير متصل بالإنترنت. أعد الاتصال ثم حاول مجدداً.',
    timeout: 'تستغرق هذه العملية وقتاً أطول من المتوقع. تحقق من الاتصال ثم حاول مجدداً.',
    rateLimited: 'تمت محاولات كثيرة خلال وقت قصير. انتظر قليلاً ثم حاول مجدداً.',
    forbidden: 'هذا الإجراء غير متاح لحسابك. حدّث الصفحة أو تواصل مع دعم كيو فود.',
    conflict: 'تم تغيير هذه المعلومات في جلسة أخرى. حدّث الصفحة قبل المحاولة مجدداً.',
    unavailable: 'الخدمة غير متاحة مؤقتاً. معلوماتك محفوظة؛ حاول مجدداً بعد قليل.',
  },
};

function errorText(error: unknown): string {
  if (typeof error === 'string') return error;
  if (!error || typeof error !== 'object') return '';
  const candidate = error as { name?: unknown; message?: unknown; details?: unknown; hint?: unknown; code?: unknown; status?: unknown };
  return [candidate.name, candidate.message, candidate.details, candidate.hint, candidate.code, candidate.status]
    .filter((value): value is string | number => typeof value === 'string' || typeof value === 'number')
    .join(' ')
    .toLowerCase();
}

/**
 * Converts infrastructure/database errors into concise recovery guidance.
 * Raw SQL, policy, API and stack details must stay in diagnostics, not customer UI.
 */
export function userFacingError(error: unknown, locale: Locale, fallback: string): string {
  const text = errorText(error);
  const copy = ERROR_COPY[locale];

  if (!text) return fallback;
  if (/offline|network|failed to fetch|load failed|internet|err_internet_disconnected/.test(text)) return copy.offline;
  if (/timeout|timed out|aborterror|57014/.test(text)) return copy.timeout;
  if (/rate.?limit|too many|429/.test(text)) return copy.rateLimited;
  if (/permission denied|row-level security|rls|forbidden|unauthorized|401|403|42501/.test(text)) return copy.forbidden;
  if (/conflict|stale|already changed|version mismatch|409|23505/.test(text)) return copy.conflict;
  if (/unavailable|over.?quota|quota|502|503|504|pgrst/.test(text)) return copy.unavailable;
  return fallback;
}
