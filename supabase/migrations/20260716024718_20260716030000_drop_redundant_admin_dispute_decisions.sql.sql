/*
# Remove redundant admin_dispute_decisions table

1. Purpose
The existing admin dispute resolution system uses the `admin_resolve_seller_ticket`
RPC function, which already stores resolution info (resolution_type,
resolution_notes, admin_resolved, resolved_at) directly on
seller_support_tickets and sends notifications to both customer and seller.
The separate admin_dispute_decisions table created earlier is redundant and
should be removed to avoid confusion and duplicate data.

2. Changes
- Drop the trg_notify_dispute_decision trigger.
- Drop the notify_dispute_decision() function.
- Drop the admin_dispute_decisions table (no user data was stored in it
  permanently; any test rows are dispensable).
- Drop the redundant update_seller_support_tickets_admin policy (admins
  already have update access via the existing admin_update_seller_support_tickets
  policy).

3. Security
No remaining security changes. The existing RLS policies on
seller_support_tickets remain intact.
*/

DROP TRIGGER IF EXISTS trg_notify_dispute_decision ON public.admin_dispute_decisions;
DROP FUNCTION IF EXISTS public.notify_dispute_decision();
DROP TABLE IF EXISTS public.admin_dispute_decisions;
DROP POLICY IF EXISTS "update_seller_support_tickets_admin" ON public.seller_support_tickets;
