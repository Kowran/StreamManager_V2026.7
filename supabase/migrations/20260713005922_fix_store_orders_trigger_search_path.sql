/*
# Fix trigger function search_path on store_orders

## Problem
All five trigger functions on `store_orders` had `search_path=""` (empty string),
which prevented PostgreSQL from resolving table references like `store_products`.
This caused the error "relation 'store_products' does not exist" whenever a new
order was inserted, because the BEFORE INSERT trigger `set_order_seller_id()`
queries `store_products` to populate `seller_id`.

## Fix
Set `search_path='public'` on all five trigger functions so unqualified table
references resolve correctly.

## Functions fixed
1. `set_order_seller_id()` — BEFORE INSERT trigger, queries store_products
2. `create_pending_delivery()` — AFTER INSERT trigger
3. `create_manual_delivery_ticket()` — AFTER INSERT OR UPDATE trigger
4. `create_manual_delivery_chat_on_purchase()` — AFTER INSERT OR UPDATE trigger
5. `calculate_sales_commission()` — AFTER UPDATE trigger, queries store_products

## Security
No RLS or policy changes. No schema changes. Only function metadata (search_path) is altered.
*/

ALTER FUNCTION public.set_order_seller_id() SET search_path TO public;
ALTER FUNCTION public.create_pending_delivery() SET search_path TO public;
ALTER FUNCTION public.create_manual_delivery_ticket() SET search_path TO public;
ALTER FUNCTION public.create_manual_delivery_chat_on_purchase() SET search_path TO public;
ALTER FUNCTION public.calculate_sales_commission() SET search_path TO public;
