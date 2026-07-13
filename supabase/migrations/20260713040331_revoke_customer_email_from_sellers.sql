/*
# Revoke column-level SELECT on customer_email from authenticated role

## Overview
Sellers must not be able to query customer_email from store_orders directly.
While the frontend no longer displays it, a savvy seller could still query it
via the Supabase API. This migration revokes column-level SELECT on customer_email
from the authenticated role, then re-grants it only to the table owner and service_role.

## Changes
1. Revoke SELECT on `customer_email` column from `authenticated` role.
2. The `seller_orders_view` already excludes `customer_email`, so sellers get
   their order data through the view without the email column.
3. Admins still have full access via their admin policies (which use the postgres owner).
*/

-- Revoke column-level SELECT on customer_email from authenticated
REVOKE SELECT (customer_email) ON public.store_orders FROM authenticated;
