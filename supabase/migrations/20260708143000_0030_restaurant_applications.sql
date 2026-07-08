-- KIYO FOOD 0030 - Restaurant owner applications
-- Enables secure self-service restaurant applications without granting owner
-- privileges or public restaurant visibility before super-admin approval.

CREATE TABLE IF NOT EXISTS public.restaurant_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  applicant_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected', 'withdrawn')),
  restaurant_name text NOT NULL CHECK (length(trim(restaurant_name)) >= 2),
  legal_name text,
  description text,
  phone text NOT NULL CHECK (length(trim(phone)) >= 6),
  address text NOT NULL CHECK (length(trim(address)) >= 5),
  cuisine text[] NOT NULL DEFAULT '{}',
  opening_hours jsonb NOT NULL DEFAULT '{}'::jsonb,
  max_delivery_km numeric(8,2) NOT NULL DEFAULT 8 CHECK (max_delivery_km > 0 AND max_delivery_km <= 100),
  min_order_amount numeric(12,2) NOT NULL DEFAULT 0 CHECK (min_order_amount >= 0),
  logo_url text,
  cover_image_url text,
  latitude double precision,
  longitude double precision,
  rejection_reason text,
  reviewed_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_restaurant_applications_applicant
  ON public.restaurant_applications(applicant_id);

CREATE INDEX IF NOT EXISTS idx_restaurant_applications_status
  ON public.restaurant_applications(status, created_at DESC);

ALTER TABLE public.restaurant_applications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS restaurant_applications_select_owner_or_admin ON public.restaurant_applications;
CREATE POLICY restaurant_applications_select_owner_or_admin
  ON public.restaurant_applications
  FOR SELECT TO authenticated
  USING (applicant_id = auth.uid() OR public.is_super_admin());

DROP POLICY IF EXISTS restaurant_applications_insert_self ON public.restaurant_applications;
CREATE POLICY restaurant_applications_insert_self
  ON public.restaurant_applications
  FOR INSERT TO authenticated
  WITH CHECK (applicant_id = auth.uid() AND status = 'pending');

DROP POLICY IF EXISTS restaurant_applications_update_self_pending_or_rejected ON public.restaurant_applications;
CREATE POLICY restaurant_applications_update_self_pending_or_rejected
  ON public.restaurant_applications
  FOR UPDATE TO authenticated
  USING (applicant_id = auth.uid() AND status IN ('pending', 'rejected'))
  WITH CHECK (applicant_id = auth.uid() AND status = 'pending');

DROP POLICY IF EXISTS restaurant_applications_admin_all ON public.restaurant_applications;
CREATE POLICY restaurant_applications_admin_all
  ON public.restaurant_applications
  FOR ALL TO authenticated
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

CREATE OR REPLACE FUNCTION public.touch_restaurant_application_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_restaurant_applications_updated_at ON public.restaurant_applications;
CREATE TRIGGER trg_restaurant_applications_updated_at
  BEFORE UPDATE ON public.restaurant_applications
  FOR EACH ROW EXECUTE FUNCTION public.touch_restaurant_application_updated_at();

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'restaurant-applications',
  'restaurant-applications',
  true,
  5242880,
  ARRAY['image/png', 'image/jpeg', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS restaurant_applications_storage_read ON storage.objects;
CREATE POLICY restaurant_applications_storage_read
  ON storage.objects FOR SELECT
  USING (bucket_id = 'restaurant-applications');

DROP POLICY IF EXISTS restaurant_applications_storage_insert_own ON storage.objects;
CREATE POLICY restaurant_applications_storage_insert_own
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'restaurant-applications'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS restaurant_applications_storage_update_own ON storage.objects;
CREATE POLICY restaurant_applications_storage_update_own
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'restaurant-applications'
    AND (storage.foldername(name))[1] = auth.uid()::text
  )
  WITH CHECK (
    bucket_id = 'restaurant-applications'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
