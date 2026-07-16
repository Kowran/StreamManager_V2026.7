-- Backfill commission records for existing orders that don't have them yet
DO $$
DECLARE
  r RECORD;
  v_admin_rate numeric;
  v_seller_rate numeric;
  v_admin_amount_brl numeric;
  v_seller_amount_brl numeric;
  v_admin_amount_usdt numeric;
  v_seller_amount_usdt numeric;
BEGIN
  FOR r IN
    SELECT so.id, so.product_id, so.seller_id, so.total_brl, so.total_usdt, so.status
    FROM store_orders so
    JOIN store_products sp ON so.product_id = sp.id
    WHERE sp.seller_id IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM sales_commissions sc WHERE sc.order_id = so.id
    )
  LOOP
    v_admin_rate := get_seller_commission_rate(r.seller_id);
    v_seller_rate := 100.0 - v_admin_rate;

    IF r.total_brl IS NOT NULL AND r.total_brl > 0 THEN
      v_admin_amount_brl := ROUND((r.total_brl * v_admin_rate / 100)::numeric, 2);
      v_seller_amount_brl := ROUND((r.total_brl * v_seller_rate / 100)::numeric, 2);

      INSERT INTO sales_commissions (
        order_id, seller_id, total_amount,
        admin_commission_rate, seller_commission_rate,
        admin_amount, seller_amount, currency, status
      ) VALUES (
        r.id, r.seller_id, r.total_brl,
        v_admin_rate, v_seller_rate,
        v_admin_amount_brl, v_seller_amount_brl, 'BRL',
        CASE WHEN r.status = 'cancelled' THEN 'cancelled' ELSE 'pending' END
      )
      ON CONFLICT (order_id, currency) DO NOTHING;
    END IF;

    IF r.total_usdt IS NOT NULL AND r.total_usdt > 0 THEN
      v_admin_amount_usdt := ROUND((r.total_usdt * v_admin_rate / 100)::numeric, 2);
      v_seller_amount_usdt := ROUND((r.total_usdt * v_seller_rate / 100)::numeric, 2);

      INSERT INTO sales_commissions (
        order_id, seller_id, total_amount,
        admin_commission_rate, seller_commission_rate,
        admin_amount, seller_amount, currency, status
      ) VALUES (
        r.id, r.seller_id, r.total_usdt,
        v_admin_rate, v_seller_rate,
        v_admin_amount_usdt, v_seller_amount_usdt, 'USDT',
        CASE WHEN r.status = 'cancelled' THEN 'cancelled' ELSE 'pending' END
      )
      ON CONFLICT (order_id, currency) DO NOTHING;
    END IF;
  END LOOP;
END $$;
