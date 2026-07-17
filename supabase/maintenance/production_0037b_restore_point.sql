-- Scoped production restore point for the additive 0037b reconciliation.
-- Run once immediately before 0037b. This snapshots the affected table only.
BEGIN;

CREATE SCHEMA IF NOT EXISTS kiyo_restore_points;
REVOKE ALL ON SCHEMA kiyo_restore_points FROM PUBLIC;
REVOKE ALL ON SCHEMA kiyo_restore_points FROM anon, authenticated;

CREATE TABLE IF NOT EXISTS kiyo_restore_points.restaurants_before_0037b_20260714
AS TABLE public.restaurants WITH DATA;

REVOKE ALL ON ALL TABLES IN SCHEMA kiyo_restore_points FROM PUBLIC;
REVOKE ALL ON ALL TABLES IN SCHEMA kiyo_restore_points FROM anon, authenticated;

CREATE TABLE IF NOT EXISTS kiyo_restore_points.restore_manifest (
  restore_point text PRIMARY KEY,
  source_table regclass NOT NULL,
  snapshot_table regclass NOT NULL,
  source_row_count bigint NOT NULL,
  snapshot_row_count bigint NOT NULL,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);

DO $verify_snapshot$
DECLARE
  v_source_count bigint;
  v_snapshot_count bigint;
BEGIN
  SELECT count(*) INTO v_source_count FROM public.restaurants;
  SELECT count(*) INTO v_snapshot_count
  FROM kiyo_restore_points.restaurants_before_0037b_20260714;

  IF v_source_count <> v_snapshot_count THEN
    RAISE EXCEPTION
      'Restore point row count mismatch: production has %, snapshot has %. Stop rollout.',
      v_source_count, v_snapshot_count;
  END IF;

  IF EXISTS (
    SELECT id FROM public.restaurants
    EXCEPT
    SELECT id FROM kiyo_restore_points.restaurants_before_0037b_20260714
  ) OR EXISTS (
    SELECT id FROM kiyo_restore_points.restaurants_before_0037b_20260714
    EXCEPT
    SELECT id FROM public.restaurants
  ) THEN
    RAISE EXCEPTION 'Restore point restaurant IDs do not match production. Stop rollout.';
  END IF;

  INSERT INTO kiyo_restore_points.restore_manifest (
    restore_point, source_table, snapshot_table,
    source_row_count, snapshot_row_count
  ) VALUES (
    'before_0037b_20260714',
    'public.restaurants'::regclass,
    'kiyo_restore_points.restaurants_before_0037b_20260714'::regclass,
    v_source_count,
    v_snapshot_count
  )
  ON CONFLICT (restore_point) DO NOTHING;
END
$verify_snapshot$;

REVOKE ALL ON kiyo_restore_points.restore_manifest FROM PUBLIC, anon, authenticated;

COMMIT;

SELECT
  'RESTORE_POINT_READY' AS status,
  restore_point,
  source_row_count,
  snapshot_row_count,
  created_at
FROM kiyo_restore_points.restore_manifest
WHERE restore_point = 'before_0037b_20260714';