/*
  # Enable Real-time for Notifications
  
  1. Changes
    - Enable replica identity for notifications table
    - This allows real-time subscriptions to receive DELETE events with old values
  
  2. Notes
    - REPLICA IDENTITY FULL allows subscriptions to receive all column values for DELETE events
    - This is necessary for proper real-time updates in the UI
*/

-- Enable replica identity for notifications to support real-time DELETE events
ALTER TABLE notifications REPLICA IDENTITY FULL;
