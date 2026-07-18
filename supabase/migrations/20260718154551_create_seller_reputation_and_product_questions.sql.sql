/*
# Seller Reputation & Product Q&A System

1. New Tables
- `seller_reputation_votes`: users vote whether a seller is trustworthy
- `product_questions`: customers ask questions on product pages, sellers answer

2. Security (RLS)
- seller_reputation_votes: public read; authenticated CRUD own vote only.
- product_questions: public read; authenticated insert own question; sellers/admins answer.

3. Indexes + trigger to auto-set seller_id + reputation summary function.
*/

CREATE TABLE IF NOT EXISTS public.seller_reputation_votes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  voter_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  is_trustworthy boolean NOT NULL,
  comment text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(seller_id, voter_id)
);

CREATE INDEX IF NOT EXISTS idx_seller_reputation_votes_seller ON public.seller_reputation_votes(seller_id);
CREATE INDEX IF NOT EXISTS idx_seller_reputation_votes_voter ON public.seller_reputation_votes(voter_id);

ALTER TABLE public.seller_reputation_votes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anyone_read_seller_reputation_votes" ON public.seller_reputation_votes;
CREATE POLICY "anyone_read_seller_reputation_votes"
  ON public.seller_reputation_votes FOR SELECT
  TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "users_insert_own_reputation_vote" ON public.seller_reputation_votes;
CREATE POLICY "users_insert_own_reputation_vote"
  ON public.seller_reputation_votes FOR INSERT
  TO authenticated
  WITH CHECK (voter_id = auth.uid());

DROP POLICY IF EXISTS "users_update_own_reputation_vote" ON public.seller_reputation_votes;
CREATE POLICY "users_update_own_reputation_vote"
  ON public.seller_reputation_votes FOR UPDATE
  TO authenticated
  USING (voter_id = auth.uid())
  WITH CHECK (voter_id = auth.uid());

DROP POLICY IF EXISTS "users_delete_own_reputation_vote" ON public.seller_reputation_votes;
CREATE POLICY "users_delete_own_reputation_vote"
  ON public.seller_reputation_votes FOR DELETE
  TO authenticated
  USING (voter_id = auth.uid());

CREATE TABLE IF NOT EXISTS public.product_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.store_products(id) ON DELETE CASCADE,
  seller_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  asker_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  question text NOT NULL,
  answer text,
  answered_at timestamptz,
  answered_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_product_questions_product ON public.product_questions(product_id);
CREATE INDEX IF NOT EXISTS idx_product_questions_seller ON public.product_questions(seller_id);
CREATE INDEX IF NOT EXISTS idx_product_questions_answered ON public.product_questions(answered_at);

ALTER TABLE public.product_questions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anyone_read_product_questions" ON public.product_questions;
CREATE POLICY "anyone_read_product_questions"
  ON public.product_questions FOR SELECT
  TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "users_insert_own_question" ON public.product_questions;
CREATE POLICY "users_insert_own_question"
  ON public.product_questions FOR INSERT
  TO authenticated
  WITH CHECK (asker_id = auth.uid());

DROP POLICY IF EXISTS "answer_product_questions" ON public.product_questions;
CREATE POLICY "answer_product_questions"
  ON public.product_questions FOR UPDATE
  TO authenticated
  USING (
    answered_by IS NULL
    AND (
      EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
      OR seller_id = auth.uid()
    )
  )
  WITH CHECK (
    answered_by = auth.uid()
    AND (
      EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
      OR seller_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "users_delete_own_question" ON public.product_questions;
CREATE POLICY "users_delete_own_question"
  ON public.product_questions FOR DELETE
  TO authenticated
  USING (asker_id = auth.uid());

CREATE OR REPLACE FUNCTION public.set_question_seller_id()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.seller_id IS NULL THEN
    SELECT seller_id INTO NEW.seller_id
    FROM public.store_products
    WHERE id = NEW.product_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_question_seller_id ON public.product_questions;
CREATE TRIGGER trg_set_question_seller_id
  BEFORE INSERT ON public.product_questions
  FOR EACH ROW
  EXECUTE FUNCTION public.set_question_seller_id();

CREATE OR REPLACE FUNCTION public.get_seller_reputation_summary(sid uuid)
RETURNS TABLE (
  total_votes bigint,
  trustworthy_votes bigint,
  not_trustworthy_votes bigint,
  trust_score numeric
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    COUNT(*)::bigint AS total_votes,
    COUNT(*) FILTER (WHERE is_trustworthy = true)::bigint AS trustworthy_votes,
    COUNT(*) FILTER (WHERE is_trustworthy = false)::bigint AS not_trustworthy_votes,
    CASE
      WHEN COUNT(*) = 0 THEN 0
      ELSE ROUND(
        (COUNT(*) FILTER (WHERE is_trustworthy = true)::numeric / COUNT(*)::numeric) * 100,
        1
      )
    END AS trust_score
  FROM public.seller_reputation_votes
  WHERE seller_id = $1;
$$;

REVOKE EXECUTE ON FUNCTION public.get_seller_reputation_summary(sid uuid) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_seller_reputation_summary(sid uuid) TO authenticated;
