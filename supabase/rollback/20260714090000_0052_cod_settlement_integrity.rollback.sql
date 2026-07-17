-- Emergency recovery for 0052.
--
-- This recovery intentionally disables only the two automatic ledger/settlement
-- synchronization triggers. The additive columns, indexes, trusted gateway, and
-- corrected settlement RPCs remain in place because removing them could orphan
-- financial associations or reintroduce cancelled-order settlement and
-- overpayment defects. Reverting the complete feature requires restoring a
-- verified database backup and the matching application commit together.

BEGIN;

DROP TRIGGER IF EXISTS trg_sync_disputed_settlement_from_ledger
  ON public.financial_ledger;
DROP TRIGGER IF EXISTS trg_settlement_ledger_link_guard
  ON public.financial_ledger;
DROP FUNCTION IF EXISTS public.sync_disputed_settlement_from_ledger();
DROP FUNCTION IF EXISTS public.guard_settlement_ledger_link();

COMMIT;
