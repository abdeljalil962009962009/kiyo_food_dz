import { useCallback, useEffect, useState } from 'react';
import { Activity, CheckCircle, AlertTriangle, XCircle, RefreshCw } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useT } from '../lib/i18n-react';
import type { Locale } from '../lib/i18n';
import { userFacingError } from '../lib/userFacingError';

type HealthStatus = 'operational' | 'degraded' | 'down';

type HealthComponent = {
  component: string;
  status: HealthStatus;
  last_check: string;
  latency_ms: number | null;
  error_message: string | null;
  details: Record<string, unknown>;
};

const STATUS_CONFIG: Record<HealthStatus, { icon: typeof CheckCircle; color: string; bg: string }> = {
  operational: { icon: CheckCircle, color: 'text-sage-600', bg: 'bg-sage-100' },
  degraded: { icon: AlertTriangle, color: 'text-amber-600', bg: 'bg-amber-100' },
  down: { icon: XCircle, color: 'text-error-600', bg: 'bg-error-100' },
};

const HEALTH_COPY = {
  en: {
    title: 'Platform health', refresh: 'Refresh platform health', operational: 'All systems operational',
    degraded: 'Some systems are degraded', down: 'Major service interruption',
    liveUnavailable: 'Live health data is temporarily unavailable', unavailable: 'Status unavailable',
    lastUpdated: 'Last updated', database: 'Database', auth: 'Authentication',
    storage: 'File storage', realtime: 'Real-time updates', maps: 'Maps service',
  },
  fr: {
    title: 'État de la plateforme', refresh: 'Actualiser l’état de la plateforme', operational: 'Tous les services sont opérationnels',
    degraded: 'Certains services sont perturbés', down: 'Interruption majeure des services',
    liveUnavailable: 'Les données de santé en direct sont temporairement indisponibles', unavailable: 'État indisponible',
    lastUpdated: 'Dernière mise à jour', database: 'Base de données', auth: 'Authentification',
    storage: 'Stockage de fichiers', realtime: 'Mises à jour en temps réel', maps: 'Service cartographique',
  },
  ar: {
    title: 'حالة المنصة', refresh: 'تحديث حالة المنصة', operational: 'جميع الخدمات تعمل بشكل طبيعي',
    degraded: 'بعض الخدمات تعمل بشكل محدود', down: 'انقطاع كبير في الخدمات',
    liveUnavailable: 'بيانات حالة المنصة المباشرة غير متاحة مؤقتًا', unavailable: 'الحالة غير متاحة',
    lastUpdated: 'آخر تحديث', database: 'قاعدة البيانات', auth: 'تسجيل الدخول',
    storage: 'تخزين الملفات', realtime: 'التحديثات المباشرة', maps: 'خدمة الخرائط',
  },
} as const;

const healthCopy = (locale: Locale) => HEALTH_COPY[locale] ?? HEALTH_COPY.fr;

export function PlatformHealthPanel() {
  const { locale, t } = useT();
  const copy = healthCopy(locale);
  const [health, setHealth] = useState<HealthComponent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const loadHealth = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error } = await supabase
        .from('platform_health')
        .select('*')
        .order('component');

      if (error) throw error;
      setHealth((data as HealthComponent[]) ?? []);
      setLastUpdated(new Date());
    } catch (err) {
      const message = userFacingError(err, locale, t('error.genericBody'));
      setError(message);
      setHealth([
        { component: 'database', status: 'degraded', last_check: new Date().toISOString(), latency_ms: null, error_message: message, details: {} },
        { component: 'auth', status: 'degraded', last_check: new Date().toISOString(), latency_ms: null, error_message: copy.unavailable, details: {} },
        { component: 'storage', status: 'degraded', last_check: new Date().toISOString(), latency_ms: null, error_message: copy.unavailable, details: {} },
        { component: 'realtime', status: 'degraded', last_check: new Date().toISOString(), latency_ms: null, error_message: copy.unavailable, details: {} },
        { component: 'maps', status: 'degraded', last_check: new Date().toISOString(), latency_ms: null, error_message: copy.unavailable, details: {} },
      ]);
    } finally {
      setLoading(false);
    }
  }, [copy.unavailable, locale, t]);

  useEffect(() => {
    void loadHealth();
    const interval = setInterval(loadHealth, 60000); // Refresh every minute
    return () => clearInterval(interval);
  }, [loadHealth]);

  const overallStatus: HealthStatus = health.some(h => h.status === 'down')
    ? 'down'
    : health.some(h => h.status === 'degraded')
    ? 'degraded'
    : 'operational';

  const { icon: OverallIcon, color: overallColor, bg: overallBg } = STATUS_CONFIG[overallStatus];

  return (
    <div className="kiyo-card">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Activity className="h-5 w-5 text-ink-600" />
          <h3 className="font-display text-base font-bold text-ink-900">{copy.title}</h3>
        </div>
        <button
          onClick={loadHealth}
          disabled={loading}
          className="flex min-h-11 min-w-11 items-center justify-center rounded text-ink-400 hover:bg-ink-100 hover:text-ink-600"
          aria-label={copy.refresh}
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Overall Status */}
      <div className={`mb-4 flex items-center gap-2 rounded-lg ${overallBg} px-3 py-2`}>
        <OverallIcon className={`h-5 w-5 ${overallColor}`} />
        <span className={`text-sm font-semibold ${overallColor}`}>
          {overallStatus === 'operational'
            ? copy.operational
            : overallStatus === 'degraded'
            ? copy.degraded
            : copy.down}
        </span>
      </div>
      {error && (
        <div className="mb-4 rounded-lg border border-warning-200 bg-warning-500/10 px-3 py-2 text-xs font-medium text-warning-700">
          {copy.liveUnavailable}: {error}
        </div>
      )}

      {/* Component Status Grid */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {health.map((h) => {
          const config = STATUS_CONFIG[h.status];
          const Icon = config.icon;
          return (
            <div
              key={h.component}
              className={`flex items-center gap-2 rounded-lg ${config.bg} px-3 py-2`}
            >
              <Icon className={`h-4 w-4 ${config.color}`} />
              <div className="min-w-0 flex-1">
                <div className="truncate text-xs font-medium text-ink-700">
                  {copy[h.component as keyof typeof copy] || h.component}
                </div>
                {h.latency_ms !== null && (
                  <div className="text-[10px] text-ink-500">{h.latency_ms}ms</div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {lastUpdated && (
        <div className="mt-3 text-xs text-ink-400">
          {copy.lastUpdated}: {lastUpdated.toLocaleTimeString(locale === 'ar' ? 'ar-DZ' : locale === 'fr' ? 'fr-DZ' : 'en-DZ')}
        </div>
      )}
    </div>
  );
}
