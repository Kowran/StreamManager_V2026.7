/*
# Discord Notification Queue

## Purpose
When notifications are inserted into the `notifications` table, they should
also be forwarded to the user's Discord DM via the discord-bot edge function.
Currently only "new sale" notifications reach Discord (sent directly from
process-store-purchase). All other notification types (delivery, payment,
support, disputes, withdrawals, ratings, expiring accounts, system, etc.)
are inserted into the notifications table but never forwarded to Discord.

## Changes
1. New Table: `discord_notification_queue`
   - `id` (uuid, primary key)
   - `notification_id` (uuid, FK to notifications.id)
   - `user_id` (uuid, the user who should receive the Discord DM)
   - `event_type` (text, maps to discord-bot event types)
   - `variables` (jsonb, template variables)
   - `status` (text: 'pending' | 'sent' | 'failed' | 'skipped')
   - `attempts` (integer, default 0)
   - `error_message` (text, nullable)
   - `created_at` (timestamptz)
   - `processed_at` (timestamptz, nullable)

2. New Trigger Function: `enqueue_discord_notification()`
   - AFTER INSERT on `notifications`
   - Maps notification type to discord event_type
   - Inserts a pending queue row

3. Security
   - RLS enabled on `discord_notification_queue`
   - No direct access for anon or authenticated (only service role / triggers)
*/

CREATE TABLE IF NOT EXISTS discord_notification_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_id uuid REFERENCES notifications(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  event_type text NOT NULL,
  variables jsonb DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'pending',
  attempts integer NOT NULL DEFAULT 0,
  error_message text,
  created_at timestamptz DEFAULT now(),
  processed_at timestamptz
);

ALTER TABLE discord_notification_queue ENABLE ROW LEVEL SECURITY;

-- No policies: only the service role and DB triggers access this table.

CREATE INDEX IF NOT EXISTS idx_discord_queue_pending ON discord_notification_queue(status, created_at) WHERE status = 'pending';

CREATE OR REPLACE FUNCTION enqueue_discord_notification()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_event_type text;
  v_variables jsonb;
BEGIN
  -- Map notification type to discord event_type
  v_event_type := CASE NEW.type
    WHEN 'delivery' THEN 'order_completed'
    WHEN 'payment' THEN 'sale_completed'
    WHEN 'support' THEN 'support_ticket'
    WHEN 'system' THEN 'system_notification'
    WHEN 'admin' THEN 'system_notification'
    WHEN 'account_expiry' THEN 'expiring_account'
    WHEN 'accounts_access_expiry' THEN 'expiring_account'
    WHEN 'credit_low' THEN 'system_notification'
    ELSE NULL
  END;

  IF v_event_type IS NULL THEN
    RETURN NEW;
  END IF;

  -- Build variables from notification data
  v_variables := COALESCE(NEW.data, '{}'::jsonb) || jsonb_build_object(
    'title', NEW.title,
    'message', NEW.message
  );

  INSERT INTO discord_notification_queue (notification_id, user_id, event_type, variables)
  VALUES (NEW.id, NEW.user_id, v_event_type, v_variables);

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_enqueue_discord_notification ON notifications;
CREATE TRIGGER trigger_enqueue_discord_notification
  AFTER INSERT ON notifications
  FOR EACH ROW
  EXECUTE FUNCTION enqueue_discord_notification();
