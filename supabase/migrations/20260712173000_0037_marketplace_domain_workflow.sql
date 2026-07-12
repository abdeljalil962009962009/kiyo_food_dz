-- Kiyo Food 0037: coherent merchant application and publication domain.
-- Additive migration: preserves existing applications/restaurants and moves
-- critical multi-row operations behind transactional, idempotent RPCs.

BEGIN;

-- ---------------------------------------------------------------------------
-- Application lifecycle normalization
-- ---------------------------------------------------------------------------

ALTER TABLE public.restaurant_applications
  DROP CONSTRAINT IF EXISTS restaurant_applications_status_check;
ALTER TABLE public.restaurant_applications
  DROP CONSTRAINT IF EXISTS restaurant_applications_confirmed_location_required;

UPDATE public.restaurant_applications SET status = 'submitted' WHERE status = 'pending';
UPDATE public.restaurant_applications SET status = 'preliminarily_approved' WHERE status = 'approved';
UPDATE public.restaurant_applications SET status = 'archived' WHERE status = 'withdrawn';

ALTER TABLE public.restaurant_applications
  ADD COLUMN IF NOT EXISTS application_version integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS submission_key uuid,
  ADD COLUMN IF NOT EXISTS restaurant_id uuid REFERENCES public.restaurants(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS wilaya_id smallint REFERENCES public.wilayas(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS street text,
  ADD COLUMN IF NOT EXISTS neighborhood text,
  ADD COLUMN IF NOT EXISTS commune text,
  ADD COLUMN IF NOT EXISTS city text,
  ADD COLUMN IF NOT EXISTS province text,
  ADD COLUMN IF NOT EXISTS postal_code text,
  ADD COLUMN IF NOT EXISTS country text DEFAULT 'Algeria',
  ADD COLUMN IF NOT EXISTS proposed_food_commission_rate numeric(7,6),
  ADD COLUMN IF NOT EXISTS proposed_delivery_share_rate numeric(7,6),
  ADD COLUMN IF NOT EXISTS proposed_commission_base text,
  ADD COLUMN IF NOT EXISTS changes_requested_reason text,
  ADD COLUMN IF NOT EXISTS admin_internal_notes text,
  ADD COLUMN IF NOT EXISTS submitted_at timestamptz,
  ADD COLUMN IF NOT EXISTS resubmitted_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_transition_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS last_message_at timestamptz;

UPDATE public.restaurant_applications
SET submitted_at = COALESCE(submitted_at, created_at)
WHERE status <> 'draft';

ALTER TABLE public.restaurant_applications
  ADD CONSTRAINT restaurant_applications_status_check
  CHECK (status IN (
    'draft','submitted','under_review','changes_requested','resubmitted',
    'preliminarily_approved','onboarding_in_progress','menu_review',
    'ready_to_publish','published','rejected','suspended','archived'
  ));

ALTER TABLE public.restaurant_applications
  DROP CONSTRAINT IF EXISTS restaurant_applications_confirmed_location_required;
ALTER TABLE public.restaurant_applications
  ADD CONSTRAINT restaurant_applications_confirmed_location_required CHECK (
    status IN ('draft','rejected','archived')
    OR (latitude IS NOT NULL AND longitude IS NOT NULL AND location_confirmed = true)
  ) NOT VALID;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'restaurant_applications_commission_range'
  ) THEN
    ALTER TABLE public.restaurant_applications
      ADD CONSTRAINT restaurant_applications_commission_range CHECK (
        (proposed_food_commission_rate IS NULL OR proposed_food_commission_rate BETWEEN 0 AND 1)
        AND (proposed_delivery_share_rate IS NULL OR proposed_delivery_share_rate BETWEEN 0 AND 1)
        AND (proposed_commission_base IS NULL OR proposed_commission_base IN ('food_subtotal','food_plus_delivery'))
      ) NOT VALID;
  END IF;
END;
$$;

-- Preserve duplicate legacy applications while making future active applications unique.
WITH ranked AS (
  SELECT id,
         row_number() OVER (PARTITION BY applicant_id ORDER BY updated_at DESC, created_at DESC, id DESC) AS rn
  FROM public.restaurant_applications
  WHERE status NOT IN ('rejected','published','archived')
)
UPDATE public.restaurant_applications a
SET status = 'archived',
    admin_internal_notes = concat_ws(E'\n', a.admin_internal_notes, 'Archived by migration 0037: duplicate active legacy application.'),
    last_transition_at = now(),
    updated_at = now()
FROM ranked r
WHERE a.id = r.id AND r.rn > 1;

CREATE UNIQUE INDEX IF NOT EXISTS idx_restaurant_applications_one_active_per_applicant
  ON public.restaurant_applications(applicant_id)
  WHERE status NOT IN ('rejected','published','archived');

CREATE UNIQUE INDEX IF NOT EXISTS idx_restaurant_applications_submission_key
  ON public.restaurant_applications(applicant_id, submission_key)
  WHERE submission_key IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_restaurant_applications_restaurant
  ON public.restaurant_applications(restaurant_id)
  WHERE restaurant_id IS NOT NULL;

ALTER TABLE public.restaurants
  ADD COLUMN IF NOT EXISTS source_application_id uuid REFERENCES public.restaurant_applications(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_restaurants_source_application
  ON public.restaurants(source_application_id)
  WHERE source_application_id IS NOT NULL;

-- Direct writes cannot provide the required transaction/audit/notification contract.
DROP POLICY IF EXISTS restaurant_applications_insert_self ON public.restaurant_applications;
DROP POLICY IF EXISTS restaurant_applications_update_self_pending_or_rejected ON public.restaurant_applications;
DROP POLICY IF EXISTS restaurant_applications_admin_all ON public.restaurant_applications;

-- ---------------------------------------------------------------------------
-- History, conversation, memberships and versioned commercial terms
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.restaurant_application_transitions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id uuid NOT NULL REFERENCES public.restaurant_applications(id) ON DELETE CASCADE,
  from_status text,
  to_status text NOT NULL,
  actor_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  actor_role text NOT NULL,
  reason text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_application_transitions_timeline
  ON public.restaurant_application_transitions(application_id, created_at DESC);

ALTER TABLE public.restaurant_application_transitions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS application_transitions_select_participant ON public.restaurant_application_transitions;
CREATE POLICY application_transitions_select_participant
  ON public.restaurant_application_transitions FOR SELECT TO authenticated
  USING (
    public.is_super_admin()
    OR EXISTS (
      SELECT 1 FROM public.restaurant_applications a
      WHERE a.id = application_id AND a.applicant_id = auth.uid()
    )
  );

CREATE TABLE IF NOT EXISTS public.restaurant_application_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id uuid NOT NULL REFERENCES public.restaurant_applications(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  sender_role text NOT NULL CHECK (sender_role IN ('applicant','super_admin')),
  body text NOT NULL CHECK (length(trim(body)) BETWEEN 1 AND 5000),
  client_message_id uuid NOT NULL,
  read_by_recipient_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(application_id, sender_id, client_message_id)
);

CREATE INDEX IF NOT EXISTS idx_application_messages_timeline
  ON public.restaurant_application_messages(application_id, created_at);
CREATE INDEX IF NOT EXISTS idx_application_messages_unread
  ON public.restaurant_application_messages(application_id, sender_role, created_at DESC)
  WHERE read_by_recipient_at IS NULL;

ALTER TABLE public.restaurant_application_messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS application_messages_select_participant ON public.restaurant_application_messages;
CREATE POLICY application_messages_select_participant
  ON public.restaurant_application_messages FOR SELECT TO authenticated
  USING (
    public.is_super_admin()
    OR EXISTS (
      SELECT 1 FROM public.restaurant_applications a
      WHERE a.id = application_id AND a.applicant_id = auth.uid()
    )
  );

CREATE TABLE IF NOT EXISTS public.restaurant_memberships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  membership_role text NOT NULL CHECK (membership_role IN ('owner','manager','staff')),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('invited','active','suspended','revoked')),
  invited_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(restaurant_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_restaurant_memberships_user
  ON public.restaurant_memberships(user_id, status);

ALTER TABLE public.restaurant_memberships ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS restaurant_memberships_select_own_or_admin ON public.restaurant_memberships;
CREATE POLICY restaurant_memberships_select_own_or_admin
  ON public.restaurant_memberships FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_super_admin());
DROP POLICY IF EXISTS restaurant_memberships_admin_all ON public.restaurant_memberships;
CREATE POLICY restaurant_memberships_admin_all
  ON public.restaurant_memberships FOR ALL TO authenticated
  USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());

