import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';

type FeatureFlags = {
  reviews: boolean;
  coupons: boolean;
  notifications: boolean;
  promotions: boolean;
  maps: boolean;
  chat: boolean;
  loyalty: boolean;
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
  error: string | null;
  reload: () => Promise<void>;
  features: FeatureFlags;
  isMaintenance: boolean;
};

const DEFAULT_FEATURES: FeatureFlags = {
  reviews: true,
  coupons: true,
  notifications: true,
  promotions: true,
  maps: true,
  chat: true,
  loyalty: true,
};

const DEFAULT_SETTINGS: PlatformSettings = {
  features: DEFAULT_FEATURES,
  maintenance: {
    enabled: false,
    message: '',
    allow_admin_access: true,
  },
  order_rules: {
    cancellation_window_minutes: 5,
    acceptance_timeout_minutes: 10,
    auto_cancel_after_timeout: true,
    busy_mode_threshold: 15,
    auto_busy_mode: true,
  },
};

function boolSetting(value: unknown, fallback: boolean) {
  return typeof value === 'boolean' ? value : fallback;
}

function normalizeFeatureFlags(value: unknown): FeatureFlags {
  const raw = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  return {
    reviews: boolSetting(raw.reviews ?? raw.reviews_enabled, DEFAULT_FEATURES.reviews),
    coupons: boolSetting(raw.coupons ?? raw.promo_codes_enabled, DEFAULT_FEATURES.coupons),
    notifications: boolSetting(raw.notifications ?? raw.notifications_enabled, DEFAULT_FEATURES.notifications),
    promotions: boolSetting(raw.promotions ?? raw.promotions_enabled, DEFAULT_FEATURES.promotions),
    maps: boolSetting(raw.maps ?? raw.delivery_map_enabled, DEFAULT_FEATURES.maps),
    chat: boolSetting(raw.chat ?? raw.chat_enabled, DEFAULT_FEATURES.chat),
    loyalty: boolSetting(raw.loyalty ?? raw.loyalty_points_enabled, DEFAULT_FEATURES.loyalty),
  };
}

const SettingsContext = createContext<SettingsContextValue>({
  settings: null,
  loading: true,
  error: null,
  reload: async () => {},
  features: DEFAULT_FEATURES,
  isMaintenance: false,
});

export function SettingsProvider({ children }: { children: ReactNode }) {
  const { profile } = useAuth();
  const [settings, setSettings] = useState<PlatformSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setError(null);
    try {
      const { data, error } = await supabase.from('platform_settings').select('key, value');
      if (error) throw error;
      if (!data) {
        setSettings(DEFAULT_SETTINGS);
        return;
      }

      const obj: Record<string, unknown> = {};
      for (const row of data) {
        try {
          obj[row.key] = typeof row.value === 'string' ? JSON.parse(row.value) : row.value;
        } catch (err) {
          console.error(`[Kiyo] Invalid platform setting JSON for ${row.key}:`, err);
          obj[row.key] = row.value;
        }
      }

      setSettings({
        ...DEFAULT_SETTINGS,
        ...obj,
        features: normalizeFeatureFlags(obj.features),
      } as PlatformSettings);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Platform settings could not be loaded.';
      console.error('[Kiyo] Platform settings load failed:', err);
      setError(message);
      setSettings(DEFAULT_SETTINGS);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void reload(); }, [reload]);

  const features = normalizeFeatureFlags(settings?.features);
  const isAdmin = profile?.role === 'super_admin';
  const maintenance = settings?.maintenance;
  const isMaintenance = maintenance?.enabled === true && !(maintenance.allow_admin_access && isAdmin);

  return (
    <SettingsContext.Provider value={{ settings, loading, error, reload, features, isMaintenance }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  return useContext(SettingsContext);
}
