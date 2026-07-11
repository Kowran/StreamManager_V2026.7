/*
  # Create user activity logs table

  1. New Tables
    - `user_activity_logs`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references auth.users)
      - `action` (text, type of activity)
      - `details` (jsonb, activity details)
      - `created_at` (timestamp)

  2. Security
    - Enable RLS on `user_activity_logs` table
    - Add policy for admins to read all logs
    - Add policy for users to read own logs
    - Add policy for system to insert logs

  3. Indexes
    - Index on user_id for filtering by user
    - Index on action for filtering by action type
    - Index on created_at for chronological queries
*/

-- Create user activity logs table
CREATE TABLE IF NOT EXISTS user_activity_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action text NOT NULL,
  details jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE user_activity_logs ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Admins can read all activity logs"
  ON user_activity_logs
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Users can read own activity logs"
  ON user_activity_logs
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "System can insert activity logs"
  ON user_activity_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_user_activity_logs_user_id ON user_activity_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_user_activity_logs_action ON user_activity_logs(action);
CREATE INDEX IF NOT EXISTS idx_user_activity_logs_created_at ON user_activity_logs(created_at DESC);

-- Create composite index for user activity queries
CREATE INDEX IF NOT EXISTS idx_user_activity_logs_user_action_date 
  ON user_activity_logs(user_id, action, created_at DESC);