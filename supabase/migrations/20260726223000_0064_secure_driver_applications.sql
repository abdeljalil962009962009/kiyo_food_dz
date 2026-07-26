-- Replace the placeholder driver signup path with a private, reviewable,
-- transactional application while protecting verification fields.
BEGIN;

ALTER TABLE public.drivers
  ADD COLUMN IF NOT EXISTS application_status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS application_version integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS application_key uuid,
  ADD COLUMN IF NOT EXISTS license_number text,
  ADD COLUMN IF NOT EXISTS national_id_number text,
  ADD COLUMN IF NOT EXISTS application_submitted_at timestamptz,
  ADD COLUMN IF NOT EXISTS reviewed_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS reviewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS review_reason text;

UPDATE public.drivers
SET application_status = CASE WHEN is_verified THEN 'approved' ELSE 'pending' END,
    application_submitted_at = COALESCE(application_submitted_at, created_at),
    is_active = CASE WHEN is_verified THEN is_active ELSE false END,
    is_online = CASE WHEN is_verified AND is_active THEN is_online ELSE false END
WHERE application_status IS NULL
   OR application_submitted_at IS NULL
   OR (NOT is_verified AND (is_active OR is_online));

CREATE UNIQUE INDEX IF NOT EXISTS idx_drivers_application_key
  ON public.drivers (application_key)
  WHERE application_key IS NOT NULL;

DO $constraints$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'drivers_application_status_valid'
      AND conrelid = 'public.drivers'::regclass
  ) THEN
    ALTER TABLE public.drivers
      ADD CONSTRAINT drivers_application_status_valid
      CHECK (application_status IN ('pending', 'under_review', 'approved', 'rejected', 'suspended'))
      NOT VALID;
  END IF;
END
$constraints$;

ALTER TABLE public.driver_documents
  ADD COLUMN IF NOT EXISTS mime_type text,
  ADD COLUMN IF NOT EXISTS size_bytes bigint;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'driver-documents',
  'driver-documents',
  false,
  8388608,
  ARRAY['application/pdf', 'image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE
SET public = false,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE public.notifications ADD CONSTRAINT notifications_type_check CHECK (
  type IN (
    'new_order','order_placed','order_accepted','order_preparing','order_out_for_delivery',
    'order_delivered','order_cancelled','order_failed_delivery','order_refunded',
    'new_restaurant','high_cancellation','failed_order','suspicious_activity',
    'financial_inconsistency','system_error','settlement_due','support_reply',
    'application_submitted','application_status_changed','application_message',
    'application_changes_requested','application_preliminarily_approved',
    'restaurant_ready_to_publish','restaurant_published','restaurant_suspended',
    'new_driver_application','driver_application_submitted',
    'driver_application_under_review','driver_application_approved',
    'driver_application_rejected','driver_application_suspended'
  )
);

DROP POLICY IF EXISTS driver_documents_storage_read ON storage.objects;
DROP POLICY IF EXISTS driver_documents_storage_insert ON storage.objects;
DROP POLICY IF EXISTS driver_documents_storage_delete_unsubmitted ON storage.objects;

CREATE POLICY driver_documents_storage_read
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'driver-documents'
    AND (
      (storage.foldername(name))[1] = auth.uid()::text
      OR public.is_super_admin()
    )
  );

CREATE POLICY driver_documents_storage_insert
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'driver-documents'
    AND (storage.foldername(name))[1] = auth.uid()::text
    AND lower(storage.extension(name)) IN ('pdf', 'jpg', 'jpeg', 'png', 'webp')
  );

CREATE POLICY driver_documents_storage_delete_unsubmitted
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'driver-documents'
    AND (storage.foldername(name))[1] = auth.uid()::text
    AND NOT EXISTS (
      SELECT 1
      FROM public.driver_documents document
      WHERE document.document_url = storage.objects.name
    )
  );

DROP POLICY IF EXISTS drivers_insert ON public.drivers;
DROP POLICY IF EXISTS driverdocs_insert ON public.driver_documents;