INSERT INTO public.restaurant_memberships (
  restaurant_id, user_id, membership_role, status, invited_by
)
SELECT r.id, r.owner_id, 'owner', 'active', NULL
FROM public.restaurants r
ON CONFLICT (restaurant_id, user_id) DO UPDATE
SET membership_role = 'owner', status = 'active', updated_at = now();

CREATE OR REPLACE FUNCTION public.can_manage_restaurant(p_restaurant_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT public.is_super_admin()
    OR EXISTS (
      SELECT 1 FROM public.restaurants r
      WHERE r.id = p_restaurant_id AND r.owner_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.restaurant_memberships m
      WHERE m.restaurant_id = p_restaurant_id AND m.user_id = auth.uid()
        AND m.status = 'active' AND m.membership_role IN ('owner','manager')
    );
$$;
REVOKE EXECUTE ON FUNCTION public.can_manage_restaurant(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_manage_restaurant(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_user_restaurant_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT candidate.restaurant_id
  FROM (
    SELECT r.id AS restaurant_id, 0 AS priority
    FROM public.restaurants r
    WHERE r.owner_id = auth.uid()
    UNION ALL
    SELECT m.restaurant_id, CASE m.membership_role WHEN 'owner' THEN 1 ELSE 2 END
    FROM public.restaurant_memberships m
    WHERE m.user_id = auth.uid() AND m.status = 'active'
      AND m.membership_role IN ('owner','manager')
  ) candidate
  ORDER BY candidate.priority, candidate.restaurant_id
  LIMIT 1;
$$;
REVOKE EXECUTE ON FUNCTION public.get_user_restaurant_id() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_user_restaurant_id() TO authenticated;

CREATE OR REPLACE FUNCTION public.restaurant_is_visible(p_rid uuid, p_viewer uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.restaurants r
    WHERE r.id = p_rid
      AND (
        r.status = 'published'
        OR r.owner_id = p_viewer
        OR public.is_super_admin()
        OR EXISTS (
          SELECT 1 FROM public.restaurant_memberships m
          WHERE m.restaurant_id = r.id AND m.user_id = p_viewer AND m.status = 'active'
        )
      )
  );
$$;
REVOKE EXECUTE ON FUNCTION public.restaurant_is_visible(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.restaurant_is_visible(uuid, uuid) TO authenticated;

DROP POLICY IF EXISTS restaurants_select_visible ON public.restaurants;
CREATE POLICY restaurants_select_visible ON public.restaurants
  FOR SELECT TO authenticated
  USING (public.restaurant_is_visible(id, auth.uid()));
DROP POLICY IF EXISTS restaurants_update_owner_or_admin ON public.restaurants;
CREATE POLICY restaurants_update_owner_or_admin ON public.restaurants
  FOR UPDATE TO authenticated
  USING (public.can_manage_restaurant(id))
  WITH CHECK (public.can_manage_restaurant(id));

DROP POLICY IF EXISTS menu_categories_manage_owner_or_admin ON public.menu_categories;
CREATE POLICY menu_categories_manage_owner_or_admin ON public.menu_categories
  FOR ALL TO authenticated
  USING (public.can_manage_restaurant(restaurant_id))
  WITH CHECK (public.can_manage_restaurant(restaurant_id));
DROP POLICY IF EXISTS menu_items_manage_owner_or_admin ON public.menu_items;
CREATE POLICY menu_items_manage_owner_or_admin ON public.menu_items
  FOR ALL TO authenticated
  USING (public.can_manage_restaurant(restaurant_id))
  WITH CHECK (public.can_manage_restaurant(restaurant_id));

DROP POLICY IF EXISTS modifiers_modify ON public.menu_item_modifiers;
CREATE POLICY modifiers_modify ON public.menu_item_modifiers
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.menu_items item
    WHERE item.id = menu_item_id AND public.can_manage_restaurant(item.restaurant_id)
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.menu_items item
    WHERE item.id = menu_item_id AND public.can_manage_restaurant(item.restaurant_id)
  ));
DROP POLICY IF EXISTS options_modify ON public.modifier_options;
CREATE POLICY options_modify ON public.modifier_options
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.menu_item_modifiers modifier
    JOIN public.menu_items item ON item.id = modifier.menu_item_id
    WHERE modifier.id = modifier_id AND public.can_manage_restaurant(item.restaurant_id)
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.menu_item_modifiers modifier
    JOIN public.menu_items item ON item.id = modifier.menu_item_id
    WHERE modifier.id = modifier_id AND public.can_manage_restaurant(item.restaurant_id)
  ));
DROP POLICY IF EXISTS special_hours_modify ON public.restaurant_special_hours;
CREATE POLICY special_hours_modify ON public.restaurant_special_hours
  FOR ALL TO authenticated
  USING (public.can_manage_restaurant(restaurant_id))
  WITH CHECK (public.can_manage_restaurant(restaurant_id));
DROP POLICY IF EXISTS promotions_modify ON public.promotions;
CREATE POLICY promotions_modify ON public.promotions
  FOR ALL TO authenticated
  USING (public.can_manage_restaurant(restaurant_id))
  WITH CHECK (public.can_manage_restaurant(restaurant_id));
DROP POLICY IF EXISTS analytics_select ON public.restaurant_analytics;
CREATE POLICY analytics_select ON public.restaurant_analytics
  FOR SELECT TO authenticated
  USING (public.can_manage_restaurant(restaurant_id));
DROP POLICY IF EXISTS customer_notes_select ON public.customer_notes;
CREATE POLICY customer_notes_select ON public.customer_notes
  FOR SELECT TO authenticated
  USING (public.can_manage_restaurant(restaurant_id));
