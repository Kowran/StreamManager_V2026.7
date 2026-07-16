-- Create commission records immediately when an order is placed (AFTER INSERT)
-- so sellers see profit and fee right away, not just when order completes.

CREATE OR REPLACE FUNCTION public.create_sales_commission_on_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_seller_id uuid;
  v_admin_rate numeric;
  v_seller_rate numeric;
  v_admin_amount_brl numeric;
  v_seller_amount_brl numeric;
  v_admin_amount_usdt numeric;
  v_seller_amount_usdt numeric;
BEGIN
  -- Only for seller products (not admin products)
  SELECT seller_id INTO v_seller_id
  FROM store_products
  WHERE id = NEW.product_id;

  IF v_seller_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Get level-based rate for this seller
  v_admin_rate := get_seller_commission_rate(v_seller_id);
  v_seller_rate := 100.0 - v_admin_rate;

  -- Insert BRL commission if applicable
  IF NEW.total_brl IS NOT NULL AND NEW.total_brl > 0 THEN
    v_admin_amount_brl := ROUND((NEW.total_brl * v_admin_rate / 100)::numeric, 2);
    v_seller_amount_brl := ROUND((NEW.total_brl * v_seller_rate / 100)::numeric, 2);

    INSERT INTO sales_commissions (
      order_id, seller_id, total_amount,
      admin_commission_rate, seller_commission_rate,
      admin_amount, seller_amount, currency, status
    ) VALUES (
      NEW.id, v_seller_id, NEW.total_brl,
      v_admin_rate, v_seller_rate,
      v_admin_amount_brl, v_seller_amount_brl, 'BRL', 'pending'
    )
    ON CONFLICT (order_id, currency) DO NOTHING;
  END IF;

  -- Insert USDT commission if applicable
  IF NEW.total_usdt IS NOT NULL AND NEW.total_usdt > 0 THEN
    v_admin_amount_usdt := ROUND((NEW.total_usdt * v_admin_rate / 100)::numeric, 2);
    v_seller_amount_usdt := ROUND((NEW.total_usdt * v_seller_rate / 100)::numeric, 2);

    INSERT INTO sales_commissions (
      order_id, seller_id, total_amount,
      admin_commission_rate, seller_commission_rate,
      admin_amount, seller_amount, currency, status
    ) VALUES (
      NEW.id, v_seller_id, NEW.total_usdt,
      v_admin_rate, v_seller_rate,
      v_admin_amount_usdt, v_seller_amount_usdt, 'USDT', 'pending'
    )
    ON CONFLICT (order_id, currency) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$function$;

-- Create the AFTER INSERT trigger
DROP TRIGGER IF EXISTS trigger_create_commission_on_purchase ON store_orders;
CREATE TRIGGER trigger_create_commission_on_purchase
  AFTER INSERT ON public.store_orders
  FOR EACH ROW EXECUTE FUNCTION create_sales_commission_on_insert();

-- Update the existing AFTER UPDATE trigger function to skip if commissions already exist
-- (the ON CONFLICT DO NOTHING in both functions handles this, but we also guard the level update)
CREATE OR REPLACE FUNCTION public.calculate_sales_commission()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_seller_id uuid;
  v_admin_rate numeric;
  v_seller_rate numeric;
  v_admin_amount_brl numeric;
  v_seller_amount_brl numeric;
  v_admin_amount_usdt numeric;
  v_seller_amount_usdt numeric;
BEGIN
  IF NEW.status = 'completed' AND OLD.status != 'completed' THEN
    SELECT seller_id INTO v_seller_id
    FROM store_products
    WHERE id = NEW.product_id;

    IF v_seller_id IS NOT NULL THEN
      v_admin_rate := get_seller_commission_rate(v_seller_id);
      v_seller_rate := 100.0 - v_admin_rate;

      IF NEW.total_brl IS NOT NULL AND NEW.total_brl > 0 THEN
        v_admin_amount_brl := ROUND((NEW.total_brl * v_admin_rate / 100)::numeric, 2);
        v_seller_amount_brl := ROUND((NEW.total_brl * v_seller_rate / 100)::numeric, 2);

        INSERT INTO sales_commissions (
          order_id, seller_id, total_amount,
          admin_commission_rate, seller_commission_rate,
          admin_amount, seller_amount, currency, status
        ) VALUES (
          NEW.id, v_seller_id, NEW.total_brl,
          v_admin_rate, v_seller_rate,
          v_admin_amount_brl, v_seller_amount_brl, 'BRL', 'pending'
        )
        ON CONFLICT (order_id, currency) DO NOTHING;
      END IF;

      IF NEW.total_usdt IS NOT NULL AND NEW.total_usdt > 0 THEN
        v_admin_amount_usdt := ROUND((NEW.total_usdt * v_admin_rate / 100)::numeric, 2);
        v_seller_amount_usdt := ROUND((NEW.total_usdt * v_seller_rate / 100)::numeric, 2);

        INSERT INTO sales_commissions (
          order_id, seller_id, total_amount,
          admin_commission_rate, seller_commission_rate,
          admin_amount, seller_amount, currency, status
        ) VALUES (
          NEW.id, v_seller_id, NEW.total_usdt,
          v_admin_rate, v_seller_rate,
          v_admin_amount_usdt, v_seller_amount_usdt, 'USDT', 'pending'
        )
        ON CONFLICT (order_id, currency) DO NOTHING;
      END IF;

      -- Update seller level after completed sale
      PERFORM update_seller_level(v_seller_id);
    END IF;
  END IF;

  IF NEW.status = 'cancelled' AND OLD.status != 'cancelled' THEN
    UPDATE sales_commissions
    SET status = 'cancelled', updated_at = now()
    WHERE order_id = NEW.id AND status = 'pending';
  END IF;

  RETURN NEW;
END;
$function$;
