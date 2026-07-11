/*
  # Enable Realtime for Profiles Table

  1. Changes
    - Enable realtime updates on profiles table
    - This allows the app to listen to profile changes in real-time
    - When a seller is approved, the UI will update immediately

  2. Purpose
    - Fix issue where "Minha Loja" tab doesn't appear after seller approval
    - Users will see role changes reflected immediately without page refresh
*/

-- Enable realtime for profiles table
ALTER PUBLICATION supabase_realtime ADD TABLE profiles;