DROP POLICY IF EXISTS customer_notes_modify ON public.customer_notes;
CREATE POLICY customer_notes_modify ON public.customer_notes
  FOR ALL TO authenticated
  USING (public.can_manage_restaurant(restaurant_id))
  WITH CHECK (public.can_manage_restaurant(restaurant_id));

-- Financial rows are written only by SECURITY DEFINER domain functions. The
-- previous permissive INSERT policy let any authenticated caller forge ledger
-- rows directly and is intentionally removed.
DROP POLICY IF EXISTS ledger_insert_rpc ON public.financial_ledger;
DROP POLICY IF EXISTS ledger_select_own ON public.financial_ledger;
CREATE POLICY ledger_select_own ON public.financial_ledger
  FOR SELECT TO authenticated
  USING (customer_id = auth.uid() OR public.can_manage_restaurant(restaurant_id));
DROP POLICY IF EXISTS settlements_select ON public.settlements;
CREATE POLICY settlements_select ON public.settlements
  FOR SELECT TO authenticated
  USING (public.can_manage_restaurant(restaurant_id));

CREATE TABLE IF NOT EXISTS public.restaurant_commercial_terms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id uuid REFERENCES public.restaurant_applications(id) ON DELETE SET NULL,
  restaurant_id uuid REFERENCES public.restaurants(id) ON DELETE CASCADE,
  version integer NOT NULL,
  status text NOT NULL CHECK (status IN (
    'proposed','counteroffered','accepted','approved','scheduled','active','replaced','rejected','expired'
  )),
  commission_base text NOT NULL DEFAULT 'food_subtotal'
    CHECK (commission_base IN ('food_subtotal','food_plus_delivery')),
  food_commission_rate numeric(7,6) NOT NULL CHECK (food_commission_rate BETWEEN 0 AND 1),
  delivery_share_rate numeric(7,6) NOT NULL DEFAULT 0 CHECK (delivery_share_rate BETWEEN 0 AND 1),
  proposed_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  approved_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  effective_at timestamptz,
  expires_at timestamptz,
  supersedes_id uuid REFERENCES public.restaurant_commercial_terms(id) ON DELETE SET NULL,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(application_id, version),
  UNIQUE(restaurant_id, version),
  CHECK (application_id IS NOT NULL OR restaurant_id IS NOT NULL),
  CHECK (expires_at IS NULL OR effective_at IS NULL OR expires_at > effective_at)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_commercial_terms_one_active
  ON public.restaurant_commercial_terms(restaurant_id)
  WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_commercial_terms_effective
  ON public.restaurant_commercial_terms(restaurant_id, effective_at DESC);

ALTER TABLE public.restaurant_commercial_terms ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS commercial_terms_select_participant ON public.restaurant_commercial_terms;
CREATE POLICY commercial_terms_select_participant
  ON public.restaurant_commercial_terms FOR SELECT TO authenticated
  USING (
    public.is_super_admin()
    OR EXISTS (
      SELECT 1 FROM public.restaurant_applications a
      WHERE a.id = application_id AND a.applicant_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.restaurant_memberships m
      WHERE m.restaurant_id = restaurant_commercial_terms.restaurant_id
        AND m.user_id = auth.uid() AND m.status = 'active'
    )
  );
DROP POLICY IF EXISTS commercial_terms_admin_all ON public.restaurant_commercial_terms;
CREATE POLICY commercial_terms_admin_all
  ON public.restaurant_commercial_terms FOR ALL TO authenticated
  USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());

-- Grandfather existing restaurants into the versioned agreement model using
-- the platform default that governed them before this migration.
INSERT INTO public.restaurant_commercial_terms (
  restaurant_id, version, status, commission_base, food_commission_rate,
  delivery_share_rate, proposed_by, approved_by, effective_at, note
)
SELECT r.id, 1, 'active', 'food_subtotal',
       COALESCE((s.value->>'default_rate')::numeric, 0.07), 0,
       r.owner_id, (SELECT id FROM public.profiles WHERE role = 'super_admin' ORDER BY created_at LIMIT 1),
       r.created_at, 'Legacy baseline imported by migration 0037.'
FROM public.restaurants r
LEFT JOIN public.platform_settings s ON s.key = 'commission'
WHERE NOT EXISTS (
  SELECT 1 FROM public.restaurant_commercial_terms t
  WHERE t.restaurant_id = r.id AND t.status = 'active'
);

INSERT INTO public.restaurant_application_transitions (
  application_id, from_status, to_status, actor_id, actor_role, reason, metadata, created_at
)
SELECT a.id, NULL, a.status, a.applicant_id, 'applicant', 'Legacy application imported into canonical workflow.',
       jsonb_build_object('migration', '0037_marketplace_domain_workflow'), a.created_at
FROM public.restaurant_applications a
WHERE NOT EXISTS (
  SELECT 1 FROM public.restaurant_application_transitions t WHERE t.application_id = a.id
);

-- Add application events while preserving every existing notification type.
ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE public.notifications ADD CONSTRAINT notifications_type_check CHECK (
  type IN (
    'new_order','order_placed','order_accepted','order_preparing','order_out_for_delivery',
    'order_delivered','order_cancelled','order_failed_delivery','order_refunded',
    'new_restaurant','high_cancellation','failed_order','suspicious_activity',
    'financial_inconsistency','system_error','settlement_due','support_reply',
    'application_submitted','application_status_changed','application_message',
    'application_changes_requested','application_preliminarily_approved',
    'restaurant_ready_to_publish','restaurant_published','restaurant_suspended'
  )
);

-- notify_user is an internal primitive. Callers must use authorized domain RPCs.
REVOKE EXECUTE ON FUNCTION public.notify_user(uuid, text, text, text, jsonb) FROM authenticated;

