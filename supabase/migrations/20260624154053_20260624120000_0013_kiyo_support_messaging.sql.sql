-- ============================================================================
-- KIYO FOOD Phase 7.5 — Support messaging system, ticket order reference
-- ============================================================================

-- ---------- 1. Add order_id to support_tickets ----------
ALTER TABLE support_tickets ADD COLUMN IF NOT EXISTS order_id uuid REFERENCES orders(id) ON DELETE SET NULL;
ALTER TABLE support_tickets ADD COLUMN IF NOT EXISTS restaurant_id uuid REFERENCES restaurants(id) ON DELETE SET NULL;

-- Update the updated_at trigger to fire on status changes
CREATE OR REPLACE FUNCTION public.update_ticket_timestamp()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.update_ticket_timestamp() FROM PUBLIC, anon;

DROP TRIGGER IF EXISTS trg_ticket_timestamp ON support_tickets;
CREATE TRIGGER trg_ticket_timestamp
  BEFORE UPDATE ON support_tickets
  FOR EACH ROW EXECUTE FUNCTION public.update_ticket_timestamp();

-- ---------- 2. support_messages table (threaded conversation) ----------
CREATE TABLE IF NOT EXISTS support_messages (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id   uuid NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
  sender_id   uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  body        text NOT NULL CHECK (length(trim(body)) >= 1),
  is_admin    boolean NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_messages_ticket ON support_messages (ticket_id, created_at);

ALTER TABLE support_messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS msg_select_own ON support_messages;
DROP POLICY IF EXISTS msg_insert_own ON support_messages;
-- Users can see messages on their own tickets; admins can see all
CREATE POLICY msg_select_own ON support_messages
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM support_tickets t
      WHERE t.id = support_messages.ticket_id
      AND (t.requester_id = auth.uid() OR public.is_super_admin())
    )
  );
-- Users can reply to their own tickets; admins can reply to any
CREATE POLICY msg_insert_own ON support_messages
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM support_tickets t
      WHERE t.id = support_messages.ticket_id
      AND (t.requester_id = auth.uid() OR public.is_super_admin())
    )
  );

-- ---------- 3. RPC: reply_to_ticket (admin or ticket owner) ----------
CREATE OR REPLACE FUNCTION public.reply_to_ticket(
  p_ticket_id uuid,
  p_body text,
  p_is_admin boolean DEFAULT false
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_msg_id uuid;
  v_ticket support_tickets%ROWTYPE;
  v_is_admin boolean := p_is_admin;
BEGIN
  SELECT * INTO v_ticket FROM support_tickets WHERE id = p_ticket_id;
  IF v_ticket.id IS NULL THEN
    RAISE EXCEPTION 'ticket not found' USING ERRCODE = 'P0002';
  END IF;

  -- Determine if caller is actually admin
  IF public.is_super_admin() THEN
    v_is_admin := true;
  ELSE
    -- Non-admin can only reply to their own ticket
    IF v_ticket.requester_id != auth.uid() THEN
      RAISE EXCEPTION 'forbidden: not your ticket' USING ERRCODE = '42501';
    END IF;
    v_is_admin := false;
  END IF;

  INSERT INTO support_messages (ticket_id, sender_id, body, is_admin)
  VALUES (p_ticket_id, auth.uid(), p_body, v_is_admin)
  RETURNING id INTO v_msg_id;

  -- If admin replies, set ticket status to in_progress
  IF v_is_admin AND v_ticket.status = 'open' THEN
    UPDATE support_tickets SET status = 'in_progress', assigned_to = auth.uid()
    WHERE id = p_ticket_id;
  END IF;

  -- Notify the other party
  IF v_is_admin THEN
    PERFORM public.notify_user(
      v_ticket.requester_id, 'support_reply',
      'Support reply received',
      v_ticket.subject,
      jsonb_build_object('ticket_id', p_ticket_id)
    );
  ELSE
    -- Notify admin (super_admin gets it)
    PERFORM public.notify_user(
      COALESCE(v_ticket.assigned_to, (SELECT id FROM profiles WHERE role = 'super_admin' LIMIT 1)),
      'support_reply',
      'New support message',
      v_ticket.subject,
      jsonb_build_object('ticket_id', p_ticket_id)
    );
  END IF;

  RETURN v_msg_id;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.reply_to_ticket(uuid, text, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reply_to_ticket(uuid, text, boolean) TO authenticated;

-- ---------- 4. RPC: update_ticket_status (admin only) ----------
CREATE OR REPLACE FUNCTION public.update_ticket_status(
  p_ticket_id uuid,
  p_status text,
  p_priority text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'forbidden: admin only' USING ERRCODE = '42501';
  END IF;

  IF p_status NOT IN ('open','in_progress','resolved','closed') THEN
    RAISE EXCEPTION 'invalid status' USING ERRCODE = '22023';
  END IF;

  IF p_priority IS NOT NULL AND p_priority NOT IN ('low','normal','high','urgent') THEN
    RAISE EXCEPTION 'invalid priority' USING ERRCODE = '22023';
  END IF;

  UPDATE support_tickets
  SET status = p_status,
      priority = COALESCE(p_priority, priority),
      assigned_to = CASE WHEN p_status = 'in_progress' AND assigned_to IS NULL THEN auth.uid() ELSE assigned_to END
  WHERE id = p_ticket_id;

  PERFORM public.log_activity(
    'update_ticket_status', 'support_ticket', p_ticket_id,
    jsonb_build_object('status', p_status, 'priority', p_priority, 'admin', auth.uid())
  );
END;
$$;
REVOKE EXECUTE ON FUNCTION public.update_ticket_status(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_ticket_status(uuid, text, text) TO authenticated;

-- ---------- 5. Add 'support_reply' to notification type CHECK ----------
ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE notifications ADD CONSTRAINT notifications_type_check CHECK (
  type IN ('new_order','order_accepted','order_preparing','order_out_for_delivery',
           'order_delivered','order_cancelled','order_failed_delivery','order_refunded',
           'new_restaurant','high_cancellation','failed_order','suspicious_activity',
           'financial_inconsistency','system_error','settlement_due','support_reply')
);
