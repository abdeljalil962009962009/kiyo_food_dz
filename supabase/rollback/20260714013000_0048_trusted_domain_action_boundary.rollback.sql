-- Emergency application rollback only. The request table is deliberately
-- retained so idempotency and diagnostic history are not destroyed.
BEGIN;

DROP FUNCTION IF EXISTS public.execute_location_insights(uuid, double precision, double precision);
DROP FUNCTION IF EXISTS public.execute_user_action(uuid, uuid, text, jsonb);

COMMIT;
