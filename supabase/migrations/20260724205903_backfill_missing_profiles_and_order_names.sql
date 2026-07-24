/*
# Backfill missing user profiles and update order customer names to nicknames

## Overview
1. Some registered users (auth.users) do not have a corresponding row in `profiles`.
   This can happen when the `handle_new_user` trigger failed or when users were
   created via OAuth before the trigger existed. Every registered user MUST have
   a profile, whether they are a seller or just a customer.

2. Existing orders in `store_orders` have `customer_name` set from the buyer's
   `full_name` (first + last name) instead of their nickname (`profiles.username`).
   This migration updates existing orders to show the buyer's nickname where
   available, falling back to full_name or email only when no nickname exists.

## Changes
1. Backfill: Insert a `profiles` row for every `auth.users` row that doesn't have one,
   using their email and created_at. Role defaults to 'customer'.
2. Backfill: Insert a `user_credits` row (balance 0) for any user still missing one.
3. Update `store_orders.customer_name` to the buyer's `profiles.username` where
   the buyer has a username set, falling back to full_name / email otherwise.

## Security
- No RLS policy changes. No new tables or columns.
- All operations are idempotent and safe to re-run.
*/

-- 1. Backfill missing profiles
INSERT INTO public.profiles (id, email, full_name, role, language, approved, created_at, updated_at)
SELECT au.id, au.email, NULL, 'customer', 'pt', true, au.created_at, NOW()
FROM auth.users au
LEFT JOIN public.profiles p ON p.id = au.id
WHERE p.id IS NULL
ON CONFLICT (id) DO NOTHING;

-- 2. Backfill missing user_credits
INSERT INTO public.user_credits (user_id, balance, total_recharged, total_spent, created_at, updated_at)
SELECT p.id, 0.00, 0.00, 0.00, p.created_at, NOW()
FROM public.profiles p
LEFT JOIN public.user_credits uc ON uc.user_id = p.id
WHERE uc.user_id IS NULL
ON CONFLICT (user_id) DO NOTHING;

-- 3. Update existing orders to use the buyer's nickname as customer_name
--    Only update where the buyer has a username (nickname) set.
UPDATE public.store_orders so
SET customer_name = p.username
FROM public.profiles p
WHERE so.user_id = p.id
  AND p.username IS NOT NULL
  AND p.username <> ''
  AND (so.customer_name IS DISTINCT FROM p.username);
