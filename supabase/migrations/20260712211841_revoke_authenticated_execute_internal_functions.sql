
-- Revoke EXECUTE from authenticated role on internal/admin-only SECURITY DEFINER functions
-- These functions are invoked by triggers, scheduled jobs, or admin-only contexts,
-- not directly by regular signed-in users via RPC.

-- Admin-only operations
REVOKE EXECUTE ON FUNCTION public.admin_confirm_binance_payment(uuid, text, uuid) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.approve_seller_application(uuid, uuid) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.assign_delivery_to_admin(uuid, uuid, uuid) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.cancel_pending_delivery(uuid, uuid, text) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.debug_user_delivery_issues(text) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.fix_users_without_profiles() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.get_admin_commission_summary(text) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.get_admin_sales_count() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.get_cancellable_sales(integer, integer) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.log_user_deletion_details(uuid, uuid, text) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.process_manual_delivery(uuid, uuid, jsonb, text) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.process_sale_cancellation(uuid, uuid, uuid, text, boolean) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.reject_seller_application(uuid, uuid, text) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.update_store_banners(jsonb) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.validate_admin_deletion_permission(uuid, uuid) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.release_retained_balances() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.sync_smm_services_from_provider(uuid) FROM authenticated;

-- Internal trigger/system functions not meant to be called directly
REVOKE EXECUTE ON FUNCTION public.award_sm_credits_on_credit_purchase() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.calculate_sales_commission() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.cleanup_expired_inventory_reservations() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.cleanup_expired_notifications() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.cleanup_expired_password_reset_tokens() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.cleanup_expired_reservations() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.create_automatic_delivery(uuid, uuid, uuid, jsonb) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.create_manual_delivery_chat() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.create_manual_delivery_chat_on_purchase() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.create_manual_delivery_ticket() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.create_user_purchase_from_delivery() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.deactivate_expired_accounts_access() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.enforce_user_ban() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_admin_user() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_automatic_delivery() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.log_auth_user_deletion() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.log_webhook_processing(text, text, text, text, jsonb) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.log_withdrawal_status_change() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.mark_account_sold(uuid, uuid) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.mark_inventory_sold(uuid, uuid) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_accounts_access_expiry() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_delivery_completed() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_payment_completed() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_streaming_account_expiry() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_support_status_change() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_support_ticket_update() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.process_affiliate_commission() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.process_pending_automatic_deliveries() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.process_withdrawal_payment() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.update_seller_balance_on_commission_paid() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.update_user_sm_credit_balance() FROM authenticated;

-- Re-grant EXECUTE only to authenticated for functions legitimately called by users via RPC
GRANT EXECUTE ON FUNCTION public.apply_coupon(text, uuid, uuid, numeric, numeric, numeric) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_user_rate_product(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_expiring_profiles(integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_pending_payments() TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_user_ban_status(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_user_setup(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.complete_mercadopago_recharge(uuid, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_affiliate_referral(text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_default_notification_preferences() TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_notification(uuid, public.notification_type, text, text, jsonb, public.notification_priority, timestamp with time zone) TO authenticated;
GRANT EXECUTE ON FUNCTION public.generate_seller_ticket_number() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_membership_discount(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_next_available_account(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_product_inventory_status(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_product_rating_stats(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_retained_transactions(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_seller_available_balance(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_seller_balance_summary(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_seller_balance_summary(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_seller_commission_summary(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_seller_sales_count(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_ban_info(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_purchase_expiry_stats(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_accounts_access(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_active_membership(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.increment_chat_unread(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.increment_popup_close_count(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.increment_popup_view_count(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin_user() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_user_approved() TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_all_notifications_read(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_notification_read(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_profiles_notified(uuid[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.process_credit_transaction(uuid, text, numeric, text, uuid, text, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.process_seller_product_purchase(text, integer, uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.process_smm_order(uuid, uuid, text, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.renew_account(uuid, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.renew_profile(uuid, integer, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_product_inventory(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.track_affiliate_click(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.unreserve_product_inventory(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_seller_level(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_user_level(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.validate_coupon(text, uuid, numeric) TO authenticated;
GRANT EXECUTE ON FUNCTION public.validate_password_reset_token(text, text) TO authenticated;
