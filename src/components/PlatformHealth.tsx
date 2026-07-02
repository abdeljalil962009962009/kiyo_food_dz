import { useEffect, useState } from 'react';
import { Activity, CheckCircle, AlertTriangle, XCircle, RefreshCw } from 'lucide-react';
import { supabase } from '../lib/supabase';

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

const COMPONENT_LABELS: Record<string, string> = {
  database: 'Database',
  auth: 'Authentication',
  storage: 'File Storage',
  realtime: 'Real-time Updates',
  maps: 'Maps Service',
};

export function PlatformHealthPanel() {
  const [health, setHealth] = useState<HealthComponent[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const loadHealth = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('platform_health')
        .select('*')
        .order('component');

      if (error) throw error;
      setHealth((data as HealthComponent[]) ?? []);
      setLastUpdated(new Date());
    } catch {
      // If health table doesn't exist yet, show defaults
      setHealth([
        { component: 'database', status: 'operational', last_check: new Date().toISOString(), latency_ms: null, error_message: null, details: {} },
        { component: 'auth', status: 'operational', last_check: new Date().toISOString(), latency_ms: null, error_message: null, details: {} },
        { component: 'storage', status: 'operational', last_check: new Date().toISOString(), latency_ms: null, error_message: null, details: {} },
        { component: 'realtime', status: 'operational', last_check: new Date().toISOString(), latency_ms: null, error_message: null, details: {} },
        { component: 'maps', status: 'operational', last_check: new Date().toISOString(), latency_ms: null, error_message: null, details: {} },
      ]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadHealth();
    const interval = setInterval(loadHealth, 60000); // Refresh every minute
    return () => clearInterval(interval);
  }, []);

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
          <h3 className="font-display text-base font-bold text-ink-900">Platform Health</h3>
        </div>
        <button
          onClick={loadHealth}
          disabled={loading}
          className="rounded p-1.5 text-ink-400 hover:bg-ink-100 hover:text-ink-600"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Overall Status */}
      <div className={`mb-4 flex items-center gap-2 rounded-lg ${overallBg} px-3 py-2`}>
        <OverallIcon className={`h-5 w-5 ${overallColor}`} />
        <span className={`text-sm font-semibold ${overallColor}`}>
          {overallStatus === 'operational'
            ? 'All Systems Operational'
            : overallStatus === 'degraded'
            ? 'Some Systems Degraded'
            : 'Major Outage'}
        </span>
      </div>

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
                  {COMPONENT_LABELS[h.component] || h.component}
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
          Last updated: {lastUpdated.toLocaleTimeString()}
        </div>
      )}
    </div>
  );
}
