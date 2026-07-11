/*
  # Fix Notifications Real-time Updates
  
  1. Changes
    - Add DELETE policy for users to delete their own notifications
    - This ensures real-time subscriptions work properly for all operations
  
  2. Security
    - Users can only delete their own notifications
    - Maintains existing RLS restrictions
*/

-- Add DELETE policy for users to delete their own notifications
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'notifications' 
    AND policyname = 'Users can delete own notifications'
  ) THEN
    CREATE POLICY "Users can delete own notifications"
      ON notifications
      FOR DELETE
      TO authenticated
      USING (user_id = auth.uid());
  END IF;
END $$;