CREATE OR REPLACE FUNCTION public.guard_driver_self_updates()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
  IF auth.uid() = OLD.user_id
     AND NOT public.is_super_admin()
     AND (
       NEW.user_id IS DISTINCT FROM OLD.user_id
       OR NEW.is_verified IS DISTINCT FROM OLD.is_verified
       OR NEW.is_active IS DISTINCT FROM OLD.is_active
       OR NEW.application_status IS DISTINCT FROM OLD.application_status
       OR NEW.application_key IS DISTINCT FROM OLD.application_key
       OR NEW.rating IS DISTINCT FROM OLD.rating
       OR NEW.delivery_count IS DISTINCT FROM OLD.delivery_count
       OR NEW.reviewed_by IS DISTINCT FROM OLD.reviewed_by
       OR NEW.reviewed_at IS DISTINCT FROM OLD.reviewed_at
       OR NEW.review_reason IS DISTINCT FROM OLD.review_reason
     ) THEN
    RAISE EXCEPTION 'Driver verification fields are managed by Kiyo Food.'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END
$function$;

REVOKE ALL ON FUNCTION public.guard_driver_self_updates()
  FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS drivers_guard_self_updates ON public.drivers;
CREATE TRIGGER drivers_guard_self_updates
  BEFORE UPDATE ON public.drivers
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_driver_self_updates();

CREATE OR REPLACE FUNCTION public.submit_driver_application(
  p_actor_id uuid,
  p_payload jsonb,
  p_submission_key uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $function$
DECLARE
  v_user_id uuid := p_actor_id;
  v_driver public.drivers%ROWTYPE;
  v_document jsonb;
  v_vehicle_type text := btrim(COALESCE(p_payload->>'vehicle_type', ''));
  v_vehicle_plate text := NULLIF(btrim(COALESCE(p_payload->>'vehicle_plate', '')), '');
  v_license_number text := btrim(COALESCE(p_payload->>'license_number', ''));
  v_national_id text := btrim(COALESCE(p_payload->>'national_id_number', ''));
  v_phone text := btrim(COALESCE(p_payload->>'phone', ''));
  v_documents jsonb := COALESCE(p_payload->'documents', '[]'::jsonb);
  v_document_types text[];
  v_document_count integer;
  v_distinct_document_count integer;
BEGIN
  IF v_user_id IS NULL OR p_submission_key IS NULL THEN
    RAISE EXCEPTION 'Sign in before submitting a driver application.'
      USING ERRCODE = '42501';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles profile
    WHERE profile.id = v_user_id
      AND profile.role IN ('customer', 'driver')
      AND NOT COALESCE(profile.is_suspended, false)
  ) THEN
    RAISE EXCEPTION 'An active customer or driver account is required.'
      USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_driver
  FROM public.drivers
  WHERE user_id = v_user_id;
  IF FOUND THEN
    RETURN jsonb_build_object(
      'driver_id', v_driver.id,
      'application_status', v_driver.application_status,
      'idempotent_replay', true
    );
  END IF;

  IF v_vehicle_type NOT IN ('bicycle', 'motorcycle', 'car', 'scooter')
     OR length(v_national_id) < 4 OR length(v_national_id) > 80
     OR v_phone !~ '^\+213[5-7][0-9]{8}$'
     OR jsonb_typeof(v_documents) <> 'array'
     OR jsonb_array_length(v_documents) < 1
     OR jsonb_array_length(v_documents) > 4 THEN
    RAISE EXCEPTION 'Complete the identity, licence, phone, and required documents.'
      USING ERRCODE = '22023';
  END IF;
  IF v_vehicle_type IN ('motorcycle', 'scooter', 'car')
     AND (
       length(COALESCE(v_vehicle_plate, '')) < 4
       OR length(v_license_number) < 4
       OR length(v_license_number) > 80
     ) THEN
    RAISE EXCEPTION 'A valid registration and driving licence are required.'
      USING ERRCODE = '22023';
  END IF;

  SELECT
    array_agg(DISTINCT value->>'document_type'),
    count(*),
    count(DISTINCT value->>'document_type')
  INTO v_document_types, v_document_count, v_distinct_document_count
  FROM jsonb_array_elements(v_documents);
  IF v_document_count <> v_distinct_document_count
     OR NOT ('id_card' = ANY(v_document_types))
     OR (
       v_vehicle_type IN ('motorcycle', 'scooter', 'car')
       AND (
         NOT ('license' = ANY(v_document_types))
         OR NOT ('vehicle_registration' = ANY(v_document_types))
       )
     )
     OR (v_vehicle_type = 'car' AND NOT ('insurance' = ANY(v_document_types))) THEN
    RAISE EXCEPTION 'The required documents for this vehicle are incomplete.'
      USING ERRCODE = '22023';
  END IF;

  FOR v_document IN SELECT value FROM jsonb_array_elements(v_documents) LOOP
    IF v_document->>'document_type' NOT IN (
      'license', 'id_card', 'vehicle_registration', 'insurance'
    )
       OR v_document->>'mime_type' NOT IN (
         'application/pdf', 'image/jpeg', 'image/png', 'image/webp'
       )
       OR COALESCE((v_document->>'size_bytes')::bigint, 0) < 1
       OR COALESCE((v_document->>'size_bytes')::bigint, 0) > 8388608
       OR v_document->>'path' NOT LIKE v_user_id::text || '/%' THEN
      RAISE EXCEPTION 'A driver document is invalid.' USING ERRCODE = '22023';
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM storage.objects object
      WHERE object.bucket_id = 'driver-documents'
        AND object.name = v_document->>'path'
        AND COALESCE(object.metadata->>'mimetype', '') = v_document->>'mime_type'
        AND COALESCE((object.metadata->>'size')::bigint, 0)
          = (v_document->>'size_bytes')::bigint
    ) THEN
      RAISE EXCEPTION 'A required driver document was not uploaded.'
        USING ERRCODE = '22023';
    END IF;
  END LOOP;

  INSERT INTO public.drivers (
    user_id, vehicle_type, vehicle_plate, is_online, is_verified, is_active,
    rating, delivery_count, application_status, application_key,
    license_number, national_id_number, application_submitted_at
  ) VALUES (
    v_user_id, v_vehicle_type, v_vehicle_plate, false, false, false,
    5, 0, 'pending', p_submission_key,
    v_license_number, v_national_id, now()
  )
  RETURNING * INTO v_driver;

  FOR v_document IN SELECT value FROM jsonb_array_elements(v_documents) LOOP
    INSERT INTO public.driver_documents (
      driver_id, document_type, document_url, status, mime_type, size_bytes
    ) VALUES (
      v_driver.id,
      v_document->>'document_type',
      v_document->>'path',
      'pending',
      v_document->>'mime_type',
      (v_document->>'size_bytes')::bigint
    );
  END LOOP;

  UPDATE public.profiles SET phone = v_phone WHERE id = v_user_id;

  RETURN jsonb_build_object(
    'driver_id', v_driver.id,
    'application_status', v_driver.application_status,
    'idempotent_replay', false
  );
