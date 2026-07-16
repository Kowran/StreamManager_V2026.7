/*
# Fix dispute decision trigger for valid resolution_type

1. Purpose
The seller_support_tickets table has a CHECK constraint limiting
resolution_type to 'replace_account' or 'refund' (or NULL). The original
notify_dispute_decision trigger set resolution_type = NEW.decision, but
NEW.decision can be 'replace', 'favor_seller', or 'cancel_order' which
violates the constraint and causes the insert to fail.

2. Changes
- Replace notify_dispute_decision() to map decisions:
  - 'refund'        -> resolution_type = 'refund'
  - 'replace'       -> resolution_type = 'replace_account'
  - 'favor_seller'  -> resolution_type = NULL (no resolution type needed)
  - 'cancel_order'  -> resolution_type = 'refund' (cancellation implies refund)
- Status is set to 'resolved' (valid per CHECK constraint).
- admin_resolved = true, resolved_at = now().
- Append system message in seller_support_messages as before.

3. Security
No policy changes. The trigger function is SECURITY DEFINER so it can
update tickets and insert messages regardless of caller RLS context
(admins already have access, but this keeps it robust).
*/

CREATE OR REPLACE FUNCTION public.notify_dispute_decision()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  mapped_resolution text;
  decision_label text;
BEGIN
  -- Map admin_dispute_decisions.decision to valid seller_support_tickets.resolution_type
  mapped_resolution := CASE NEW.decision
    WHEN 'refund' THEN 'refund'
    WHEN 'replace' THEN 'replace_account'
    WHEN 'cancel_order' THEN 'refund'
    ELSE NULL
  END;

  decision_label := CASE NEW.decision
    WHEN 'refund' THEN 'reembolso ao cliente'
    WHEN 'replace' THEN 'substituição de produto'
    WHEN 'favor_seller' THEN 'decidido a favor do vendedor'
    WHEN 'cancel_order' THEN 'cancelamento do pedido'
  END;

  UPDATE public.seller_support_tickets
  SET status = 'resolved',
      admin_resolved = true,
      resolved_at = now(),
      resolution_type = mapped_resolution,
      resolution_notes = COALESCE(NULLIF(NEW.notes,''), resolution_notes),
      updated_at = now()
  WHERE id = NEW.ticket_id;

  INSERT INTO public.seller_support_messages (ticket_id, sender_id, sender_type, message, created_at)
  VALUES (
    NEW.ticket_id,
    NEW.admin_id,
    'admin',
    'Disputa resolvida pela administração. Decisão: ' || decision_label ||
      COALESCE('. Notas: ' || NULLIF(NEW.notes,''), ''),
    now()
  );

  RETURN NEW;
END;
$$;
