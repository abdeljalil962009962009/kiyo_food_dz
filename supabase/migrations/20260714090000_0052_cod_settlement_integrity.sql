-- Kiyo Food 0052: keep COD settlements consistent with immutable order ledgers.
-- Depends on 0038 and the trusted action boundary introduced in 0046-0049.

BEGIN;

ALTER TABLE public.financial_ledger
  ADD COLUMN IF NOT EXISTS settlement_id uuid
    REFERENCES public.settlements(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS accounting_effective_at timestamptz;

UPDATE public.financial_ledger ledger
SET accounting_effective_at = COALESCE(
  (
    SELECT max(transition.created_at)
    FROM public.order_status_transitions transition
    WHERE transition.order_id = ledger.order_id
      AND transition.to_status::text = 'delivered'
  ),
  ledger.created_at
)
WHERE ledger.accounting_status <> 'pending'
  AND ledger.accounting_effective_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_financial_ledger_settlement_id
  ON public.financial_ledger(settlement_id)
  WHERE settlement_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_financial_ledger_settlement_candidates
  ON public.financial_ledger(
    restaurant_id, accounting_effective_at, accounting_status, settlement_status
  )
  WHERE settlement_id IS NULL;

CREATE OR REPLACE FUNCTION public.guard_settlement_ledger_link()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF NEW.accounting_status IS DISTINCT FROM OLD.accounting_status THEN
    NEW.accounting_effective_at := now();
  END IF;

  IF OLD.settlement_id IS NOT NULL
     AND NEW.settlement_id IS DISTINCT FROM OLD.settlement_id THEN
    RAISE EXCEPTION 'A ledger entry cannot be moved between settlements.'
      USING ERRCODE = '42501';
  END IF;

  -- A cancellation/refund after a settlement has been generated is a
  -- financial dispute, never an ordinary void that silently leaves the
  -- settlement totals unchanged.
  IF OLD.settlement_id IS NOT NULL
     AND NEW.accounting_status IN ('void', 'disputed') THEN
    NEW.accounting_status := 'disputed';
    NEW.settlement_status := 'disputed';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.guard_settlement_ledger_link()
  FROM PUBLIC, anon, authenticated, service_role;

DROP TRIGGER IF EXISTS trg_settlement_ledger_link_guard
  ON public.financial_ledger;
CREATE TRIGGER trg_settlement_ledger_link_guard
  BEFORE UPDATE OF settlement_id, accounting_status, settlement_status
  ON public.financial_ledger
  FOR EACH ROW EXECUTE FUNCTION public.guard_settlement_ledger_link();

CREATE OR REPLACE FUNCTION public.sync_disputed_settlement_from_ledger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.settlement_id IS NOT NULL
     AND NEW.accounting_status = 'disputed'
     AND OLD.accounting_status IS DISTINCT FROM NEW.accounting_status THEN
    UPDATE public.settlements
    SET status = 'disputed',
        notes = concat_ws(E'\n', NULLIF(notes, ''),
          'Automatically disputed after order ' || NEW.order_id::text ||
          ' changed after settlement generation.'),
        updated_at = now()
    WHERE id = NEW.settlement_id
      AND status <> 'disputed';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.sync_disputed_settlement_from_ledger()
  FROM PUBLIC, anon, authenticated, service_role;

DROP TRIGGER IF EXISTS trg_sync_disputed_settlement_from_ledger
  ON public.financial_ledger;
CREATE TRIGGER trg_sync_disputed_settlement_from_ledger
  AFTER UPDATE OF accounting_status ON public.financial_ledger
  FOR EACH ROW EXECUTE FUNCTION public.sync_disputed_settlement_from_ledger();

CREATE OR REPLACE FUNCTION public.generate_monthly_settlement(
  p_restaurant_id uuid,
  p_period_start date
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_period_start date := date_trunc('month', p_period_start)::date;
  v_period_end date := (date_trunc('month', p_period_start)
    + interval '1 month' - interval '1 day')::date;
  v_gross numeric(12,2);
  v_commission numeric(12,2);
  v_service numeric(12,2);
  v_payout numeric(12,2);
  v_owed numeric(12,2);
  v_due_date date;
  v_settlement_id uuid;
  v_due_day integer;
  v_entry_count integer;
  v_ledger_ids uuid[];
BEGIN
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Only the platform owner can generate settlements.'
      USING ERRCODE = '42501';
  END IF;
  IF p_restaurant_id IS NULL OR p_period_start IS NULL THEN
    RAISE EXCEPTION 'Restaurant and settlement month are required.'
      USING ERRCODE = '22023';
  END IF;

  -- Serialize settlement generation per restaurant/month, including requests
  -- arriving from separate browser tabs or retried server calls.
  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      p_restaurant_id::text || ':' || v_period_start::text,
      84152
    )
  );

  IF EXISTS (
    SELECT 1 FROM public.settlements
    WHERE restaurant_id = p_restaurant_id
      AND period_start = v_period_start
  ) THEN
    RAISE EXCEPTION 'A settlement already exists for this restaurant and month.'
      USING ERRCODE = '23505';
  END IF;

  SELECT array_agg(eligible.id ORDER BY eligible.id),
         count(*),
         COALESCE(sum(order_total), 0),
         COALESCE(sum(platform_commission), 0),
         COALESCE(sum(service_fee), 0),
         COALESCE(sum(restaurant_payout), 0)
  INTO v_ledger_ids, v_entry_count, v_gross, v_commission, v_service, v_payout
  FROM (
    SELECT ledger.*
    FROM public.financial_ledger ledger
    WHERE ledger.restaurant_id = p_restaurant_id
      AND ledger.accounting_status = 'earned'
      AND ledger.settlement_status = 'pending'
      AND ledger.settlement_id IS NULL
      AND ledger.accounting_effective_at >= v_period_start
      AND ledger.accounting_effective_at < v_period_end + interval '1 day'
    FOR UPDATE
  ) eligible;

  IF v_entry_count = 0 THEN
    RAISE EXCEPTION 'No delivered, unsettled COD orders exist for this month.'
      USING ERRCODE = 'P0002';
  END IF;

  -- Under Cash on Delivery the restaurant receives the customer cash. The
  -- platform is therefore owed both its approved commission/delivery share and
  -- the immutable customer service fees captured by the order snapshot.
  v_owed := v_commission + v_service;
  SELECT (value->>'due_day')::integer INTO v_due_day
  FROM public.platform_settings WHERE key = 'settlement';
  v_due_date := (v_period_start + interval '1 month'
    + (COALESCE(v_due_day, 15) - 1) * interval '1 day')::date;

  INSERT INTO public.settlements (
    restaurant_id, period_start, period_end,
    gross_sales, platform_commission, service_fees, restaurant_payout,
    amount_owed, balance, status, due_date, created_by
  ) VALUES (
    p_restaurant_id, v_period_start, v_period_end,
    v_gross, v_commission, v_service, v_payout,
    v_owed, v_owed, 'pending', v_due_date, auth.uid()
  ) RETURNING id INTO v_settlement_id;

  UPDATE public.financial_ledger
  SET settlement_id = v_settlement_id
  WHERE id = ANY(v_ledger_ids);

  PERFORM public.log_activity(
    'settlement_generated', 'settlement', v_settlement_id,
    jsonb_build_object(
      'restaurant_id', p_restaurant_id,
      'period_start', v_period_start,
      'period_end', v_period_end,
      'entry_count', v_entry_count,
      'gross_sales', v_gross,
      'amount_owed', v_owed
    )
  );
  RETURN jsonb_build_object(
    'settlement_id', v_settlement_id,
    'entry_count', v_entry_count,
    'gross_sales', v_gross,
    'amount_owed', v_owed
  );
