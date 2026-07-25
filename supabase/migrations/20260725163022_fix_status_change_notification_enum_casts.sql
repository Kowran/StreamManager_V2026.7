-- Fix: notify_support_status_change passes uncast string literals ('support',
-- 'high', 'medium') to create_notification(). PostgreSQL resolves the CASE
-- expression as type "unknown", which doesn't match the function's enum
-- parameters (notification_type, notification_priority), causing:
-- "function create_notification(uuid, unknown, text, text, jsonb, text,
-- timestamp with time zone) does not exist"
-- Add explicit :: casts so the enum types resolve correctly.

CREATE OR REPLACE FUNCTION public.notify_support_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  user_language text;
  notification_title text;
  notification_message text;
  status_label text;
BEGIN
  -- Only notify on status changes
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    -- Get user language
    SELECT language INTO user_language
    FROM profiles
    WHERE id = NEW.user_id;

    user_language := COALESCE(user_language, 'pt');

    -- Get status label
    CASE NEW.status
      WHEN 'in_progress' THEN status_label := get_notification_text('status_in_progress', user_language);
      WHEN 'waiting_user' THEN status_label := get_notification_text('status_waiting_user', user_language);
      WHEN 'resolved' THEN status_label := get_notification_text('status_resolved', user_language);
      WHEN 'closed' THEN status_label := get_notification_text('status_closed', user_language);
      ELSE status_label := NEW.status;
    END CASE;

    notification_title := '🎫 ' || get_notification_text('ticket_status_updated', user_language);
    notification_message := format(
      get_notification_text('ticket_status_msg', user_language),
      NEW.ticket_number,
      status_label
    );

    PERFORM create_notification(
      NEW.user_id,
      'support'::notification_type,
      notification_title,
      notification_message,
      jsonb_build_object(
        'ticket_id', NEW.id,
        'ticket_number', NEW.ticket_number,
        'old_status', OLD.status,
        'new_status', NEW.status,
        'status_label', status_label
      ),
      CASE NEW.status
        WHEN 'resolved' THEN 'high'::notification_priority
        WHEN 'closed' THEN 'medium'::notification_priority
        ELSE 'medium'::notification_priority
      END,
      now() + interval '7 days'
    );
  END IF;

  RETURN NEW;
END;
$function$;
