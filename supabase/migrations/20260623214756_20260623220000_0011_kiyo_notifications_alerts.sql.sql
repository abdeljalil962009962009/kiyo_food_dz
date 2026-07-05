-- ============================================================================
-- KIYO FOOD Phase 6.75 — Real-time notifications, order lifecycle completion,
-- admin alerts, restaurant financial dashboard support
-- ============================================================================

-- ---------- 1. Add failed_delivery + refunded to order_status enum ----------
ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'failed_delivery';
ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'refunded';

-- ---------- 2. notifications table ----------
CREATE TABLE IF NOT EXISTS notifications (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  type        text NOT NULL CHECK (
    type IN ('new_order','order_accepted','order_preparing','order_out_for_delivery',
             'order_delivered','order_cancelled','order_failed_delivery','order_refunded',
             'new_restaurant','high_cancellation','failed_order','suspicious_activity',
             'financial_inconsistency','system_error','settlement_due')
  ),
  title       text NOT NULL,
  body        text NOT NULL,
  metadata    jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_read     boolean NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications (user_id, is_read, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_type ON notifications (type, created_at DESC);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS notif_select_own ON notifications;
DROP POLICY IF EXISTS notif_insert_own ON notifications;
DROP POLICY IF EXISTS notif_update_own ON notifications;
DROP POLICY IF EXISTS notif_delete_own ON notifications;
CREATE POLICY notif_select_own ON notifications
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY notif_insert_own ON notifications
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY notif_update_own ON notifications
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY notif_delete_own ON notifications
  FOR DELETE TO authenticated USING (user_id = auth.uid());

-- ---------- 3. RPC: notify_user ----------
CREATE OR REPLACE FUNCTION public.notify_user(
  p_user_id uuid,
  p_type text,
  p_title text,
  p_body text,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_notif_id uuid;
BEGIN
  INSERT INTO notifications (user_id, type, title, body, metadata)
  VALUES (p_user_id, p_type, p_title, p_body, p_metadata)
  RETURNING id INTO v_notif_id;
  RETURN v_notif_id;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.notify_user(uuid, text, text, text, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.notify_user(uuid, text, text, text, jsonb) TO authenticated;

-- ---------- 4. RPC: notify_order_stakeholders ----------
CREATE OR REPLACE FUNCTION public.notify_order_stakeholders(
  p_order_id uuid,
  p_new_status text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_order orders%ROWTYPE;
  v_restaurant restaurants%ROWTYPE;
  v_customer profiles%ROWTYPE;
  v_title text;
  v_body text;
  v_notif_type text;
BEGIN
  SELECT * INTO v_order FROM orders WHERE id = p_order_id;
  IF v_order.id IS NULL THEN RETURN; END IF;

  SELECT * INTO v_restaurant FROM restaurants WHERE id = v_order.restaurant_id;
  SELECT * INTO v_customer FROM profiles WHERE id = v_order.customer_id;

  v_notif_type := 'order_' || p_new_status;
  v_title := CASE p_new_status
    WHEN 'accepted' THEN 'Order accepted'
    WHEN 'preparing' THEN 'Your order is being prepared'
    WHEN 'out_for_delivery' THEN 'Your order is on the way'
    WHEN 'delivered' THEN 'Order delivered'
    WHEN 'cancelled' THEN 'Order cancelled'
    WHEN 'failed_delivery' THEN 'Delivery failed'
    WHEN 'refunded' THEN 'Refund processed'
    ELSE 'Order update'
  END;
  v_body := '#' || substr(p_order_id::text, 1, 8) || ' · ' || v_restaurant.name || ' · ' || p_new_status;

  PERFORM public.notify_user(
    v_order.customer_id, v_notif_type, v_title, v_body,
    jsonb_build_object('order_id', p_order_id, 'status', p_new_status, 'total', v_order.total)
  );

  IF p_new_status = 'cancelled' THEN
    PERFORM public.notify_user(
      v_restaurant.owner_id, 'order_cancelled', 'Order cancelled',
      '#' || substr(p_order_id::text, 1, 8) || ' · ' || COALESCE(v_customer.full_name, v_customer.email),
      jsonb_build_object('order_id', p_order_id, 'status', 'cancelled')
    );
  END IF;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.notify_order_stakeholders(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.notify_order_stakeholders(uuid, text) TO authenticated;

-- ---------- 5. Trigger: auto-notify on order INSERT ----------
CREATE OR REPLACE FUNCTION public.notify_new_order()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_restaurant restaurants%ROWTYPE;
  v_customer profiles%ROWTYPE;
BEGIN
  SELECT * INTO v_restaurant FROM restaurants WHERE id = NEW.restaurant_id;
  SELECT * INTO v_customer FROM profiles WHERE id = NEW.customer_id;

  PERFORM public.notify_user(
    v_restaurant.owner_id,
    'new_order',
    'New order received',
    '#' || substr(NEW.id::text, 1, 8) || ' · ' || COALESCE(v_customer.full_name, v_customer.email) || ' · ' || NEW.total::text || ' DZD',
    jsonb_build_object(
      'order_id', NEW.id,
      'customer_name', COALESCE(v_customer.full_name, v_customer.email),
      'total', NEW.total,
      'delivery_address', NEW.delivery_address,
      'created_at', NEW.created_at
    )
  );

  PERFORM public.notify_user(
    NEW.customer_id,
    'order_accepted',
    'Order confirmed',
    '#' || substr(NEW.id::text, 1, 8) || ' · ' || v_restaurant.name || ' · ' || NEW.total::text || ' DZD',
    jsonb_build_object('order_id', NEW.id, 'status', 'pending', 'total', NEW.total)
  );

  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.notify_new_order() FROM PUBLIC, anon;

DROP TRIGGER IF EXISTS trg_notify_new_order ON orders;
CREATE TRIGGER trg_notify_new_order
  AFTER INSERT ON orders
  FOR EACH ROW EXECUTE FUNCTION public.notify_new_order();

-- ---------- 6. Trigger: auto-notify on order status UPDATE ----------
CREATE OR REPLACE FUNCTION public.notify_order_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    PERFORM public.notify_order_stakeholders(NEW.id, NEW.status::text);
  END IF;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.notify_order_status_change() FROM PUBLIC, anon;

DROP TRIGGER IF EXISTS trg_notify_order_status ON orders;
CREATE TRIGGER trg_notify_order_status
  AFTER UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION public.notify_order_status_change();

-- ---------- 7. Add operational settings ----------
INSERT INTO platform_settings (key, value, description) VALUES
  ('order_rules', '{
    "cancellation_window_minutes": 5,
    "acceptance_timeout_minutes": 10,
    "auto_cancel_after_timeout": true,
    "busy_mode_threshold": 15,
    "auto_busy_mode": true
  }', 'Order lifecycle rules: cancellation window, acceptance timeout, busy mode thresholds')
ON CONFLICT (key) DO NOTHING;

-- ---------- 8. RPC: get_admin_alerts ----------
CREATE OR REPLACE FUNCTION public.get_admin_alerts()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_result jsonb;
BEGIN
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'forbidden: admin only' USING ERRCODE = '42501';
  END IF;

  SELECT jsonb_build_object(
    'failed_orders', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', o.id, 'restaurant_id', o.restaurant_id, 'total', o.total,
        'status', o.status, 'created_at', o.created_at
      ) ORDER BY o.created_at DESC)
      FROM orders o
      WHERE o.status IN ('cancelled', 'failed_delivery')
        AND o.created_at >= now() - interval '24 hours'
    ), '[]'::jsonb),
    'high_cancellation_restaurants', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'restaurant_id', restaurant_id, 'name', name,
        'cancelled', cancelled, 'total', total_orders,
        'rate', CASE WHEN total_orders > 0 THEN round((cancelled::numeric / total_orders * 100), 1) ELSE 0 END
      ) ORDER BY cancelled DESC)
      FROM (
        SELECT r.id AS restaurant_id, r.name,
          count(*) FILTER (WHERE o.status IN ('cancelled','failed_delivery')) AS cancelled,
          count(*) AS total_orders
        FROM restaurants r
        LEFT JOIN orders o ON o.restaurant_id = r.id
          AND o.created_at >= now() - interval '7 days'
        GROUP BY r.id, r.name
        HAVING count(*) FILTER (WHERE o.status IN ('cancelled','failed_delivery')) >= 3
      ) sub
    ), '[]'::jsonb),
    'suspicious_activity', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'user_id', customer_id, 'order_count', order_count, 'window', '1 hour'
      ) ORDER BY order_count DESC)
      FROM (
        SELECT customer_id, count(*) AS order_count
        FROM orders
        WHERE created_at >= now() - interval '1 hour'
        GROUP BY customer_id
        HAVING count(*) >= 5
      ) rapid
    ), '[]'::jsonb),
    'unread_notifications', COALESCE((
      SELECT count(*)::int FROM notifications
      WHERE user_id = auth.uid() AND is_read = false
    ), 0)
  ) INTO v_result;

  RETURN v_result;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.get_admin_alerts() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_admin_alerts() TO authenticated;

-- ---------- 9. RPC: mark_notification_read ----------
CREATE OR REPLACE FUNCTION public.mark_notification_read(p_notification_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  UPDATE notifications SET is_read = true
  WHERE id = p_notification_id AND user_id = auth.uid();
END;
$$;
REVOKE EXECUTE ON FUNCTION public.mark_notification_read(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mark_notification_read(uuid) TO authenticated;

-- ---------- 10. RPC: mark_all_notifications_read ----------
CREATE OR REPLACE FUNCTION public.mark_all_notifications_read()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  UPDATE notifications SET is_read = true
  WHERE user_id = auth.uid() AND is_read = false;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.mark_all_notifications_read() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mark_all_notifications_read() TO authenticated;
