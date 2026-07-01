-- ============================================================================
-- FOUNDATION FIXES: Remove Hardcoded Dependencies + Multi-Wilaya Support
-- Issue #1: Hardcoded admin email removed from triggers
-- Issue #2: City default removed - now nullable for multi-wilaya support
-- Issue #3: Wilayas table created for nationwide expansion
-- Issue #4: Centralized currency configuration added
-- ============================================================================

-- ============================================================================
-- 1. WILAYAS TABLE - Multi-region support
-- ============================================================================
CREATE TABLE IF NOT EXISTS wilayas (
  id smallint PRIMARY KEY,
  name_en text NOT NULL,
  name_fr text NOT NULL,
  name_ar text NOT NULL,
  code text NOT NULL UNIQUE,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Insert all 58 Algerian Wilayas
INSERT INTO wilayas (id, name_en, name_fr, name_ar, code, is_active) VALUES
(1, 'Adrar', 'Adrar', 'أدرار', 'ADR', true),
(2, 'Chlef', 'Chlef', 'الشلف', 'CHL', true),
(3, 'Laghouat', 'Laghouat', 'الأغواط', 'LAG', true),
(4, 'Oum El Bouaghi', 'Oum El Bouaghi', 'أم البواقي', 'OEB', true),
(5, 'Batna', 'Batna', 'باتنة', 'BAT', true),
(6, 'Béjaïa', 'Béjaïa', 'بجاية', 'BJA', true),
(7, 'Biskra', 'Biskra', 'بسكرة', 'BIS', true),
(8, 'Béchar', 'Béchar', 'بشار', 'BEC', true),
(9, 'Blida', 'Blida', 'البليدة', 'BLI', true),
(10, 'Bouira', 'Bouira', 'البويرة', 'BOU', true),
(11, 'Tamanrasset', 'Tamanrasset', 'تمنراست', 'TAM', true),
(12, 'Tébessa', 'Tébessa', 'تبسة', 'TEB', true),
(13, 'Tlemcen', 'Tlemcen', 'تلمسان', 'TLE', true),
(14, 'Tiaret', 'Tiaret', 'تيارت', 'TIA', true),
(15, 'Tizi Ouzou', 'Tizi Ouzou', 'تيزي وزو', 'TIZ', true),
(16, 'Algiers', 'Alger', 'الجزائر', 'ALG', true),
(17, 'Djelfa', 'Djelfa', 'الجلفة', 'DJE', true),
(18, 'Jijel', 'Jijel', 'جيجل', 'JIJ', true),
(19, 'Sétif', 'Sétif', 'سطيف', 'SET', true),
(20, 'Saïda', 'Saïda', 'سعيدة', 'SAI', true),
(21, 'Skikda', 'Skikda', 'سكيكدة', 'SKI', true),
(22, 'Sidi Bel Abbès', 'Sidi Bel Abbès', 'سيدي بلعباس', 'SBA', true),
(23, 'Annaba', 'Annaba', 'عنابة', 'ANN', true),
(24, 'Guelma', 'Guelma', 'قالمة', 'GUE', true),
(25, 'Constantine', 'Constantine', 'قسنطينة', 'CON', true),
(26, 'Médéa', 'Médéa', 'المدية', 'MED', true),
(27, 'Mostaganem', 'Mostaganem', 'مستغانم', 'MOS', true),
(28, 'M''Sila', 'M''Sila', 'المسيلة', 'MSI', true),
(29, 'Mascara', 'Mascara', 'معسكر', 'MAS', true),
(30, 'Ouargla', 'Ouargla', 'ورقلة', 'OUA', true),
(31, 'Oran', 'Oran', 'وهران', 'ORA', true),
(32, 'El Bayadh', 'El Bayadh', 'البيض', 'EBA', true),
(33, 'Illizi', 'Illizi', 'إليزي', 'ILL', true),
(34, 'Bordj Bou Arréridj', 'Bordj Bou Arréridj', 'برج بوعريريج', 'BBA', true),
(35, 'Boumerdès', 'Boumerdès', 'بومرداس', 'BOM', true),
(36, 'El Tarf', 'El Tarf', 'الطارف', 'ETA', true),
(37, 'Tindouf', 'Tindouf', 'تندوف', 'TIN', true),
(38, 'Tissemsilt', 'Tissemsilt', 'تيسمسيلت', 'TIS', true),
(39, 'El Oued', 'El Oued', 'الوادي', 'ELO', true),
(40, 'Khenchela', 'Khenchela', 'خنشلة', 'KHE', true),
(41, 'Souk Ahras', 'Souk Ahras', 'سوق أهراس', 'SAH', true),
(42, 'Tipaza', 'Tipaza', 'تيبازة', 'TIP', true),
(43, 'Mila', 'Mila', 'ميلة', 'MIL', true),
(44, 'Aïn Defla', 'Aïn Defla', 'عين الدفلة', 'ADF', true),
(45, 'Naâma', 'Naâma', 'النعامة', 'NAA', true),
(46, 'Aïn Témouchent', 'Aïn Témouchent', 'عين تموشنت', 'ATE', true),
(47, 'Ghardaïa', 'Ghardaïa', 'غرداية', 'GHA', true),
(48, 'Relizane', 'Relizane', 'غليزان', 'REL', true),
(49, 'Timimoun', 'Timimoun', 'تيميمون', 'TIM', true),
(50, 'Bordj Badji Mokhtar', 'Bordj Badji Mokhtar', 'برج باجي مختار', 'BBM', true),
(51, 'Ouled Djellal', 'Ouled Djellal', 'أولاد جلال', 'ODJ', true),
(52, 'Béni Abbès', 'Béni Abbès', 'بني عباس', 'BNA', true),
(53, 'In Salah', 'In Salah', 'عين صالح', 'INS', true),
(54, 'In Guezzam', 'In Guezzam', 'عين قزام', 'ING', true),
(55, 'Touggourt', 'Touggourt', 'تقرت', 'TOU', true),
(56, 'Djanet', 'Djanet', 'جانت', 'DJA', true),
(57, 'El M''Ghair', 'El M''Ghair', 'المغير', 'EMG', true),
(58, 'El Meniaa', 'El Meniaa', 'المنيعة', 'EMN', true)
ON CONFLICT (id) DO NOTHING;

CREATE INDEX IF NOT EXISTS idx_wilayas_active ON wilayas(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_wilayas_code ON wilayas(code);

-- Add wilaya_id to restaurants (nullable - no default)
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS wilaya_id smallint REFERENCES wilayas(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_restaurants_wilaya ON restaurants(wilaya_id);

-- Add wilaya_id to profiles for user location preference
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS selected_wilaya_id smallint REFERENCES wilayas(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_profiles_wilaya ON profiles(selected_wilaya_id);

-- ============================================================================
-- 2. REMOVE HARDCODED CITY DEFAULT
-- ============================================================================
ALTER TABLE restaurants ALTER COLUMN city DROP NOT NULL;
ALTER TABLE restaurants ALTER COLUMN city SET DEFAULT NULL;

-- ============================================================================
-- 3. REMOVE HARDCODED ADMIN EMAIL FROM TRIGGER
-- ============================================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  INSERT INTO profiles (id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NULL),
    COALESCE((NEW.raw_user_meta_data->>'role')::user_role, 'customer'::user_role)
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP FUNCTION IF EXISTS public.promote_owner_on_login() CASCADE;

-- ============================================================================
-- 4. ADD ADMIN_CONFIGURATION TABLE for super admin management
-- ============================================================================
CREATE TABLE IF NOT EXISTS admin_configuration (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  granted_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  granted_at timestamptz NOT NULL DEFAULT now(),
  reason text,
  is_active boolean NOT NULL DEFAULT true,
  UNIQUE(user_id)
);

CREATE INDEX IF NOT EXISTS idx_admin_config_user ON admin_configuration(user_id);
CREATE INDEX IF NOT EXISTS idx_admin_config_active ON admin_configuration(is_active) WHERE is_active = true;

-- Function to check if user is super admin (now checks admin_configuration table)
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles p
    LEFT JOIN admin_configuration ac ON ac.user_id = p.id AND ac.is_active = true
    WHERE p.id = auth.uid()
    AND (p.role = 'super_admin' OR ac.id IS NOT NULL)
  );
$$;

-- ============================================================================
-- 5. CENTRALIZED CURRENCY CONFIGURATION
-- ============================================================================
INSERT INTO platform_settings (key, value, description)
VALUES
  ('currency', '{"code": "DZD", "symbol": "DA", "name": "Algerian Dinar", "decimals": 2, "format": "{amount} DA"}', 'Platform currency configuration'),
  ('currency_options', '[{"code": "DZD", "symbol": "DA", "name": "Algerian Dinar", "decimals": 2}]', 'Available currencies (multi-currency ready)')
ON CONFLICT (key) DO NOTHING;

-- ============================================================================
-- 6. PLATFORM BRANDING CONFIGURATION
-- ============================================================================
INSERT INTO platform_settings (key, value, description)
VALUES
  ('branding', '{"slogan_en": "Local flavor, delivered across Algeria.", "slogan_fr": "Saveurs locales, livrées partout en Algérie.", "slogan_ar": "نكهات محلية، تُوصَل في كل الجزائر.", "default_country": "Algeria", "default_country_code": "DZ"}', 'Platform branding and location defaults')
ON CONFLICT (key) DO NOTHING;

-- ============================================================================
-- 7. RLS POLICIES FOR NEW TABLES
-- ============================================================================
ALTER TABLE wilayas ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_configuration ENABLE ROW LEVEL SECURITY;

CREATE POLICY wilayas_select_all ON wilayas
  FOR SELECT TO authenticated
  USING (is_active = true OR public.is_super_admin());

CREATE POLICY wilayas_all_admin ON wilayas
  FOR ALL TO authenticated
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

CREATE POLICY admin_config_select_admin ON admin_configuration
  FOR SELECT TO authenticated
  USING (public.is_super_admin());

CREATE POLICY admin_config_all_admin ON admin_configuration
  FOR ALL TO authenticated
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

-- ============================================================================
-- 8. FIX MENU POLICIES - Optimize N+1 query pattern
-- ============================================================================
CREATE OR REPLACE FUNCTION public.user_can_access_restaurant(p_restaurant_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT EXISTS (
    SELECT 1 FROM restaurants r
    WHERE r.id = p_restaurant_id
    AND (
      r.owner_id = auth.uid()
      OR public.is_super_admin()
      OR (r.status = 'published' AND r.operational_status = 'open')
    )
  );
$$;

REVOKE EXECUTE ON FUNCTION public.user_can_access_restaurant(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.user_can_access_restaurant(uuid) TO authenticated;

-- ============================================================================
-- 9. FIX PROMO CODE TRACKING
-- ============================================================================
CREATE OR REPLACE FUNCTION public.increment_promo_usage()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  IF NEW.promo_code_id IS NOT NULL AND OLD.promo_code_id IS NULL THEN
    UPDATE promo_codes
    SET used_count = used_count + 1
    WHERE id = NEW.promo_code_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_orders_promo_usage ON orders;
CREATE TRIGGER trg_orders_promo_usage
  AFTER INSERT ON orders
  FOR EACH ROW
  EXECUTE FUNCTION public.increment_promo_usage();

-- ============================================================================
-- 10. NOTIFICATION RETENTION POLICY (90 days)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.archive_old_notifications()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  DELETE FROM notifications
  WHERE created_at < now() - interval '90 days'
  AND is_read = true;
END;
$$;

-- ============================================================================
-- 11. GRANT PERMISSIONS
-- ============================================================================
GRANT EXECUTE ON FUNCTION public.is_super_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_can_access_restaurant(uuid) TO authenticated;

-- ============================================================================
-- 12. DATA MIGRATION LOG
-- ============================================================================
INSERT INTO audit_logs (action, target_type, metadata)
VALUES (
  'admin_action',
  'migration',
  '{"migration": "0015_foundation_fixes_multi_wilaya", "description": "Removed hardcoded Constantine and admin email, added wilayas table"}'::jsonb
);

-- ============================================================================
-- 13. ADD DELETION GRACE PERIOD FUNCTION
-- ============================================================================
CREATE OR REPLACE FUNCTION public.hard_delete_expired_profiles()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_deleted_count int;
BEGIN
  DELETE FROM profiles
  WHERE deleted_at IS NOT NULL
  AND deleted_at < now() - interval '14 days'
  AND id NOT IN (SELECT owner_id FROM restaurants WHERE is_active = true);

  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;

  INSERT INTO audit_logs (action, target_type, metadata)
  VALUES (
    'admin_action',
    'cleanup',
    jsonb_build_object('action', 'hard_delete_expired_profiles', 'count', v_deleted_count)
  );
END;
$$;