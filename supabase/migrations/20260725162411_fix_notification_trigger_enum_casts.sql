-- Fix: The notify_support_ticket_update trigger calls create_notification() with
-- string literals 'support' and 'high' that PostgreSQL cannot implicitly cast to
-- the enum types notification_type and notification_priority when invoked from
-- a trigger context. This caused "function create_notification(uuid, unknown, text,
-- text, jsonb, text, timestamp with time zone) does not exist" errors whenever a
-- support message was inserted, breaking the entire message-sending flow.
-- The fix adds explicit :: casts on the enum literals.

CREATE OR REPLACE FUNCTION public.notify_support_ticket_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  ticket_data record;
  user_language text;
  notification_title text;
  notification_message text;
BEGIN
  -- Get ticket details
  SELECT 
    ticket_number,
    subject,
    status,
    user_id
  INTO ticket_data
  FROM support_tickets
  WHERE id = NEW.ticket_id;

  -- Only notify user when admin responds (not when user sends message)
  IF NEW.sender_id != ticket_data.user_id THEN
    -- Check if sender is admin
    IF EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = NEW.sender_id 
      AND role = 'admin'
    ) THEN
      -- Get user language
      SELECT language INTO user_language
      FROM profiles
      WHERE id = ticket_data.user_id;

      user_language := COALESCE(user_language, 'pt');

      notification_title := '💬 ' || get_notification_text('new_support_response', user_language);
      notification_message := format(
        get_notification_text('new_response_msg', user_language),
        ticket_data.ticket_number,
        ticket_data.subject
      );

      PERFORM create_notification(
        ticket_data.user_id,
        'support'::notification_type,
        notification_title,
        notification_message,
        jsonb_build_object(
          'ticket_id', NEW.ticket_id,
          'ticket_number', ticket_data.ticket_number,
          'message_id', NEW.id,
          'sender_role', 'admin'
        ),
        'high'::notification_priority,
        now() + interval '7 days'
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;
