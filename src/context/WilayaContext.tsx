import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useMemo,
  type ReactNode,
} from 'react';
import { supabase } from '../lib/supabase';

export type Wilaya = {
  id: number;
  name_en: string;
  name_fr: string;
  name_ar: string;
  code: string;
  is_active: boolean;
};

type WilayaContextValue = {
  wilayas: Wilaya[];
  selectedWilaya: Wilaya | null;
  setSelectedWilaya: (wilaya: Wilaya | null) => void;
  loading: boolean;
  error: string | null;
  detectLocation: () => Promise<void>;
  detectionInProgress: boolean;
  locale: 'en' | 'fr' | 'ar';
};

const WilayaContext = createContext<WilayaContextValue | null>(null);

const STORAGE_KEY = 'kiyo-selected-wilaya';

export function WilayaProvider({ children, locale = 'fr' }: { children: ReactNode; locale?: 'en' | 'fr' | 'ar' }) {
  const [wilayas, setWilayas] = useState<Wilaya[]>([]);
  const [selectedWilaya, setSelectedWilayaState] = useState<Wilaya | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [detectionInProgress, setDetectionInProgress] = useState(false);

  // Load wilayas on mount
  useEffect(() => {
    const loadWilayas = async () => {
      try {
        const { data, error: e } = await supabase
          .from('wilayas')
          .select('*')
          .eq('is_active', true)
          .order('name_fr', { ascending: true });

        if (e) throw e;
        setWilayas(data as Wilaya[]);

        // Restore saved wilaya
        const savedId = localStorage.getItem(STORAGE_KEY);
        if (savedId) {
          const saved = data?.find((w: Wilaya) => w.id === parseInt(savedId, 10));
          if (saved) setSelectedWilayaState(saved as Wilaya);
        }
      } catch {
        setError('Failed to load wilayas');
      } finally {
        setLoading(false);
      }
    };
    void loadWilayas();
  }, []);

  // Save wilaya selection
  const setSelectedWilaya = useCallback((wilaya: Wilaya | null) => {
    setSelectedWilayaState(wilaya);
    if (wilaya) {
      localStorage.setItem(STORAGE_KEY, String(wilaya.id));
      // Also update user profile if logged in
      void supabase
        .from('profiles')
        .update({ selected_wilaya_id: wilaya.id })
        .then(() => {}, () => {});
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  }, []);

  // Geolocation detection with reverse geocoding
  const detectLocation = useCallback(async () => {
    if (!navigator.geolocation || detectionInProgress) return;

    setDetectionInProgress(true);
    setError(null);

    try {
      // Get GPS position
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: false,
          timeout: 10000,
          maximumAge: 300000, // 5 min cache
        });
      });

      const { latitude, longitude } = position.coords;

      // Reverse geocode to get wilaya
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${latitude}&lon=${longitude}&zoom=6&addressdetails=1`,
        { headers: { 'Accept-Language': 'en' } }
      );

      if (!res.ok) throw new Error('Geocoding failed');

      const data = await res.json();
      const state = data.address?.state || data.address?.region;

      if (state) {
        // Match wilaya by name (in any language)
        const normalizedState = state.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        const matched = wilayas.find((w) => {
          const names = [w.name_en, w.name_fr, w.name_ar].map((n) =>
            n.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
          );
          return names.some((n) => n.includes(normalizedState) || normalizedState.includes(n));
        });

        if (matched) {
          setSelectedWilaya(matched);
          return;
        }
      }

      setError('Could not determine your wilaya. Please select manually.');
    } catch (err) {
      if ((err as GeolocationPositionError).code === 1) {
        setError('Location permission denied. Please select your wilaya manually.');
      } else {
        setError('Could not detect location. Please select your wilaya manually.');
      }
    } finally {
      setDetectionInProgress(false);
    }
  }, [wilayas, detectionInProgress, setSelectedWilaya]);

  const value = useMemo(
    () => ({
      wilayas,
      selectedWilaya,
      setSelectedWilaya,
      loading,
      error,
      detectLocation,
      detectionInProgress,
      locale,
    }),
    [wilayas, selectedWilaya, setSelectedWilaya, loading, error, detectLocation, detectionInProgress, locale]
  );

  return <WilayaContext.Provider value={value}>{children}</WilayaContext.Provider>;
}

export function useWilaya(): WilayaContextValue {
  const ctx = useContext(WilayaContext);
  if (!ctx) throw new Error('useWilaya must be used within WilayaProvider');
  return ctx;
}

export function getWilayaName(wilaya: Wilaya | null, locale: 'en' | 'fr' | 'ar'): string {
  if (!wilaya) return '';
  switch (locale) {
    case 'en':
      return wilaya.name_en;
    case 'ar':
      return wilaya.name_ar;
    default:
      return wilaya.name_fr;
  }
}
