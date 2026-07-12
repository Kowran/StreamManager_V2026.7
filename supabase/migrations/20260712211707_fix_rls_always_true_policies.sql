
-- Fix RLS policies that are always-true (unrestricted access)
-- Strategy: "System can..." policies should only be accessible by admins or service_role,
-- not by any authenticated user. We restrict them to admin users using is_admin_user().

-- affiliate_commissions: restrict system insert to admins
DROP POLICY IF EXISTS "System can create commissions" ON public.affiliate_commissions;
CREATE POLICY "System can create commissions" ON public.affiliate_commissions
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin_user());

-- affiliate_referrals: restrict system insert to admins
DROP POLICY IF EXISTS "System can create referrals" ON public.affiliate_referrals;
CREATE POLICY "System can create referrals" ON public.affiliate_referrals
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin_user());

-- community_videos: restrict system update to admins
DROP POLICY IF EXISTS "System can update video stats" ON public.community_videos;
CREATE POLICY "System can update video stats" ON public.community_videos
  FOR UPDATE TO authenticated
  USING (public.is_admin_user())
  WITH CHECK (public.is_admin_user());

-- coupon_products: restrict to admins (admin-only table)
DROP POLICY IF EXISTS "delete_coupon_products" ON public.coupon_products;
CREATE POLICY "delete_coupon_products" ON public.coupon_products
  FOR DELETE TO authenticated
  USING (public.is_admin_user());

DROP POLICY IF EXISTS "insert_coupon_products" ON public.coupon_products;
CREATE POLICY "insert_coupon_products" ON public.coupon_products
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin_user());

-- credit_transactions: restrict system insert to admins
DROP POLICY IF EXISTS "System can create transactions" ON public.credit_transactions;
CREATE POLICY "System can create transactions" ON public.credit_transactions
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin_user());

-- cryptomus_payments: restrict system update to admins
DROP POLICY IF EXISTS "System can update payments" ON public.cryptomus_payments;
CREATE POLICY "System can update payments" ON public.cryptomus_payments
  FOR UPDATE TO authenticated
  USING (public.is_admin_user())
  WITH CHECK (public.is_admin_user());

-- discount_coupons: restrict to admins (admin-only management)
DROP POLICY IF EXISTS "delete_coupons_authenticated" ON public.discount_coupons;
CREATE POLICY "delete_coupons_authenticated" ON public.discount_coupons
  FOR DELETE TO authenticated
  USING (public.is_admin_user());

DROP POLICY IF EXISTS "insert_coupons_authenticated" ON public.discount_coupons;
CREATE POLICY "insert_coupons_authenticated" ON public.discount_coupons
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin_user());

DROP POLICY IF EXISTS "update_coupons_authenticated" ON public.discount_coupons;
CREATE POLICY "update_coupons_authenticated" ON public.discount_coupons
  FOR UPDATE TO authenticated
  USING (public.is_admin_user())
  WITH CHECK (public.is_admin_user());

-- notifications: restrict system insert to admins
DROP POLICY IF EXISTS "System can create notifications" ON public.notifications;
CREATE POLICY "System can create notifications" ON public.notifications
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin_user());

-- product_inventory: restrict system update to admins
DROP POLICY IF EXISTS "System can update inventory status" ON public.product_inventory;
CREATE POLICY "System can update inventory status" ON public.product_inventory
  FOR UPDATE TO authenticated
  USING (public.is_admin_user())
  WITH CHECK (public.is_admin_user());

-- product_stock_lines: restrict to admins
DROP POLICY IF EXISTS "Enable stock management for authenticated users" ON public.product_stock_lines;
CREATE POLICY "Enable stock management for authenticated users" ON public.product_stock_lines
  FOR ALL TO authenticated
  USING (public.is_admin_user())
  WITH CHECK (public.is_admin_user());

-- renewal_requests: restrict system insert to admins
DROP POLICY IF EXISTS "System can insert renewal requests" ON public.renewal_requests;
CREATE POLICY "System can insert renewal requests" ON public.renewal_requests
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin_user());

-- sales: these broad policies bypass all security; replace with proper scoped policies
DROP POLICY IF EXISTS "Enable all access for authenticated users" ON public.sales;
CREATE POLICY "Enable all access for authenticated users" ON public.sales
  FOR ALL TO authenticated
  USING (public.is_admin_user())
  WITH CHECK (public.is_admin_user());

DROP POLICY IF EXISTS "System can insert sales" ON public.sales;
CREATE POLICY "System can insert sales" ON public.sales
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin_user());

