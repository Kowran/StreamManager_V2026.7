-- The update_ticket_on_message trigger was NOT SECURITY DEFINER, so when a user
-- inserted a message into support_messages, the trigger's UPDATE on support_tickets
-- ran under the user's RLS context. The user's UPDATE policy requires
-- user_id = auth.uid(), which is correct for the user's own ticket — but the
-- trigger also runs an UPDATE that sets updated_at, and any policy mismatch
-- caused the whole INSERT to fail with "Erro ao enviar mensagem".
-- Making the trigger function SECURITY DEFINER lets it bypass RLS safely.

CREATE OR REPLACE FUNCTION public.update_ticket_on_message()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Update the ticket's updated_at timestamp
  UPDATE support_tickets 
  SET updated_at = NEW.created_at
  WHERE id = NEW.ticket_id;
  
  -- If message is from admin and ticket is waiting_user, change to in_progress
  IF EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = NEW.sender_id 
    AND role = 'admin'
  ) THEN
    UPDATE support_tickets 
    SET status = CASE 
      WHEN status = 'waiting_user' THEN 'in_progress'
      WHEN status = 'open' THEN 'in_progress'
      ELSE status
    END
    WHERE id = NEW.ticket_id;
  ELSE
    -- If message is from user and ticket is in_progress, change to waiting_user
    UPDATE support_tickets 
    SET status = CASE 
      WHEN status = 'in_progress' THEN 'waiting_user'
      ELSE status
    END
    WHERE id = NEW.ticket_id;
  END IF;
  
  RETURN NEW;
END;
$function$;

-- Re-grant execute to authenticated (SECURITY DEFINER functions need explicit grants)
REVOKE ALL ON FUNCTION public.update_ticket_on_message() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_ticket_on_message() TO authenticated;
