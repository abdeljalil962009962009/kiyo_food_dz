import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';

type FeatureFlags = {
  reviews: boolean;
  coupons: boolean;
  notifications: boolean;
  promotions: boolean;
};

type MaintenanceConfig = {
  enabled: boolean;
  message: string;
  allow_admin_access: boolean;
};

type PlatformSettings = {
  features: FeatureFlags;
  maintenance: MaintenanceConfig;
  order_rules: {
    cancellation_window_minutes: number;
    acceptance_timeout_minutes: number;
    auto_cancel_after_timeout: boolean;
    busy_mode_threshold: number;
    auto_busy_mode: boolean;
  };
  [key: string]: unknown;
};

type SettingsContextValue = {
  settings: PlatformSettings | null;
  loading: boolean;
  reload: () => Promise<void>;
  features: FeatureFlags;
  isMaintenance: boolean;
};

const DEFAULT_FEATURES: FeatureFlags = {
  reviews: true, coupons: true, notifications: true, promotions: true,
};

const SettingsContext = createContext<SettingsContextValue>({
  settings: null,
  loading: true,
  reload: async () => {},
  features: DEFAULT_FEATURES,
  isMaintenance: false,
});

export function SettingsProvider({ children }: { children: ReactNode }) {
  const { profile } = useAuth();
  const [settings, setSettings] = useState<PlatformSettings | null>(null);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    try {
      const { data, error } = await supabase.from('platform_settings').select('key, value');
      if (error || !data) return;
      const obj: Record<string, unknown> = {};
      for (const row of data) {
        try { obj[row.key] = typeof row.value === 'string' ? JSON.parse(row.value) : row.value; }
        catch { obj[row.key] = row.value; }
      }
      setSettings(obj as PlatformSettings);
    } catch {
      // non-fatal — use defaults
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void reload(); }, [reload]);

  const features = settings?.features ?? DEFAULT_FEATURES;
  const isAdmin = profile?.role === 'super_admin';
  const maintenance = settings?.maintenance;
  const isMaintenance = maintenance?.enabled === true && !(maintenance.allow_admin_access && isAdmin);

  return (
    <SettingsContext.Provider value={{ settings, loading, reload, features, isMaintenance }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  return useContext(SettingsContext);
}
