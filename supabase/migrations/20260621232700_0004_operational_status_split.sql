-- Add operational_status (open/closed/busy) as a distinct column from
-- lifecycle status (draft/pending/published/hidden/suspended).
-- Migration 0003 overloaded `status` for lifecycle, removing the operational
-- signal. Restore it as a separate column so dashboards can show "Open now".

ALTER TABLE restaurants
  ADD COLUMN IF NOT EXISTS operational_status text NOT NULL DEFAULT 'closed'
  CHECK (operational_status IN ('open','closed','busy'));

-- Backfill from the `status` text column leftover? No — that column was replaced.
-- Default published restaurants to 'open'.
UPDATE restaurants SET operational_status = 'open'
  WHERE status = 'published' AND operational_status = 'closed';

-- Restaurant owners may toggle their own operational_status directly;
-- this is operational state (open/closed/busy), not lifecycle.
-- Already covered by restaurants_update_owner_or_admin RLS policy.
