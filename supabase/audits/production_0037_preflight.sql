-- Read-only production readiness check for migration 0037.
-- This script does not create, update, or delete database objects or data.
WITH
required_tables(object_name) AS (
  VALUES
    ('profiles'), ('restaurants'), ('restaurant_applications'), ('wilayas'),
    ('menu_categories'), ('menu_items'), ('menu_item_modifiers'),
    ('modifier_options'), ('notifications'), ('platform_settings'),
    ('promotions'), ('restaurant_analytics'), ('restaurant_special_hours'),
    ('settlements'), ('financial_ledger')
),
missing_tables AS (
  SELECT
    'BLOCKER'::text AS severity,
    'missing_table'::text AS check_type,
    'public.' || object_name AS object_name,
    'Required by migration 0037 but absent from production.'::text AS detail
  FROM required_tables required
  WHERE to_regclass('public.' || required.object_name) IS NULL
),
required_columns(table_name, column_name) AS (
  VALUES
    ('profiles','id'), ('profiles','role'), ('profiles','updated_at'),

    ('restaurant_applications','id'), ('restaurant_applications','applicant_id'),
    ('restaurant_applications','status'), ('restaurant_applications','restaurant_name'),
    ('restaurant_applications','legal_name'), ('restaurant_applications','description'),
    ('restaurant_applications','phone'), ('restaurant_applications','address'),
    ('restaurant_applications','cuisine'), ('restaurant_applications','opening_hours'),
    ('restaurant_applications','max_delivery_km'), ('restaurant_applications','min_order_amount'),
    ('restaurant_applications','logo_url'), ('restaurant_applications','cover_image_url'),
    ('restaurant_applications','latitude'), ('restaurant_applications','longitude'),
    ('restaurant_applications','location_accuracy_m'),
    ('restaurant_applications','location_confirmed'), ('restaurant_applications','place_id'),
    ('restaurant_applications','location_source'), ('restaurant_applications','address_quality'),
    ('restaurant_applications','created_at'), ('restaurant_applications','updated_at'),

    ('restaurants','id'), ('restaurants','owner_id'), ('restaurants','name'),
    ('restaurants','description'), ('restaurants','phone'), ('restaurants','address'),
    ('restaurants','street'), ('restaurants','neighborhood'), ('restaurants','commune'),
    ('restaurants','city'), ('restaurants','province'), ('restaurants','postal_code'),
    ('restaurants','country'), ('restaurants','wilaya_id'), ('restaurants','cuisine'),
    ('restaurants','opening_hours'), ('restaurants','image_url'), ('restaurants','latitude'),
    ('restaurants','longitude'), ('restaurants','place_id'),
    ('restaurants','location_accuracy_m'), ('restaurants','location_verified'),
    ('restaurants','location_source'), ('restaurants','location_updated_at'),
    ('restaurants','max_delivery_km'), ('restaurants','min_order_amount'),
    ('restaurants','status'), ('restaurants','operational_status'),
    ('restaurants','is_verified'), ('restaurants','created_at'), ('restaurants','updated_at'),

    ('menu_categories','id'), ('menu_categories','restaurant_id'),
    ('menu_items','id'), ('menu_items','restaurant_id'), ('menu_items','name'),
    ('menu_items','price'), ('menu_items','is_available'),
    ('notifications','user_id'), ('notifications','type'), ('notifications','title'),
    ('notifications','body'), ('notifications','metadata'),
    ('platform_settings','key'), ('platform_settings','value'),
    ('wilayas','id')
),
missing_columns AS (
  SELECT
    'BLOCKER'::text AS severity,
    'missing_column'::text AS check_type,
    'public.' || required.table_name || '.' || required.column_name AS object_name,
    'Required by migration 0037 but absent from production.'::text AS detail
  FROM required_columns required
  WHERE to_regclass('public.' || required.table_name) IS NOT NULL
    AND NOT EXISTS (
      SELECT 1
      FROM information_schema.columns columns
      WHERE columns.table_schema = 'public'
        AND columns.table_name = required.table_name
        AND columns.column_name = required.column_name
    )
),
required_types(object_name) AS (
  VALUES ('user_role'), ('restaurant_status')
),
missing_types AS (
  SELECT
    'BLOCKER'::text AS severity,
    'missing_type'::text AS check_type,
    'public.' || required.object_name AS object_name,
    'Required enum/type is absent from production.'::text AS detail
  FROM required_types required
  WHERE to_regtype('public.' || required.object_name) IS NULL
),
required_functions(object_name) AS (
  VALUES
    ('is_super_admin'), ('kiyo_is_coordinate_in_algeria'),
    ('notify_user'), ('log_activity')
),
missing_functions AS (
  SELECT
    'BLOCKER'::text AS severity,
    'missing_function'::text AS check_type,
    'public.' || required.object_name AS object_name,
    'Required helper function is absent from production.'::text AS detail
  FROM required_functions required
  WHERE NOT EXISTS (
    SELECT 1
    FROM pg_proc functions
    JOIN pg_namespace schemas ON schemas.oid = functions.pronamespace
    WHERE schemas.nspname = 'public'
      AND functions.proname = required.object_name
  )
),
blockers AS (
  SELECT * FROM missing_tables
  UNION ALL SELECT * FROM missing_columns
  UNION ALL SELECT * FROM missing_types
  UNION ALL SELECT * FROM missing_functions
),
marker_state AS (
  SELECT jsonb_build_object(
    'restaurant_memberships_table', to_regclass('public.restaurant_memberships') IS NOT NULL,
    'commercial_terms_table', to_regclass('public.restaurant_commercial_terms') IS NOT NULL,
    'submit_application_function', EXISTS (
      SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public' AND p.proname = 'submit_restaurant_application'
    ),
    'preliminary_approval_function', EXISTS (
      SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public' AND p.proname = 'preliminarily_approve_restaurant_application'
    ),
    'review_application_function', EXISTS (
      SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public' AND p.proname = 'review_restaurant_application'
    ),
    'application_message_function', EXISTS (
      SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public' AND p.proname = 'send_restaurant_application_message'
    ),
    'publication_readiness_function', EXISTS (
      SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public' AND p.proname = 'get_restaurant_publication_readiness'
    ),
    'publish_restaurant_function', EXISTS (
      SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public' AND p.proname = 'publish_restaurant'
    )
  ) AS markers
)
SELECT
  CASE
    WHEN count(*) > 0 THEN 'BLOCKED_DO_NOT_RUN_0037'
    WHEN (SELECT markers->>'restaurant_memberships_table' FROM marker_state)::boolean
     AND (SELECT markers->>'commercial_terms_table' FROM marker_state)::boolean
     AND (SELECT markers->>'submit_application_function' FROM marker_state)::boolean
     AND (SELECT markers->>'preliminary_approval_function' FROM marker_state)::boolean
     AND (SELECT markers->>'review_application_function' FROM marker_state)::boolean
     AND (SELECT markers->>'application_message_function' FROM marker_state)::boolean
     AND (SELECT markers->>'publication_readiness_function' FROM marker_state)::boolean
     AND (SELECT markers->>'publish_restaurant_function' FROM marker_state)::boolean
      THEN '0037_PRESENT_READY_FOR_0038'
    ELSE 'READY_FOR_CONTROLLED_0037_ROLLOUT'
  END AS rollout_status,
  count(*)::integer AS blocker_count,
  COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'type', blockers.check_type,
        'object', blockers.object_name,
        'detail', blockers.detail
      ) ORDER BY blockers.check_type, blockers.object_name
    ) FILTER (WHERE blockers.object_name IS NOT NULL),
    '[]'::jsonb
  ) AS blockers,
  (SELECT markers FROM marker_state) AS migration_0037_markers
FROM blockers;