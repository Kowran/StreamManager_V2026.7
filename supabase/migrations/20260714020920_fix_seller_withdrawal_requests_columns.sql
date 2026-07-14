/*
# Fix seller withdrawal requests table

## Problem
1. `payment_info_id` column is NOT NULL, but `request_seller_withdrawal()` inserts NULL
   when no payment info is provided — causing the INSERT to fail with a constraint violation.
   This is why sellers see "Erro:" with an empty message (the RPC throws a Postgres error
   that the frontend doesn't display well).
2. `process_withdrawal_approval()` references a `processed_by` column that doesn't exist
   in the table — this would cause admin approval/rejection to fail.

## Changes
1. ALTER `payment_info_id` to be nullable (drop NOT NULL constraint).
2. ADD `processed_by` column (uuid, nullable) for admin who processed the withdrawal.
*/
ALTER TABLE seller_withdrawal_requests ALTER COLUMN payment_info_id DROP NOT NULL;
ALTER TABLE seller_withdrawal_requests ADD COLUMN IF NOT EXISTS processed_by uuid;
