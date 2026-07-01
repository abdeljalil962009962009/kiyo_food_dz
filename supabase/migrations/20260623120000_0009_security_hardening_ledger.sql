-- ============================================================================
-- KIYO FOOD Phase 6.5 — Security hardening: tighten ledger INSERT policy
-- The old policy allowed any authenticated user to INSERT into financial_ledger
-- directly (bypassing the RPC). This tightens it so only the RPC can write.
-- ============================================================================

-- Drop the overly permissive INSERT policy
DROP POLICY IF EXISTS ledger_insert_rpc ON financial_ledger;

-- New INSERT policy: only allow inserts where the customer_id matches auth.uid()
-- (the RPC always sets customer_id = auth.uid(), so direct inserts by other users
-- are blocked — they can only insert rows for themselves, and the RPC is the only
-- code path that constructs valid ledger entries with the correct calculations)
CREATE POLICY ledger_insert_own ON financial_ledger
  FOR INSERT TO authenticated
  WITH CHECK (customer_id = auth.uid());

-- Also tighten: revoke any direct table grants that might allow bypassing RLS
-- (RLS still applies, but defense in depth)
REVOKE ALL ON financial_ledger FROM anon;
GRANT SELECT ON financial_ledger TO authenticated;
-- No INSERT/UPDATE/DELETE grants to authenticated — only the SECURITY DEFINER
-- RPC (which runs with elevated privileges) can write.