END
$function$;

REVOKE ALL ON FUNCTION public.submit_driver_application(uuid, jsonb, uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.submit_driver_application(uuid, jsonb, uuid)
  TO service_role;

CREATE OR REPLACE FUNCTION public.audit_driver_application_submission()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
  INSERT INTO public.audit_logs (
    actor_id, action, target_type, target_id, metadata
  ) VALUES (
    NEW.user_id,
    'admin_action'::public.audit_action,
    'driver_application',
    NEW.id,
    jsonb_build_object(
      'application_status', NEW.application_status,
      'vehicle_type', NEW.vehicle_type
    )
  );
  INSERT INTO public.notifications (
    user_id, type, title, body, metadata
  ) VALUES (
    NEW.user_id,
    'driver_application_submitted',
    'Driver application submitted',
    'Your application is waiting for Kiyo Food review.',
    jsonb_build_object('driver_id', NEW.id, 'application_status', NEW.application_status)
  );
  INSERT INTO public.notifications (
    user_id, type, title, body, metadata
  )
  SELECT
    profile.id,
    'new_driver_application',
    'New driver application',
    'A driver application is waiting for review.',
    jsonb_build_object('driver_id', NEW.id, 'application_status', NEW.application_status)
  FROM public.profiles profile
  WHERE profile.role = 'super_admin'
    AND NOT COALESCE(profile.is_suspended, false)
    AND profile.id <> NEW.user_id;
  RETURN NEW;
END
$function$;

REVOKE ALL ON FUNCTION public.audit_driver_application_submission()
  FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS drivers_audit_application_submission ON public.drivers;
CREATE TRIGGER drivers_audit_application_submission
  AFTER INSERT ON public.drivers
  FOR EACH ROW
  EXECUTE FUNCTION public.audit_driver_application_submission();

CREATE OR REPLACE FUNCTION public.review_driver_application(
  p_actor_id uuid,
  p_driver_id uuid,
  p_target_status text,
  p_reason text DEFAULT NULL,
  p_expected_version integer DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $function$
DECLARE
  v_driver public.drivers%ROWTYPE;
  v_previous_status text;
  v_reason text := NULLIF(btrim(COALESCE(p_reason, '')), '');
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles profile
    WHERE profile.id = p_actor_id
      AND profile.role = 'super_admin'
      AND NOT COALESCE(profile.is_suspended, false)
  ) THEN
    RAISE EXCEPTION 'Only an active platform owner may review driver applications.'
      USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_driver
  FROM public.drivers
  WHERE id = p_driver_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Driver application not found.' USING ERRCODE = 'P0002';
  END IF;
  IF p_expected_version IS NOT NULL
     AND v_driver.application_version <> p_expected_version THEN
    RAISE EXCEPTION 'This driver application changed in another session. Refresh and try again.'
      USING ERRCODE = 'PT409';
  END IF;
  IF p_target_status NOT IN ('under_review', 'approved', 'rejected', 'suspended') THEN
    RAISE EXCEPTION 'Invalid driver application status.' USING ERRCODE = '22023';
  END IF;
  IF p_target_status IN ('rejected', 'suspended') AND v_reason IS NULL THEN
    RAISE EXCEPTION 'A clear reason is required.' USING ERRCODE = '22023';
  END IF;
  IF NOT (
    (v_driver.application_status = 'pending' AND p_target_status IN ('under_review', 'approved', 'rejected'))
    OR (v_driver.application_status = 'under_review' AND p_target_status IN ('approved', 'rejected'))
    OR (v_driver.application_status = 'approved' AND p_target_status = 'suspended')
    OR (v_driver.application_status = 'suspended' AND p_target_status IN ('approved', 'rejected'))
    OR v_driver.application_status = p_target_status
  ) THEN
    RAISE EXCEPTION 'This driver application transition is not allowed.'
      USING ERRCODE = 'PT409';
  END IF;

  IF v_driver.application_status <> p_target_status THEN
    v_previous_status := v_driver.application_status;
    UPDATE public.drivers
    SET application_status = p_target_status,
        application_version = application_version + 1,
        is_verified = p_target_status = 'approved',
        is_active = p_target_status = 'approved',
        is_online = false,
        reviewed_by = p_actor_id,
        reviewed_at = now(),
        review_reason = v_reason,
        updated_at = now()
    WHERE id = p_driver_id
    RETURNING * INTO v_driver;

    IF p_target_status IN ('approved', 'rejected') THEN
      UPDATE public.driver_documents
      SET status = p_target_status,
          reviewed_by = p_actor_id,
          reviewed_at = now()
      WHERE driver_id = p_driver_id;
    END IF;

    INSERT INTO public.audit_logs (
      actor_id, action, target_type, target_id, metadata
    ) VALUES (
      p_actor_id,
      'admin_action'::public.audit_action,
      'driver_application',
      p_driver_id,
      jsonb_build_object(
        'from', v_previous_status,
        'to', p_target_status,
        'reason', v_reason,
        'application_version', v_driver.application_version
      )
    );

    INSERT INTO public.notifications (
      user_id, type, title, body, metadata
    ) VALUES (
      v_driver.user_id,
      CASE p_target_status
        WHEN 'under_review' THEN 'driver_application_under_review'
        WHEN 'approved' THEN 'driver_application_approved'
        WHEN 'rejected' THEN 'driver_application_rejected'
        ELSE 'driver_application_suspended'
      END,
      'Driver application updated',
      'Kiyo Food updated your driver application.',
      jsonb_build_object(
        'driver_id', v_driver.id,
        'application_status', p_target_status,
        'reason', v_reason
      )
    );

    IF p_target_status = 'approved' THEN
      UPDATE public.profiles
      SET role = 'driver',
          updated_at = now()
      WHERE id = v_driver.user_id
        AND role = 'customer';
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'driver_id', v_driver.id,
    'application_status', v_driver.application_status,
    'application_version', v_driver.application_version,
    'is_verified', v_driver.is_verified,
    'is_active', v_driver.is_active,
    'review_reason', v_driver.review_reason
  );
END
$function$;

REVOKE ALL ON FUNCTION public.review_driver_application(uuid, uuid, text, text, integer)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.review_driver_application(uuid, uuid, text, text, integer)
  TO service_role;

COMMIT;
