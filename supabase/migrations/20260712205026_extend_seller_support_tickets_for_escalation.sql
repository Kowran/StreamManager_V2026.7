/*
# Extend seller_support_tickets for dispute resolution and escalation

## Overview
Adds columns to seller_support_tickets to support:
- Resolution type (replace_account or refund) chosen by the seller
- Escalation to admin when seller doesn't resolve within 24 hours
- Deadline tracking for the 24-hour resolution window
- Escalation reason tracking

## Modified Tables

### seller_support_tickets
- `resolution_type` (text: 'replace_account' or 'refund' or null) — what the seller chose to do
- `escalated` (boolean, default false) — whether the case was escalated to admin
- `escalated_at` (timestamptz) — when escalation happened
- `escalation_reason` (text) — why it was escalated
- `deadline` (timestamptz) — 24h from creation, used to allow escalation
- `admin_resolved` (boolean, default false) — whether admin resolved the escalated case
- `replacement_credentials` (jsonb) — new credentials provided by seller when replacing account

## Security
- No new policies needed; existing RLS policies cover the new columns
- Seller can update escalated tickets (to provide resolution)
- Customer can update to escalate (when deadline passed and not resolved)
*/

ALTER TABLE seller_support_tickets
  ADD COLUMN IF NOT EXISTS resolution_type text CHECK (resolution_type IN ('replace_account', 'refund') OR resolution_type IS NULL),
  ADD COLUMN IF NOT EXISTS escalated boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS escalated_at timestamptz,
  ADD COLUMN IF NOT EXISTS escalation_reason text DEFAULT '',
  ADD COLUMN IF NOT EXISTS deadline timestamptz,
  ADD COLUMN IF NOT EXISTS admin_resolved boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS replacement_credentials jsonb DEFAULT '{}'::jsonb;

-- Set deadline to 24h after creation for existing rows that don't have one
UPDATE seller_support_tickets
SET deadline = created_at + INTERVAL '24 hours'
WHERE deadline IS NULL;