END;
$$;

REVOKE ALL ON FUNCTION public.generate_monthly_settlement(uuid, date)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.generate_monthly_settlement(uuid, date)
  TO service_role;

CREATE OR REPLACE FUNCTION public.mark_settlement_paid(
  p_settlement_id uuid,
  p_amount numeric DEFAULT NULL,
  p_notes text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_settlement public.settlements%ROWTYPE;
  v_payment numeric(12,2);
  v_new_paid numeric(12,2);
  v_new_balance numeric(12,2);
  v_new_status text;
BEGIN
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Only the platform owner can record settlement payments.'
      USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_settlement
  FROM public.settlements
  WHERE id = p_settlement_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Settlement not found.' USING ERRCODE = 'P0002';
  END IF;
  IF v_settlement.status = 'disputed' THEN
    RAISE EXCEPTION 'Resolve the settlement dispute before recording payment.'
      USING ERRCODE = '55006';
  END IF;
  IF v_settlement.status = 'paid' OR v_settlement.balance <= 0 THEN
    RAISE EXCEPTION 'Settlement is already paid.' USING ERRCODE = '22023';
  END IF;

  v_payment := COALESCE(p_amount, v_settlement.balance);
  IF v_payment <= 0 OR v_payment > v_settlement.balance THEN
    RAISE EXCEPTION 'Payment must be greater than zero and no more than the outstanding balance.'
      USING ERRCODE = '22023';
  END IF;

  v_new_paid := v_settlement.amount_paid + v_payment;
  v_new_balance := v_settlement.amount_owed - v_new_paid;
  v_new_status := CASE WHEN v_new_balance = 0 THEN 'paid' ELSE 'partially_paid' END;

  UPDATE public.settlements
  SET amount_paid = v_new_paid,
      balance = v_new_balance,
      status = v_new_status,
      settled_at = CASE WHEN v_new_status = 'paid' THEN now() ELSE settled_at END,
      notes = COALESCE(NULLIF(trim(p_notes), ''), notes),
      updated_at = now()
  WHERE id = p_settlement_id;

  IF v_new_status = 'paid' THEN
    UPDATE public.financial_ledger
    SET settlement_status = 'settled',
        accounting_status = 'settled'
    WHERE settlement_id = p_settlement_id
      AND accounting_status = 'earned';
  END IF;

  PERFORM public.log_activity(
    'settlement_marked_paid', 'settlement', p_settlement_id,
    jsonb_build_object(
      'payment', v_payment,
      'amount_paid', v_new_paid,
      'balance', v_new_balance,
      'status', v_new_status
    )
  );
  RETURN jsonb_build_object(
    'status', v_new_status,
    'amount_paid', v_new_paid,
    'balance', v_new_balance
  );
END;
$$;

REVOKE ALL ON FUNCTION public.mark_settlement_paid(uuid, numeric, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mark_settlement_paid(uuid, numeric, text)
  TO service_role;

CREATE OR REPLACE FUNCTION public.get_settlement_overview()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_result jsonb;
BEGIN
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Only the platform owner can view settlements.'
      USING ERRCODE = '42501';
  END IF;

  SELECT jsonb_build_object(
    'total_owed', COALESCE((
      SELECT sum(balance) FROM public.settlements
      WHERE status IN ('pending','overdue','partially_paid')
    ), 0),
    'total_paid', COALESCE((
      SELECT sum(amount_paid) FROM public.settlements WHERE status = 'paid'
    ), 0),
    'overdue_count', (
      SELECT count(*) FROM public.settlements WHERE status = 'overdue'
    ),
    'pending_count', (
      SELECT count(*) FROM public.settlements
      WHERE status IN ('pending','partially_paid')
    ),
    'paid_count', (
      SELECT count(*) FROM public.settlements WHERE status = 'paid'
    ),
    'disputed_count', (
      SELECT count(*) FROM public.settlements WHERE status = 'disputed'
    ),
    'eligible_periods', COALESCE((
      SELECT jsonb_agg(candidate ORDER BY period_start DESC, restaurant_name)
      FROM (
        SELECT jsonb_build_object(
          'restaurant_id', ledger.restaurant_id,
          'restaurant_name', restaurant.name,
          'period_start', date_trunc('month', ledger.accounting_effective_at)::date,
          'entry_count', count(*),
          'gross_sales', round(sum(ledger.order_total), 2),
          'platform_commission', round(sum(ledger.platform_commission), 2),
          'amount_owed', round(sum(ledger.platform_commission + ledger.service_fee), 2),
          'restaurant_payout', round(sum(ledger.restaurant_payout), 2)
        ) AS candidate,
        date_trunc('month', ledger.accounting_effective_at)::date AS period_start,
        restaurant.name AS restaurant_name
        FROM public.financial_ledger ledger
        JOIN public.restaurants restaurant ON restaurant.id = ledger.restaurant_id
        WHERE ledger.accounting_status = 'earned'
          AND ledger.settlement_status = 'pending'
          AND ledger.settlement_id IS NULL
        GROUP BY ledger.restaurant_id, restaurant.name,
          date_trunc('month', ledger.accounting_effective_at)::date
      ) pending_candidates
    ), '[]'::jsonb),
    'recent', COALESCE((
      SELECT jsonb_agg(row_data ORDER BY period_start DESC)
      FROM (
        SELECT jsonb_build_object(
          'id', settlement.id,
          'restaurant_id', settlement.restaurant_id,
          'restaurant_name', restaurant.name,
          'period_start', settlement.period_start,
          'period_end', settlement.period_end,
          'gross_sales', settlement.gross_sales,
          'commission', settlement.platform_commission,
          'payout', settlement.restaurant_payout,
          'amount_owed', settlement.amount_owed,
          'amount_paid', settlement.amount_paid,
          'balance', settlement.balance,
          'status', settlement.status,
          'due_date', settlement.due_date,
          'settled_at', settlement.settled_at,
          'notes', settlement.notes
        ) AS row_data,
        settlement.period_start
        FROM public.settlements settlement
        JOIN public.restaurants restaurant ON restaurant.id = settlement.restaurant_id
        ORDER BY settlement.period_start DESC, settlement.created_at DESC
        LIMIT 50
      ) recent_rows
    ), '[]'::jsonb)
  ) INTO v_result;

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.get_settlement_overview()
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_settlement_overview()
  TO service_role;

CREATE OR REPLACE FUNCTION public.execute_owner_action(
  p_actor_id uuid,
  p_request_id uuid,
  p_action text,
  p_args jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_result jsonb := '{}'::jsonb;
  v_existing public.owner_action_requests%ROWTYPE;
  v_is_read boolean := p_action IN (
    'get_platform_analytics', 'get_admin_alerts', 'get_settlement_overview'
  );
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'Trusted server authorization is required.' USING ERRCODE = '42501';
  END IF;
  IF p_actor_id IS NULL OR p_request_id IS NULL
     OR jsonb_typeof(COALESCE(p_args, '{}'::jsonb)) <> 'object' THEN
    RAISE EXCEPTION 'Invalid owner action request.' USING ERRCODE = '22023';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles profile
    WHERE profile.id = p_actor_id
      AND profile.role = 'super_admin'
      AND NOT COALESCE(profile.is_suspended, false)
  ) THEN
    RAISE EXCEPTION 'Only an active platform owner may perform this action.'
      USING ERRCODE = '42501';
  END IF;

  IF NOT v_is_read THEN
    INSERT INTO public.owner_action_requests (actor_id, request_id, action, args)
    VALUES (p_actor_id, p_request_id, p_action, COALESCE(p_args, '{}'::jsonb))
    ON CONFLICT (actor_id, request_id) DO NOTHING;
    IF NOT FOUND THEN
      SELECT * INTO v_existing FROM public.owner_action_requests
      WHERE actor_id = p_actor_id AND request_id = p_request_id;
      IF v_existing.action <> p_action
         OR v_existing.args <> COALESCE(p_args, '{}'::jsonb) THEN
        RAISE EXCEPTION 'Idempotency key was reused for a different action.'
          USING ERRCODE = 'PT409';
      END IF;
      IF v_existing.completed_at IS NULL THEN
        RAISE EXCEPTION 'This owner action is already being processed.'
          USING ERRCODE = 'PT409';
      END IF;
      RETURN v_existing.result;
    END IF;
  END IF;

  PERFORM set_config('request.jwt.claim.sub', p_actor_id::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  PERFORM set_config(
    'request.jwt.claims',
    jsonb_build_object('sub', p_actor_id, 'role', 'authenticated')::text,
    true
  );

  CASE p_action
    WHEN 'get_platform_analytics' THEN
      v_result := public.get_platform_analytics();
    WHEN 'get_admin_alerts' THEN
      v_result := public.get_admin_alerts();
    WHEN 'get_settlement_overview' THEN
      v_result := public.get_settlement_overview();
    WHEN 'generate_monthly_settlement' THEN
      v_result := public.generate_monthly_settlement(
        (p_args->>'p_restaurant_id')::uuid,
        (p_args->>'p_period_start')::date
      );
    WHEN 'mark_settlement_paid' THEN
      v_result := public.mark_settlement_paid(
        (p_args->>'p_settlement_id')::uuid,
        NULLIF(p_args->>'p_amount', '')::numeric,
        NULLIF(p_args->>'p_notes', '')
      );
    WHEN 'set_user_suspended' THEN
      PERFORM public.set_user_suspended(
        (p_args->>'p_user_id')::uuid,
        (p_args->>'p_suspended')::boolean,
        NULLIF(p_args->>'p_reason', '')
      );
      v_result := jsonb_build_object('ok', true);
    WHEN 'update_restaurant_admin' THEN
      PERFORM public.update_restaurant_admin(
        (p_args->>'p_restaurant_id')::uuid,
        NULLIF(p_args->>'p_status', ''),
        NULLIF(p_args->>'p_is_verified', '')::boolean,
        NULLIF(p_args->>'p_is_featured', '')::boolean
      );
      v_result := jsonb_build_object('ok', true);
    WHEN 'update_platform_setting' THEN
      PERFORM public.update_platform_setting(
        NULLIF(p_args->>'p_key', ''), p_args->'p_value'
      );
      v_result := jsonb_build_object('ok', true);
    WHEN 'update_ticket_status' THEN
      PERFORM public.update_ticket_status(
        (p_args->>'p_ticket_id')::uuid,
        NULLIF(p_args->>'p_status', ''),
        NULLIF(p_args->>'p_priority', '')
      );
      v_result := jsonb_build_object('ok', true);
    WHEN 'review_restaurant_application' THEN
      SELECT to_jsonb(result) INTO v_result
      FROM public.review_restaurant_application(
        (p_args->>'p_application_id')::uuid,
        NULLIF(p_args->>'p_target_status', ''),
        NULLIF(p_args->>'p_reason', ''),
        NULLIF(p_args->>'p_expected_version', '')::integer
      ) result;
    WHEN 'preliminarily_approve_restaurant_application' THEN
      v_result := public.preliminarily_approve_restaurant_application(
        (p_args->>'p_application_id')::uuid,
        (p_args->>'p_food_commission_rate')::numeric,
        COALESCE(NULLIF(p_args->>'p_delivery_share_rate', '')::numeric, 0),
        COALESCE(NULLIF(p_args->>'p_commission_base', ''), 'food_subtotal'),
        NULLIF(p_args->>'p_note', ''),
        NULLIF(p_args->>'p_expected_version', '')::integer
      );
    WHEN 'publish_restaurant' THEN
      v_result := public.publish_restaurant(
        (p_args->>'p_restaurant_id')::uuid,
        NULLIF(p_args->>'p_expected_application_version', '')::integer
      );
    WHEN 'update_restaurant_application_internal_notes' THEN
      SELECT to_jsonb(result) INTO v_result
      FROM public.update_restaurant_application_internal_notes(
        (p_args->>'p_application_id')::uuid,
        COALESCE(p_args->>'p_notes', ''),
        NULLIF(p_args->>'p_expected_version', '')::integer
      ) result;
    WHEN 'set_restaurant_status' THEN
      PERFORM public.set_restaurant_status(
        (p_args->>'p_restaurant_id')::uuid,
        (p_args->>'p_status')::public.restaurant_status
      );
      v_result := jsonb_build_object('ok', true);
    WHEN 'set_marketplace_rule_override' THEN
      SELECT to_jsonb(result) INTO v_result
      FROM public.set_marketplace_rule_override(
        NULLIF(p_args->>'p_scope_type', ''),
        NULLIF(p_args->>'p_scope_id', ''),
        p_args->'p_values',
        COALESCE(NULLIF(p_args->>'p_effective_at', '')::timestamptz, now()),
        NULLIF(p_args->>'p_reason', ''),
        NULLIF(p_args->>'p_expected_version', '')::integer
      ) result;
    WHEN 'remove_marketplace_rule_override' THEN
      PERFORM public.remove_marketplace_rule_override(
        NULLIF(p_args->>'p_scope_type', ''),
        NULLIF(p_args->>'p_scope_id', ''),
        (p_args->>'p_expected_version')::integer,
        NULLIF(p_args->>'p_reason', '')
      );
      v_result := jsonb_build_object('ok', true);
    ELSE
      RAISE EXCEPTION 'Owner action is not allowlisted.' USING ERRCODE = '42501';
  END CASE;

  IF NOT v_is_read THEN
    UPDATE public.owner_action_requests
    SET result = COALESCE(v_result, 'null'::jsonb), completed_at = now()
    WHERE actor_id = p_actor_id AND request_id = p_request_id;
  END IF;
  RETURN v_result;
END
$function$;

REVOKE ALL ON FUNCTION public.execute_owner_action(uuid, uuid, text, jsonb)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.execute_owner_action(uuid, uuid, text, jsonb)
  TO service_role;

COMMIT;
