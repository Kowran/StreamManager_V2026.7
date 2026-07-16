-- Create user_ratings table for seller-to-customer and customer-to-seller ratings
CREATE TABLE IF NOT EXISTS public.user_ratings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rater_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  rated_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  order_id uuid REFERENCES public.store_orders(id) ON DELETE SET NULL,
  rating integer NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment text,
  rater_role text NOT NULL CHECK (rater_role IN ('seller', 'customer')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(rater_id, rated_user_id, order_id)
);

CREATE INDEX IF NOT EXISTS idx_user_ratings_rated_user ON public.user_ratings(rated_user_id);
CREATE INDEX IF NOT EXISTS idx_user_ratings_rater ON public.user_ratings(rater_id);
CREATE INDEX IF NOT EXISTS idx_user_ratings_created_at ON public.user_ratings(created_at DESC);

-- Enable RLS
ALTER TABLE public.user_ratings ENABLE ROW LEVEL SECURITY;

-- Anyone can read ratings (they're public reputation)
CREATE POLICY "anyone_can_read_user_ratings"
  ON public.user_ratings FOR SELECT
  TO anon, authenticated
  USING (true);

-- Users can insert ratings only as themselves
CREATE POLICY "users_insert_own_user_ratings"
  ON public.user_ratings FOR INSERT
  TO authenticated
  WITH CHECK (rater_id = auth.uid());

-- Users can update only their own ratings
CREATE POLICY "users_update_own_user_ratings"
  ON public.user_ratings FOR UPDATE
  TO authenticated
  USING (rater_id = auth.uid())
  WITH CHECK (rater_id = auth.uid());

-- Users can delete only their own ratings
CREATE POLICY "users_delete_own_user_ratings"
  ON public.user_ratings FOR DELETE
  TO authenticated
  USING (rater_id = auth.uid());
