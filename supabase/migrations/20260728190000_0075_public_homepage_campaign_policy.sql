-- Kiyo Food 0075: expose only active public homepage campaigns to anonymous visitors.
-- Additive security policy only; no existing data is changed or deleted.

BEGIN;

ALTER TABLE public.marketing_campaigns ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS campaigns_select_public_homepage ON public.marketing_campaigns;
CREATE POLICY campaigns_select_public_homepage
  ON public.marketing_campaigns
  FOR SELECT
  TO anon, authenticated
  USING (
    is_active = true
    AND campaign_type = 'in_app'
    AND target_audience IN ('all', 'customers')
    AND (scheduled_start IS NULL OR scheduled_start <= now())
    AND (scheduled_end IS NULL OR scheduled_end > now())
  );

CREATE INDEX IF NOT EXISTS idx_marketing_campaigns_public_homepage
  ON public.marketing_campaigns (created_at DESC)
  WHERE is_active = true
    AND campaign_type = 'in_app'
    AND target_audience IN ('all', 'customers');

COMMIT;