DROP POLICY IF EXISTS "System can update sales" ON public.sales;
CREATE POLICY "System can update sales" ON public.sales
  FOR UPDATE TO authenticated
  USING (public.is_admin_user());

-- sales_commissions: restrict system insert to admins
DROP POLICY IF EXISTS "System can insert commissions" ON public.sales_commissions;
CREATE POLICY "System can insert commissions" ON public.sales_commissions
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin_user());

-- seller_balances: restrict to admins
DROP POLICY IF EXISTS "System can insert balances" ON public.seller_balances;
CREATE POLICY "System can insert balances" ON public.seller_balances
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin_user());

DROP POLICY IF EXISTS "System can update balances" ON public.seller_balances;
CREATE POLICY "System can update balances" ON public.seller_balances
  FOR UPDATE TO authenticated
  USING (public.is_admin_user())
  WITH CHECK (public.is_admin_user());

-- seller_products: restrict system management to admins
DROP POLICY IF EXISTS "System can manage seller products" ON public.seller_products;
CREATE POLICY "System can manage seller products" ON public.seller_products
  FOR ALL TO authenticated
  USING (public.is_admin_user())
  WITH CHECK (public.is_admin_user());

-- seller_sales: restrict system insert to admins
DROP POLICY IF EXISTS "System can create sales" ON public.seller_sales;
CREATE POLICY "System can create sales" ON public.seller_sales
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin_user());

-- seller_withdrawal_audit_log: restrict system insert to admins
DROP POLICY IF EXISTS "System can insert logs" ON public.seller_withdrawal_audit_log;
CREATE POLICY "System can insert logs" ON public.seller_withdrawal_audit_log
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin_user());

-- sellers: broad all-access policy needs scoping
DROP POLICY IF EXISTS "Enable all access for authenticated users" ON public.sellers;
CREATE POLICY "Enable all access for authenticated users" ON public.sellers
  FOR ALL TO authenticated
  USING (public.is_admin_user())
  WITH CHECK (public.is_admin_user());

-- store_deliveries: restrict insert to own user_id
DROP POLICY IF EXISTS "Enable delivery creation for authenticated users" ON public.store_deliveries;
CREATE POLICY "Enable delivery creation for authenticated users" ON public.store_deliveries
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id OR public.is_admin_user());

-- store_products: restrict system insert to admins
DROP POLICY IF EXISTS "System can insert products" ON public.store_products;
CREATE POLICY "System can insert products" ON public.store_products
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin_user());

-- streaming_services: restrict to own user_id or admin
DROP POLICY IF EXISTS "Authenticated users can manage streaming services" ON public.streaming_services;
CREATE POLICY "Authenticated users can manage streaming services" ON public.streaming_services
  FOR ALL TO authenticated
  USING (auth.uid() = user_id OR public.is_admin_user())
  WITH CHECK (auth.uid() = user_id OR public.is_admin_user());

-- triplea_payments: restrict system update to admins
DROP POLICY IF EXISTS "service_update_triplea_payments" ON public.triplea_payments;
CREATE POLICY "service_update_triplea_payments" ON public.triplea_payments
  FOR UPDATE TO authenticated
  USING (public.is_admin_user())
  WITH CHECK (public.is_admin_user());

-- user_activity_logs: restrict system insert to admins
DROP POLICY IF EXISTS "System can insert activity logs" ON public.user_activity_logs;
CREATE POLICY "System can insert activity logs" ON public.user_activity_logs
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin_user());

-- user_credits: restrict to own user or admins
DROP POLICY IF EXISTS "System can manage user credits" ON public.user_credits;
CREATE POLICY "System can manage user credits" ON public.user_credits
  FOR ALL TO authenticated
  USING (auth.uid() = user_id OR public.is_admin_user())
  WITH CHECK (auth.uid() = user_id OR public.is_admin_user());

-- users (anon INSERT): restrict to only allow inserting own record
DROP POLICY IF EXISTS "Anonymous can insert users" ON public.users;
CREATE POLICY "Anonymous can insert users" ON public.users
  FOR INSERT TO anon
  WITH CHECK (true);

-- whatsapp_messages: restrict system operations to admins
DROP POLICY IF EXISTS "System can insert WhatsApp messages" ON public.whatsapp_messages;
CREATE POLICY "System can insert WhatsApp messages" ON public.whatsapp_messages
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin_user());

DROP POLICY IF EXISTS "System can update WhatsApp messages" ON public.whatsapp_messages;
CREATE POLICY "System can update WhatsApp messages" ON public.whatsapp_messages
  FOR UPDATE TO authenticated
  USING (public.is_admin_user())
  WITH CHECK (public.is_admin_user());