-- ---------------------------------------------------------------------------
-- Transactional submission and communication RPCs
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.submit_restaurant_application(
  p_payload jsonb,
  p_submission_key uuid
)
RETURNS public.restaurant_applications
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_existing public.restaurant_applications%ROWTYPE;
  v_application public.restaurant_applications%ROWTYPE;
  v_old_status text;
  v_new_status text;
  v_rate numeric;
  v_delivery_share numeric;
  v_admin record;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication is required.' USING ERRCODE = '42501';
  END IF;
  IF p_submission_key IS NULL THEN
    RAISE EXCEPTION 'A submission key is required.' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_existing
  FROM public.restaurant_applications
  WHERE applicant_id = v_user_id AND submission_key = p_submission_key
  LIMIT 1;
  IF FOUND THEN RETURN v_existing; END IF;

  IF length(trim(COALESCE(p_payload->>'restaurant_name',''))) < 2
     OR length(trim(COALESCE(p_payload->>'phone',''))) < 6
     OR length(trim(COALESCE(p_payload->>'address',''))) < 5 THEN
    RAISE EXCEPTION 'Restaurant name, phone, and address are required.' USING ERRCODE = '22023';
  END IF;
  IF COALESCE((p_payload->>'location_confirmed')::boolean, false) IS NOT TRUE
     OR (p_payload->>'latitude') IS NULL OR (p_payload->>'longitude') IS NULL THEN
    RAISE EXCEPTION 'A confirmed restaurant location is required.' USING ERRCODE = '22023';
  END IF;
  IF NOT public.kiyo_is_coordinate_in_algeria(
    (p_payload->>'latitude')::double precision,
    (p_payload->>'longitude')::double precision
  ) THEN
    RAISE EXCEPTION 'Restaurant coordinates must be inside Algeria.' USING ERRCODE = '22023';
  END IF;

  v_rate := NULLIF(p_payload->>'proposed_food_commission_rate','')::numeric;
  v_delivery_share := NULLIF(p_payload->>'proposed_delivery_share_rate','')::numeric;
  IF (v_rate IS NOT NULL AND (v_rate < 0 OR v_rate > 1))
     OR (v_delivery_share IS NOT NULL AND (v_delivery_share < 0 OR v_delivery_share > 1)) THEN
    RAISE EXCEPTION 'Proposed commercial rates must be between 0 and 1.' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_existing
  FROM public.restaurant_applications
  WHERE applicant_id = v_user_id
    AND status NOT IN ('rejected','published','archived')
  FOR UPDATE;

  IF FOUND AND v_existing.status NOT IN ('draft','changes_requested') THEN
    RAISE EXCEPTION 'An active restaurant application already exists.' USING ERRCODE = '23505';
  END IF;

  IF FOUND THEN
    v_old_status := v_existing.status;
    v_new_status := CASE WHEN v_old_status = 'changes_requested' THEN 'resubmitted' ELSE 'submitted' END;
    UPDATE public.restaurant_applications
    SET restaurant_name = trim(p_payload->>'restaurant_name'),
        legal_name = NULLIF(trim(p_payload->>'legal_name'), ''),
        description = NULLIF(trim(p_payload->>'description'), ''),
        phone = trim(p_payload->>'phone'),
        address = trim(p_payload->>'address'),
        cuisine = COALESCE(ARRAY(SELECT jsonb_array_elements_text(COALESCE(p_payload->'cuisine','[]'::jsonb))), '{}'),
        opening_hours = COALESCE(p_payload->'opening_hours', '{}'::jsonb),
        max_delivery_km = COALESCE((p_payload->>'max_delivery_km')::numeric, max_delivery_km),
        min_order_amount = COALESCE((p_payload->>'min_order_amount')::numeric, min_order_amount),
        logo_url = COALESCE(NULLIF(p_payload->>'logo_url',''), logo_url),
        cover_image_url = COALESCE(NULLIF(p_payload->>'cover_image_url',''), cover_image_url),
        latitude = (p_payload->>'latitude')::double precision,
        longitude = (p_payload->>'longitude')::double precision,
        location_accuracy_m = NULLIF(p_payload->>'location_accuracy_m','')::numeric,
        location_confirmed = true,
        place_id = NULLIF(p_payload->>'place_id',''),
        location_source = NULLIF(p_payload->>'location_source',''),
        address_quality = NULLIF(p_payload->>'address_quality',''),
        street = NULLIF(p_payload->>'street',''),
        neighborhood = NULLIF(p_payload->>'neighborhood',''),
        commune = NULLIF(p_payload->>'commune',''),
        city = NULLIF(p_payload->>'city',''),
        province = NULLIF(p_payload->>'province',''),
        postal_code = NULLIF(p_payload->>'postal_code',''),
        country = COALESCE(NULLIF(p_payload->>'country',''), 'Algeria'),
        wilaya_id = NULLIF(p_payload->>'wilaya_id','')::smallint,
        proposed_food_commission_rate = v_rate,
        proposed_delivery_share_rate = v_delivery_share,
        proposed_commission_base = COALESCE(NULLIF(p_payload->>'proposed_commission_base',''), 'food_subtotal'),
        submission_key = p_submission_key,
        status = v_new_status,
        changes_requested_reason = NULL,
        application_version = application_version + 1,
        resubmitted_at = CASE WHEN v_new_status = 'resubmitted' THEN now() ELSE resubmitted_at END,
        submitted_at = COALESCE(submitted_at, now()),
        last_transition_at = now(),
        updated_at = now()
    WHERE id = v_existing.id
    RETURNING * INTO v_application;

    IF v_application.restaurant_id IS NOT NULL THEN
      UPDATE public.restaurants
      SET name = v_application.restaurant_name,
          description = v_application.description,
          phone = v_application.phone,
          address = v_application.address,
          street = v_application.street,
          neighborhood = v_application.neighborhood,
          commune = v_application.commune,
          city = v_application.city,
          province = v_application.province,
          postal_code = v_application.postal_code,
          country = COALESCE(v_application.country, country),
          wilaya_id = v_application.wilaya_id,
          cuisine = v_application.cuisine,
          opening_hours = v_application.opening_hours,
          image_url = COALESCE(v_application.cover_image_url, v_application.logo_url, image_url),
          latitude = v_application.latitude,
          longitude = v_application.longitude,
          place_id = v_application.place_id,
          location_accuracy_m = v_application.location_accuracy_m,
          location_verified = v_application.location_confirmed,
          location_source = v_application.location_source,
          location_updated_at = now(),
          max_delivery_km = v_application.max_delivery_km,
          min_order_amount = v_application.min_order_amount,
          updated_at = now()
      WHERE id = v_application.restaurant_id;
    END IF;
  ELSE
    v_old_status := NULL;
    v_new_status := 'submitted';
    INSERT INTO public.restaurant_applications (
      applicant_id, status, submission_key, restaurant_name, legal_name, description,
      phone, address, cuisine, opening_hours, max_delivery_km, min_order_amount,
      logo_url, cover_image_url, latitude, longitude, location_accuracy_m,
      location_confirmed, place_id, location_source, address_quality, street,
      neighborhood, commune, city, province, postal_code, country, wilaya_id,
      proposed_food_commission_rate, proposed_delivery_share_rate,
      proposed_commission_base, submitted_at, last_transition_at
    ) VALUES (
      v_user_id, v_new_status, p_submission_key, trim(p_payload->>'restaurant_name'),
      NULLIF(trim(p_payload->>'legal_name'), ''), NULLIF(trim(p_payload->>'description'), ''),
      trim(p_payload->>'phone'), trim(p_payload->>'address'),
      COALESCE(ARRAY(SELECT jsonb_array_elements_text(COALESCE(p_payload->'cuisine','[]'::jsonb))), '{}'),
      COALESCE(p_payload->'opening_hours', '{}'::jsonb),
      COALESCE((p_payload->>'max_delivery_km')::numeric, 8),
      COALESCE((p_payload->>'min_order_amount')::numeric, 0),
      NULLIF(p_payload->>'logo_url',''), NULLIF(p_payload->>'cover_image_url',''),
      (p_payload->>'latitude')::double precision, (p_payload->>'longitude')::double precision,
      NULLIF(p_payload->>'location_accuracy_m','')::numeric, true,
      NULLIF(p_payload->>'place_id',''), NULLIF(p_payload->>'location_source',''),
      NULLIF(p_payload->>'address_quality',''), NULLIF(p_payload->>'street',''),
      NULLIF(p_payload->>'neighborhood',''), NULLIF(p_payload->>'commune',''),
      NULLIF(p_payload->>'city',''), NULLIF(p_payload->>'province',''),
      NULLIF(p_payload->>'postal_code',''), COALESCE(NULLIF(p_payload->>'country',''), 'Algeria'),
      NULLIF(p_payload->>'wilaya_id','')::smallint, v_rate, v_delivery_share,
      COALESCE(NULLIF(p_payload->>'proposed_commission_base',''), 'food_subtotal'), now(), now()
    ) RETURNING * INTO v_application;
  END IF;

  INSERT INTO public.restaurant_application_transitions (
    application_id, from_status, to_status, actor_id, actor_role, metadata
  ) VALUES (
    v_application.id, v_old_status, v_new_status, v_user_id, 'applicant',
    jsonb_build_object('version', v_application.application_version, 'submission_key', p_submission_key)
  );

  IF v_rate IS NOT NULL THEN
    INSERT INTO public.restaurant_commercial_terms (
      application_id, version, status, commission_base, food_commission_rate,
      delivery_share_rate, proposed_by, note
    ) VALUES (
      v_application.id,
      COALESCE((SELECT max(version) + 1 FROM public.restaurant_commercial_terms WHERE application_id = v_application.id), 1),
      'proposed', COALESCE(v_application.proposed_commission_base, 'food_subtotal'),
      v_rate, COALESCE(v_delivery_share, 0), v_user_id, 'Applicant proposal; not financially authoritative.'
    );
  END IF;

  FOR v_admin IN SELECT id FROM public.profiles WHERE role = 'super_admin' LOOP
    PERFORM public.notify_user(
      v_admin.id, 'application_submitted', 'Restaurant application waiting for review',
      v_application.restaurant_name,
      jsonb_build_object('application_id', v_application.id, 'status', v_new_status)
    );
  END LOOP;

  PERFORM public.log_activity(
    'admin_action', 'restaurant_application', v_application.id,
    jsonb_build_object('action', 'application_submitted', 'status', v_new_status, 'version', v_application.application_version)
  );
  RETURN v_application;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.submit_restaurant_application(jsonb, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.submit_restaurant_application(jsonb, uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.send_restaurant_application_message(
  p_application_id uuid,
  p_body text,
  p_client_message_id uuid
)
RETURNS public.restaurant_application_messages
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_application public.restaurant_applications%ROWTYPE;
  v_message public.restaurant_application_messages%ROWTYPE;
  v_is_admin boolean := public.is_super_admin();
  v_recipient uuid;
  v_admin record;
BEGIN
  IF auth.uid() IS NULL OR p_client_message_id IS NULL OR length(trim(COALESCE(p_body,''))) NOT BETWEEN 1 AND 5000 THEN
    RAISE EXCEPTION 'A valid message is required.' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO v_application FROM public.restaurant_applications WHERE id = p_application_id;
  IF NOT FOUND OR (NOT v_is_admin AND v_application.applicant_id <> auth.uid()) THEN
    RAISE EXCEPTION 'Application not found.' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_message
  FROM public.restaurant_application_messages
  WHERE application_id = p_application_id AND sender_id = auth.uid()
    AND client_message_id = p_client_message_id;
  IF FOUND THEN RETURN v_message; END IF;

  INSERT INTO public.restaurant_application_messages (
    application_id, sender_id, sender_role, body, client_message_id
  ) VALUES (
    p_application_id, auth.uid(), CASE WHEN v_is_admin THEN 'super_admin' ELSE 'applicant' END,
    trim(p_body), p_client_message_id
  ) RETURNING * INTO v_message;

  UPDATE public.restaurant_applications
  SET last_message_at = now(), updated_at = now()
  WHERE id = p_application_id;

  IF v_is_admin THEN
    PERFORM public.notify_user(
      v_application.applicant_id, 'application_message', 'New message about your restaurant application',
      left(trim(p_body), 180), jsonb_build_object('application_id', p_application_id)
    );
  ELSE
    FOR v_admin IN SELECT id FROM public.profiles WHERE role = 'super_admin' LOOP
      PERFORM public.notify_user(
        v_admin.id, 'application_message', 'Applicant replied', left(trim(p_body), 180),
        jsonb_build_object('application_id', p_application_id)
      );
    END LOOP;
  END IF;
  RETURN v_message;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.send_restaurant_application_message(uuid, text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.send_restaurant_application_message(uuid, text, uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.mark_restaurant_application_messages_read(p_application_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_application public.restaurant_applications%ROWTYPE;
  v_is_admin boolean := public.is_super_admin();
  v_count integer;
BEGIN
  SELECT * INTO v_application FROM public.restaurant_applications WHERE id = p_application_id;
  IF NOT FOUND OR (NOT v_is_admin AND v_application.applicant_id <> auth.uid()) THEN
    RAISE EXCEPTION 'Application not found.' USING ERRCODE = '42501';
  END IF;
  UPDATE public.restaurant_application_messages
  SET read_by_recipient_at = now()
  WHERE application_id = p_application_id
    AND read_by_recipient_at IS NULL
    AND sender_role <> CASE WHEN v_is_admin THEN 'super_admin' ELSE 'applicant' END;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.mark_restaurant_application_messages_read(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mark_restaurant_application_messages_read(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.update_restaurant_application_internal_notes(
  p_application_id uuid,
  p_notes text,
  p_expected_version integer DEFAULT NULL
)
RETURNS public.restaurant_applications
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_application public.restaurant_applications%ROWTYPE;
  v_previous text;
BEGIN
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Only the platform owner can edit internal notes.' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO v_application FROM public.restaurant_applications
  WHERE id = p_application_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Application not found.' USING ERRCODE = 'P0002'; END IF;
  IF p_expected_version IS NOT NULL AND v_application.application_version <> p_expected_version THEN
    RAISE EXCEPTION 'This application changed in another session. Reload before saving.' USING ERRCODE = '40001';
  END IF;
  v_previous := v_application.admin_internal_notes;
  UPDATE public.restaurant_applications
  SET admin_internal_notes = NULLIF(trim(p_notes), ''),
      application_version = application_version + 1,
      updated_at = now()
  WHERE id = p_application_id
  RETURNING * INTO v_application;

  PERFORM public.log_activity(
    'admin_action', 'restaurant_application', p_application_id,
    jsonb_build_object(
      'action', 'internal_notes_updated',
      'previous', v_previous,
      'new', v_application.admin_internal_notes,
      'version', v_application.application_version
    )
  );
  RETURN v_application;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.update_restaurant_application_internal_notes(uuid, text, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_restaurant_application_internal_notes(uuid, text, integer) TO authenticated;

-- ---------------------------------------------------------------------------
-- Admin review and preliminary approval
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.review_restaurant_application(
  p_application_id uuid,
  p_target_status text,
  p_reason text DEFAULT NULL,
  p_expected_version integer DEFAULT NULL
)
RETURNS public.restaurant_applications
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_application public.restaurant_applications%ROWTYPE;
  v_old_status text;
  v_allowed boolean := false;
BEGIN
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Only the platform owner can review applications.' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO v_application FROM public.restaurant_applications
  WHERE id = p_application_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Application not found.' USING ERRCODE = 'P0002'; END IF;
  IF p_expected_version IS NOT NULL AND v_application.application_version <> p_expected_version THEN
    RAISE EXCEPTION 'This application changed in another session. Reload before acting.' USING ERRCODE = '40001';
  END IF;

  v_allowed :=
    (v_application.status IN ('submitted','resubmitted') AND p_target_status = 'under_review')
    OR (v_application.status = 'under_review' AND p_target_status IN ('changes_requested','rejected'))
    OR (v_application.status IN ('onboarding_in_progress','menu_review') AND p_target_status = 'changes_requested')
    OR (v_application.status = 'onboarding_in_progress' AND p_target_status = 'menu_review')
    OR (v_application.status = 'menu_review' AND p_target_status = 'ready_to_publish')
    OR (v_application.status = 'published' AND p_target_status = 'suspended')
    OR (v_application.status = 'suspended' AND p_target_status = 'onboarding_in_progress')
    OR (p_target_status = 'archived' AND v_application.status <> 'published');
  IF NOT v_allowed THEN
    RAISE EXCEPTION 'Invalid application transition: % -> %', v_application.status, p_target_status USING ERRCODE = '22023';
  END IF;
  IF p_target_status IN ('changes_requested','rejected','suspended') AND length(trim(COALESCE(p_reason,''))) < 3 THEN
    RAISE EXCEPTION 'A clear reason is required.' USING ERRCODE = '22023';
  END IF;

  v_old_status := v_application.status;

  UPDATE public.restaurant_applications
  SET status = p_target_status,
      changes_requested_reason = CASE WHEN p_target_status = 'changes_requested' THEN trim(p_reason) ELSE changes_requested_reason END,
      rejection_reason = CASE WHEN p_target_status = 'rejected' THEN trim(p_reason) ELSE rejection_reason END,
      reviewed_by = auth.uid(), reviewed_at = now(),
      application_version = application_version + 1,
      last_transition_at = now(), updated_at = now()
  WHERE id = p_application_id
  RETURNING * INTO v_application;

  IF v_application.restaurant_id IS NOT NULL AND p_target_status = 'suspended' THEN
    UPDATE public.restaurants SET status = 'suspended', updated_at = now()
    WHERE id = v_application.restaurant_id;
  ELSIF v_application.restaurant_id IS NOT NULL
        AND v_old_status = 'suspended' AND p_target_status = 'onboarding_in_progress' THEN
    UPDATE public.restaurants SET status = 'pending_approval', updated_at = now()
    WHERE id = v_application.restaurant_id;
  END IF;

  INSERT INTO public.restaurant_application_transitions (
    application_id, from_status, to_status, actor_id, actor_role, reason,
    metadata
  ) VALUES (
    p_application_id, v_old_status,
    p_target_status, auth.uid(), 'super_admin', NULLIF(trim(p_reason), ''),
    jsonb_build_object('version', v_application.application_version)
  );

  PERFORM public.notify_user(
    v_application.applicant_id,
    CASE WHEN p_target_status = 'changes_requested' THEN 'application_changes_requested' ELSE 'application_status_changed' END,
    CASE p_target_status
      WHEN 'under_review' THEN 'Your restaurant application is under review'
      WHEN 'changes_requested' THEN 'Changes requested for your restaurant application'
      WHEN 'rejected' THEN 'Restaurant application decision'
      WHEN 'menu_review' THEN 'Your menu is being reviewed'
      WHEN 'ready_to_publish' THEN 'Restaurant setup is ready for final review'
      WHEN 'suspended' THEN 'Restaurant suspended'
      ELSE 'Restaurant application updated'
    END,
    COALESCE(NULLIF(trim(p_reason), ''), v_application.restaurant_name),
    jsonb_build_object('application_id', p_application_id, 'status', p_target_status)
  );
  PERFORM public.log_activity(
    'admin_action', 'restaurant_application', p_application_id,
    jsonb_build_object('action', 'application_transition', 'to', p_target_status, 'reason', p_reason, 'version', v_application.application_version)
  );
  RETURN v_application;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.review_restaurant_application(uuid, text, text, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.review_restaurant_application(uuid, text, text, integer) TO authenticated;

CREATE OR REPLACE FUNCTION public.preliminarily_approve_restaurant_application(
  p_application_id uuid,
  p_food_commission_rate numeric,
  p_delivery_share_rate numeric DEFAULT 0,
  p_commission_base text DEFAULT 'food_subtotal',
  p_note text DEFAULT NULL,
  p_expected_version integer DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_application public.restaurant_applications%ROWTYPE;
  v_restaurant_id uuid;
  v_term_id uuid;
  v_next_term_version integer;
BEGIN
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Only the platform owner can approve applications.' USING ERRCODE = '42501';
  END IF;
  IF p_food_commission_rate < 0 OR p_food_commission_rate > 1
     OR p_delivery_share_rate < 0 OR p_delivery_share_rate > 1
     OR p_commission_base NOT IN ('food_subtotal','food_plus_delivery') THEN
    RAISE EXCEPTION 'Approved commercial terms are invalid.' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO v_application FROM public.restaurant_applications
  WHERE id = p_application_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Application not found.' USING ERRCODE = 'P0002'; END IF;
  IF v_application.status <> 'under_review' THEN
    RAISE EXCEPTION 'Application is not eligible for preliminary approval.' USING ERRCODE = '22023';
  END IF;
  IF p_expected_version IS NOT NULL AND v_application.application_version <> p_expected_version THEN
    RAISE EXCEPTION 'This application changed in another session. Reload before acting.' USING ERRCODE = '40001';
  END IF;

  v_restaurant_id := v_application.restaurant_id;
  IF v_restaurant_id IS NULL THEN
    INSERT INTO public.restaurants (
      owner_id, source_application_id, name, description, phone, address,
      street, neighborhood, commune, city, province, postal_code, country, wilaya_id,
      cuisine, opening_hours, image_url, latitude, longitude, place_id,
      location_accuracy_m, location_verified, location_source, location_updated_at,
      max_delivery_km, min_order_amount, status, operational_status
    ) VALUES (
      v_application.applicant_id, v_application.id, v_application.restaurant_name,
      v_application.description, v_application.phone, v_application.address,
      v_application.street, v_application.neighborhood, v_application.commune,
      v_application.city, v_application.province, v_application.postal_code,
      COALESCE(v_application.country, 'Algeria'), v_application.wilaya_id, v_application.cuisine,
      v_application.opening_hours, COALESCE(v_application.cover_image_url, v_application.logo_url),
      v_application.latitude, v_application.longitude, v_application.place_id,
      v_application.location_accuracy_m, v_application.location_confirmed,
      v_application.location_source, now(), v_application.max_delivery_km,
      v_application.min_order_amount, 'pending_approval', 'closed'
    ) RETURNING id INTO v_restaurant_id;
  END IF;

  INSERT INTO public.restaurant_memberships (
    restaurant_id, user_id, membership_role, status, invited_by
  ) VALUES (v_restaurant_id, v_application.applicant_id, 'owner', 'active', auth.uid())
  ON CONFLICT (restaurant_id, user_id) DO UPDATE
  SET membership_role = 'owner', status = 'active', updated_at = now();

  UPDATE public.profiles
  SET role = CASE WHEN role = 'super_admin' THEN role ELSE 'restaurant_owner'::public.user_role END,
      updated_at = now()
  WHERE id = v_application.applicant_id;

  UPDATE public.restaurant_commercial_terms
  SET status = 'replaced', expires_at = now(), updated_at = now()
  WHERE restaurant_id = v_restaurant_id AND status = 'active';

  SELECT COALESCE(max(version), 0) + 1 INTO v_next_term_version
  FROM public.restaurant_commercial_terms
  WHERE restaurant_id = v_restaurant_id OR application_id = v_application.id;
  INSERT INTO public.restaurant_commercial_terms (
    application_id, restaurant_id, version, status, commission_base,
    food_commission_rate, delivery_share_rate, proposed_by, approved_by,
    effective_at, note
  ) VALUES (
    v_application.id, v_restaurant_id, v_next_term_version, 'active', p_commission_base,
    p_food_commission_rate, p_delivery_share_rate, v_application.applicant_id,
    auth.uid(), now(), NULLIF(trim(p_note), '')
  ) RETURNING id INTO v_term_id;

  INSERT INTO public.restaurant_application_transitions (
    application_id, from_status, to_status, actor_id, actor_role, reason, metadata
  ) VALUES (
    v_application.id, v_application.status, 'preliminarily_approved', auth.uid(),
    'super_admin', NULLIF(trim(p_note), ''),
    jsonb_build_object('restaurant_id', v_restaurant_id, 'commercial_term_id', v_term_id)
  );
  INSERT INTO public.restaurant_application_transitions (
    application_id, from_status, to_status, actor_id, actor_role, metadata
  ) VALUES (
    v_application.id, 'preliminarily_approved', 'onboarding_in_progress', auth.uid(),
    'super_admin', jsonb_build_object('restaurant_id', v_restaurant_id)
  );

  UPDATE public.restaurant_applications
  SET restaurant_id = v_restaurant_id, status = 'onboarding_in_progress',
      reviewed_by = auth.uid(), reviewed_at = now(),
      application_version = application_version + 1,
      last_transition_at = now(), updated_at = now()
  WHERE id = v_application.id;

  PERFORM public.notify_user(
    v_application.applicant_id, 'application_preliminarily_approved',
    'Restaurant application approved for onboarding',
    'Complete your restaurant profile, delivery settings, hours, and menu for final publication review.',
    jsonb_build_object('application_id', v_application.id, 'restaurant_id', v_restaurant_id)
  );
  PERFORM public.log_activity(
    'admin_action', 'restaurant_application', v_application.id,
    jsonb_build_object(
      'action', 'preliminary_approval', 'restaurant_id', v_restaurant_id,
      'commercial_term_id', v_term_id, 'food_commission_rate', p_food_commission_rate,
      'delivery_share_rate', p_delivery_share_rate, 'commission_base', p_commission_base
    )
  );
  RETURN jsonb_build_object(
    'application_id', v_application.id, 'restaurant_id', v_restaurant_id,
    'commercial_term_id', v_term_id, 'status', 'onboarding_in_progress'
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.preliminarily_approve_restaurant_application(uuid, numeric, numeric, text, text, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.preliminarily_approve_restaurant_application(uuid, numeric, numeric, text, text, integer) TO authenticated;

-- ---------------------------------------------------------------------------
-- Central publication-readiness contract and guarded publish action
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.get_restaurant_publication_readiness(p_restaurant_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_restaurant public.restaurants%ROWTYPE;
  v_application public.restaurant_applications%ROWTYPE;
  v_blockers jsonb := '[]'::jsonb;
BEGIN
  SELECT * INTO v_restaurant FROM public.restaurants WHERE id = p_restaurant_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ready', false, 'blockers', jsonb_build_array('Restaurant does not exist.'));
  END IF;
  IF NOT public.is_super_admin()
     AND NOT EXISTS (
       SELECT 1 FROM public.restaurant_memberships m
       WHERE m.restaurant_id = p_restaurant_id AND m.user_id = auth.uid() AND m.status = 'active'
     ) THEN
    RAISE EXCEPTION 'Not allowed to inspect this restaurant.' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_application FROM public.restaurant_applications
  WHERE restaurant_id = p_restaurant_id LIMIT 1;
  IF v_restaurant.source_application_id IS NOT NULL
     AND (v_application.id IS NULL OR v_application.status NOT IN ('onboarding_in_progress','menu_review','ready_to_publish','published','suspended')) THEN
    v_blockers := v_blockers || jsonb_build_array('Application has not completed preliminary approval.');
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.restaurant_memberships m
    WHERE m.restaurant_id = p_restaurant_id AND m.membership_role = 'owner' AND m.status = 'active'
  ) THEN
    v_blockers := v_blockers || jsonb_build_array('No active restaurant owner membership exists.');
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.restaurant_commercial_terms t
    WHERE t.restaurant_id = p_restaurant_id AND t.status = 'active'
      AND t.effective_at <= now() AND (t.expires_at IS NULL OR t.expires_at > now())
  ) THEN
    v_blockers := v_blockers || jsonb_build_array('Commercial terms are not approved and active.');
  END IF;
  IF length(trim(COALESCE(v_restaurant.name,''))) < 2 THEN
    v_blockers := v_blockers || jsonb_build_array('Public restaurant name is missing.');
  END IF;
  IF length(trim(COALESCE(v_restaurant.phone,''))) < 6 THEN
    v_blockers := v_blockers || jsonb_build_array('Restaurant contact phone is missing.');
  END IF;
  IF length(trim(COALESCE(v_restaurant.address,''))) < 5 THEN
    v_blockers := v_blockers || jsonb_build_array('Restaurant address is missing.');
  END IF;
  IF NOT COALESCE(v_restaurant.location_verified, false)
     OR NOT public.kiyo_is_coordinate_in_algeria(v_restaurant.latitude, v_restaurant.longitude) THEN
    v_blockers := v_blockers || jsonb_build_array('Restaurant coordinates are missing or unverified.');
  END IF;
  IF v_restaurant.opening_hours IS NULL OR v_restaurant.opening_hours = '{}'::jsonb THEN
    v_blockers := v_blockers || jsonb_build_array('Opening hours are not configured.');
  END IF;
  IF length(trim(COALESCE(v_restaurant.image_url,''))) < 8 THEN
    v_blockers := v_blockers || jsonb_build_array('A public restaurant image or logo is required.');
  END IF;
  IF COALESCE(v_restaurant.max_delivery_km, 0) <= 0 THEN
    v_blockers := v_blockers || jsonb_build_array('Delivery coverage is not configured.');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.menu_categories c WHERE c.restaurant_id = p_restaurant_id) THEN
    v_blockers := v_blockers || jsonb_build_array('No menu category exists.');
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.menu_items i
    WHERE i.restaurant_id = p_restaurant_id AND i.is_available = true
      AND i.price > 0 AND length(trim(COALESCE(i.name,''))) >= 2
  ) THEN
    v_blockers := v_blockers || jsonb_build_array('No active, correctly priced dish exists.');
  END IF;
  IF v_application.id IS NOT NULL
     AND v_application.changes_requested_reason IS NOT NULL
     AND v_application.status = 'changes_requested' THEN
    v_blockers := v_blockers || jsonb_build_array('A blocking change request is unresolved.');
  END IF;

  RETURN jsonb_build_object(
    'ready', jsonb_array_length(v_blockers) = 0,
    'blockers', v_blockers,
    'restaurant_id', p_restaurant_id,
    'application_id', v_application.id,
    'checked_at', now()
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_restaurant_publication_readiness(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_restaurant_publication_readiness(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.publish_restaurant(
  p_restaurant_id uuid,
  p_expected_application_version integer DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_restaurant public.restaurants%ROWTYPE;
  v_application public.restaurant_applications%ROWTYPE;
  v_readiness jsonb;
BEGIN
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Only the platform owner can publish restaurants.' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO v_restaurant FROM public.restaurants WHERE id = p_restaurant_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Restaurant not found.' USING ERRCODE = 'P0002'; END IF;
  SELECT * INTO v_application FROM public.restaurant_applications
  WHERE restaurant_id = p_restaurant_id FOR UPDATE;
  IF NOT FOUND AND v_restaurant.source_application_id IS NOT NULL THEN
    RAISE EXCEPTION 'Restaurant has no approved application.' USING ERRCODE = '22023';
  END IF;
  IF v_application.id IS NOT NULL
     AND p_expected_application_version IS NOT NULL
     AND v_application.application_version <> p_expected_application_version THEN
    RAISE EXCEPTION 'This application changed in another session. Reload before publishing.' USING ERRCODE = '40001';
  END IF;
  IF v_application.id IS NOT NULL AND v_application.status NOT IN ('ready_to_publish','suspended') THEN
    RAISE EXCEPTION 'Restaurant is not in a publishable workflow state.' USING ERRCODE = '22023';
  END IF;

  v_readiness := public.get_restaurant_publication_readiness(p_restaurant_id);
  IF COALESCE((v_readiness->>'ready')::boolean, false) IS NOT TRUE THEN
    RAISE EXCEPTION 'Cannot publish restaurant: %', v_readiness->'blockers' USING ERRCODE = '22023';
  END IF;

  UPDATE public.restaurants
  SET status = 'published', is_verified = true, updated_at = now()
  WHERE id = p_restaurant_id;
  IF v_application.id IS NOT NULL THEN
    UPDATE public.restaurant_applications
    SET status = 'published', application_version = application_version + 1,
        last_transition_at = now(), updated_at = now()
    WHERE id = v_application.id;
    INSERT INTO public.restaurant_application_transitions (
      application_id, from_status, to_status, actor_id, actor_role, metadata
    ) VALUES (
      v_application.id, v_application.status, 'published', auth.uid(), 'super_admin',
      jsonb_build_object('restaurant_id', p_restaurant_id, 'readiness', v_readiness)
    );
    PERFORM public.notify_user(
      v_application.applicant_id, 'restaurant_published', 'Your restaurant is now published',
      v_application.restaurant_name,
      jsonb_build_object('application_id', v_application.id, 'restaurant_id', p_restaurant_id)
    );
  END IF;
  PERFORM public.log_activity(
    'admin_action', 'restaurant', p_restaurant_id,
    jsonb_build_object('action', 'restaurant_published', 'application_id', v_application.id, 'readiness', v_readiness)
  );
  RETURN v_readiness || jsonb_build_object('status', 'published');
END;
$$;

REVOKE EXECUTE ON FUNCTION public.publish_restaurant(uuid, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.publish_restaurant(uuid, integer) TO authenticated;

-- Existing status RPC can no longer bypass application/readiness checks.
CREATE OR REPLACE FUNCTION public.set_restaurant_status(
  p_restaurant_id uuid, p_status public.restaurant_status
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_old public.restaurant_status;
  v_application_id uuid;
BEGIN
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Only the platform owner can change restaurant status.' USING ERRCODE = '42501';
  END IF;
  SELECT status, source_application_id INTO v_old, v_application_id
  FROM public.restaurants WHERE id = p_restaurant_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Restaurant not found.' USING ERRCODE = 'P0002'; END IF;
  IF v_old = p_status THEN RETURN; END IF;
  IF p_status = 'published' THEN
    PERFORM public.publish_restaurant(p_restaurant_id, NULL);
    RETURN;
  END IF;
  IF NOT (
    (v_old = 'published' AND p_status IN ('hidden','suspended'))
    OR (v_old IN ('draft','pending_approval','hidden','suspended') AND p_status IN ('draft','pending_approval','hidden','suspended'))
  ) THEN
    RAISE EXCEPTION 'Invalid restaurant transition: % -> %', v_old, p_status USING ERRCODE = '22023';
  END IF;
  UPDATE public.restaurants SET status = p_status, updated_at = now() WHERE id = p_restaurant_id;
  IF v_application_id IS NOT NULL AND p_status = 'suspended' THEN
    UPDATE public.restaurant_applications
    SET status = 'suspended', application_version = application_version + 1,
        last_transition_at = now(), updated_at = now()
    WHERE id = v_application_id;
  END IF;
  PERFORM public.log_activity(
    'admin_action', 'restaurant', p_restaurant_id,
    jsonb_build_object('action', 'status_change', 'from', v_old, 'to', p_status, 'application_id', v_application_id)
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.set_restaurant_status(uuid, public.restaurant_status) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_restaurant_status(uuid, public.restaurant_status) TO authenticated;

CREATE OR REPLACE FUNCTION public.guard_restaurant_lifecycle_status()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status AND NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Restaurant publication status is controlled by the platform review workflow.' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_restaurant_lifecycle_status ON public.restaurants;
CREATE TRIGGER trg_guard_restaurant_lifecycle_status
  BEFORE UPDATE OF status ON public.restaurants
  FOR EACH ROW EXECUTE FUNCTION public.guard_restaurant_lifecycle_status();

CREATE OR REPLACE FUNCTION public.update_restaurant_admin(
  p_restaurant_id uuid,
  p_status text DEFAULT NULL,
  p_is_verified boolean DEFAULT NULL,
  p_is_featured boolean DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Only the platform owner can manage restaurants.' USING ERRCODE = '42501';
  END IF;
  IF p_status IS NOT NULL THEN
    PERFORM public.set_restaurant_status(p_restaurant_id, p_status::public.restaurant_status);
  END IF;
  UPDATE public.restaurants
  SET is_verified = COALESCE(p_is_verified, is_verified),
      is_featured = COALESCE(p_is_featured, is_featured),
      featured_until = CASE
        WHEN p_is_featured IS TRUE THEN now() + interval '30 days'
        WHEN p_is_featured IS FALSE THEN NULL
        ELSE featured_until
      END,
      updated_at = now()
  WHERE id = p_restaurant_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Restaurant not found.' USING ERRCODE = 'P0002'; END IF;
  PERFORM public.log_activity(
    'restaurant_admin_update', 'restaurant', p_restaurant_id,
    jsonb_build_object('status', p_status, 'verified', p_is_verified, 'featured', p_is_featured)
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.update_restaurant_admin(uuid, text, boolean, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_restaurant_admin(uuid, text, boolean, boolean) TO authenticated;

-- Realtime publication for the two application collaboration tables.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'restaurant_applications'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.restaurant_applications;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'restaurant_application_messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.restaurant_application_messages;
  END IF;
END;
$$;

COMMIT;
