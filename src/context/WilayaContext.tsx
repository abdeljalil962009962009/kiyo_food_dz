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
import { requestBestCurrentPosition } from '../lib/geo';

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

export const FALLBACK_WILAYAS: Wilaya[] = [
  { id: 1, name_en: 'Adrar', name_fr: 'Adrar', name_ar: 'أدرار', code: 'ADR', is_active: true },
  { id: 2, name_en: 'Chlef', name_fr: 'Chlef', name_ar: 'الشلف', code: 'CHL', is_active: true },
  { id: 3, name_en: 'Laghouat', name_fr: 'Laghouat', name_ar: 'الأغواط', code: 'LAG', is_active: true },
  { id: 4, name_en: 'Oum El Bouaghi', name_fr: 'Oum El Bouaghi', name_ar: 'أم البواقي', code: 'OEB', is_active: true },
  { id: 5, name_en: 'Batna', name_fr: 'Batna', name_ar: 'باتنة', code: 'BAT', is_active: true },
  { id: 6, name_en: 'Béjaïa', name_fr: 'Béjaïa', name_ar: 'بجاية', code: 'BJA', is_active: true },
  { id: 7, name_en: 'Biskra', name_fr: 'Biskra', name_ar: 'بسكرة', code: 'BIS', is_active: true },
  { id: 8, name_en: 'Béchar', name_fr: 'Béchar', name_ar: 'بشار', code: 'BEC', is_active: true },
  { id: 9, name_en: 'Blida', name_fr: 'Blida', name_ar: 'البليدة', code: 'BLI', is_active: true },
  { id: 10, name_en: 'Bouira', name_fr: 'Bouira', name_ar: 'البويرة', code: 'BOU', is_active: true },
  { id: 11, name_en: 'Tamanrasset', name_fr: 'Tamanrasset', name_ar: 'تمنراست', code: 'TAM', is_active: true },
  { id: 12, name_en: 'Tébessa', name_fr: 'Tébessa', name_ar: 'تبسة', code: 'TEB', is_active: true },
  { id: 13, name_en: 'Tlemcen', name_fr: 'Tlemcen', name_ar: 'تلمسان', code: 'TLE', is_active: true },
  { id: 14, name_en: 'Tiaret', name_fr: 'Tiaret', name_ar: 'تيارت', code: 'TIA', is_active: true },
  { id: 15, name_en: 'Tizi Ouzou', name_fr: 'Tizi Ouzou', name_ar: 'تيزي وزو', code: 'TIZ', is_active: true },
  { id: 16, name_en: 'Algiers', name_fr: 'Alger', name_ar: 'الجزائر', code: 'ALG', is_active: true },
  { id: 17, name_en: 'Djelfa', name_fr: 'Djelfa', name_ar: 'الجلفة', code: 'DJE', is_active: true },
  { id: 18, name_en: 'Jijel', name_fr: 'Jijel', name_ar: 'جيجل', code: 'JIJ', is_active: true },
  { id: 19, name_en: 'Sétif', name_fr: 'Sétif', name_ar: 'سطيف', code: 'SET', is_active: true },
  { id: 20, name_en: 'Saïda', name_fr: 'Saïda', name_ar: 'سعيدة', code: 'SAI', is_active: true },
  { id: 21, name_en: 'Skikda', name_fr: 'Skikda', name_ar: 'سكيكدة', code: 'SKI', is_active: true },
  { id: 22, name_en: 'Sidi Bel Abbès', name_fr: 'Sidi Bel Abbès', name_ar: 'سيدي بلعباس', code: 'SBA', is_active: true },
  { id: 23, name_en: 'Annaba', name_fr: 'Annaba', name_ar: 'عنابة', code: 'ANN', is_active: true },
  { id: 24, name_en: 'Guelma', name_fr: 'Guelma', name_ar: 'قالمة', code: 'GUE', is_active: true },
  { id: 25, name_en: 'Constantine', name_fr: 'Constantine', name_ar: 'قسنطينة', code: 'CON', is_active: true },
  { id: 26, name_en: 'Médéa', name_fr: 'Médéa', name_ar: 'المدية', code: 'MED', is_active: true },
  { id: 27, name_en: 'Mostaganem', name_fr: 'Mostaganem', name_ar: 'مستغانم', code: 'MOS', is_active: true },
  { id: 28, name_en: "M'Sila", name_fr: "M'Sila", name_ar: 'المسيلة', code: 'MSI', is_active: true },
  { id: 29, name_en: 'Mascara', name_fr: 'Mascara', name_ar: 'معسكر', code: 'MAS', is_active: true },
  { id: 30, name_en: 'Ouargla', name_fr: 'Ouargla', name_ar: 'ورقلة', code: 'OUA', is_active: true },
  { id: 31, name_en: 'Oran', name_fr: 'Oran', name_ar: 'وهران', code: 'ORA', is_active: true },
  { id: 32, name_en: 'El Bayadh', name_fr: 'El Bayadh', name_ar: 'البيض', code: 'EBA', is_active: true },
  { id: 33, name_en: 'Illizi', name_fr: 'Illizi', name_ar: 'إليزي', code: 'ILL', is_active: true },
  { id: 34, name_en: 'Bordj Bou Arréridj', name_fr: 'Bordj Bou Arréridj', name_ar: 'برج بوعريريج', code: 'BBA', is_active: true },
  { id: 35, name_en: 'Boumerdès', name_fr: 'Boumerdès', name_ar: 'بومرداس', code: 'BOM', is_active: true },
  { id: 36, name_en: 'El Tarf', name_fr: 'El Tarf', name_ar: 'الطارف', code: 'ETA', is_active: true },
  { id: 37, name_en: 'Tindouf', name_fr: 'Tindouf', name_ar: 'تندوف', code: 'TIN', is_active: true },
  { id: 38, name_en: 'Tissemsilt', name_fr: 'Tissemsilt', name_ar: 'تيسمسيلت', code: 'TIS', is_active: true },
  { id: 39, name_en: 'El Oued', name_fr: 'El Oued', name_ar: 'الوادي', code: 'ELO', is_active: true },
  { id: 40, name_en: 'Khenchela', name_fr: 'Khenchela', name_ar: 'خنشلة', code: 'KHE', is_active: true },
  { id: 41, name_en: 'Souk Ahras', name_fr: 'Souk Ahras', name_ar: 'سوق أهراس', code: 'SAH', is_active: true },
  { id: 42, name_en: 'Tipaza', name_fr: 'Tipaza', name_ar: 'تيبازة', code: 'TIP', is_active: true },
  { id: 43, name_en: 'Mila', name_fr: 'Mila', name_ar: 'ميلة', code: 'MIL', is_active: true },
  { id: 44, name_en: 'Aïn Defla', name_fr: 'Aïn Defla', name_ar: 'عين الدفلة', code: 'ADF', is_active: true },
  { id: 45, name_en: 'Naâma', name_fr: 'Naâma', name_ar: 'النعامة', code: 'NAA', is_active: true },
  { id: 46, name_en: 'Aïn Témouchent', name_fr: 'Aïn Témouchent', name_ar: 'عين تموشنت', code: 'ATE', is_active: true },
  { id: 47, name_en: 'Ghardaïa', name_fr: 'Ghardaïa', name_ar: 'غرداية', code: 'GHA', is_active: true },
  { id: 48, name_en: 'Relizane', name_fr: 'Relizane', name_ar: 'غليزان', code: 'REL', is_active: true },
  { id: 49, name_en: 'Timimoun', name_fr: 'Timimoun', name_ar: 'تيميمون', code: 'TIM', is_active: true },
  { id: 50, name_en: 'Bordj Badji Mokhtar', name_fr: 'Bordj Badji Mokhtar', name_ar: 'برج باجي مختار', code: 'BBM', is_active: true },
  { id: 51, name_en: 'Ouled Djellal', name_fr: 'Ouled Djellal', name_ar: 'أولاد جلال', code: 'ODJ', is_active: true },
  { id: 52, name_en: 'Béni Abbès', name_fr: 'Béni Abbès', name_ar: 'بني عباس', code: 'BNA', is_active: true },
  { id: 53, name_en: 'In Salah', name_fr: 'In Salah', name_ar: 'عين صالح', code: 'INS', is_active: true },
  { id: 54, name_en: 'In Guezzam', name_fr: 'In Guezzam', name_ar: 'عين قزام', code: 'ING', is_active: true },
  { id: 55, name_en: 'Touggourt', name_fr: 'Touggourt', name_ar: 'تقرت', code: 'TOU', is_active: true },
  { id: 56, name_en: 'Djanet', name_fr: 'Djanet', name_ar: 'جانت', code: 'DJA', is_active: true },
  { id: 57, name_en: "El M'Ghair", name_fr: "El M'Ghair", name_ar: 'المغير', code: 'EMG', is_active: true },
  { id: 58, name_en: 'El Meniaa', name_fr: 'El Meniaa', name_ar: 'المنيعة', code: 'EMN', is_active: true }
].sort((a, b) => a.name_fr.localeCompare(b.name_fr));

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
        
        let finalWilayas = data as Wilaya[];
        if (!finalWilayas || finalWilayas.length === 0) {
          finalWilayas = FALLBACK_WILAYAS;
        }
        setWilayas(finalWilayas);

        // Restore saved wilaya
        const savedId = localStorage.getItem(STORAGE_KEY);
        if (savedId) {
          const saved = finalWilayas.find((w: Wilaya) => w.id === parseInt(savedId, 10));
          if (saved) setSelectedWilayaState(saved);
        }
      } catch {
        // Fallback to static local list instead of failing
        setWilayas(FALLBACK_WILAYAS);
        
        const savedId = localStorage.getItem(STORAGE_KEY);
        if (savedId) {
          const saved = FALLBACK_WILAYAS.find((w: Wilaya) => w.id === parseInt(savedId, 10));
          if (saved) setSelectedWilayaState(saved);
        }
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
      const point = await new Promise<{ lat: number; lng: number }>((resolve, reject) => {
        requestBestCurrentPosition({
          purpose: 'wilaya',
          waitMs: 5000,
          onResult: ({ point: bestPoint }) => resolve({ lat: bestPoint.lat, lng: bestPoint.lng }),
          onError: reject,
        });
      });

      // Reverse geocode to get wilaya
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${point.lat}&lon=${point.lng}&zoom=6&addressdetails=1`,
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
