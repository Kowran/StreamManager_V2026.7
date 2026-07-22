/*
# Allow anonymous users to read product ratings

## Purpose
Disconnected (not logged-in) users browsing the store cannot see product
ratings on product cards because the `product_ratings` SELECT policy
"Anyone can read product ratings" is scoped to `TO authenticated` only.
The store queries `product_ratings` with the anon-key client, so every
rating lookup returns zero rows for anonymous visitors.

## Changes
- Drops the existing "Anyone can read product ratings" policy and recreates
  it with `TO anon, authenticated` so public rating data is visible to all
  visitors, signed-in or not.

## Security
- SELECT only — no writes granted to anon.
- Product ratings are public display data (rating value, comment, product_id,
  user_id). The existing authenticated write/delete policies are unchanged.
*/

DROP POLICY IF EXISTS "Anyone can read product ratings" ON product_ratings;
CREATE POLICY "Anyone can read product ratings"
  ON product_ratings FOR SELECT
  TO anon, authenticated
  USING (true);
