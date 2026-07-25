-- =========================================================
-- Followers system
-- =========================================================
CREATE TABLE IF NOT EXISTS public.profile_followers (
  follower_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  followed_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (follower_id, followed_id),
  CHECK (follower_id <> followed_id)
);

ALTER TABLE public.profile_followers ENABLE ROW LEVEL SECURITY;

-- Anyone authenticated can see who follows whom (social graph)
CREATE POLICY "select_followers"
  ON public.profile_followers FOR SELECT
  TO authenticated USING (true);

-- A user can only insert their own follow
CREATE POLICY "insert_own_follow"
  ON public.profile_followers FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = follower_id);

-- A user can only delete their own follow
CREATE POLICY "delete_own_follow"
  ON public.profile_followers FOR DELETE
  TO authenticated USING (auth.uid() = follower_id);

CREATE INDEX IF NOT EXISTS idx_profile_followers_followed_id
  ON public.profile_followers(followed_id);
CREATE INDEX IF NOT EXISTS idx_profile_followers_follower_id
  ON public.profile_followers(follower_id);

-- =========================================================
-- Profile reports (denúncias)
-- =========================================================
CREATE TYPE public.profile_report_reason AS ENUM (
  'scam',
  'fake_profile',
  'inappropriate_content',
  'spam',
  'harassment',
  'illegal_goods',
  'other'
);

CREATE TYPE public.profile_report_status AS ENUM (
  'pending',
  'reviewing',
  'resolved',
  'dismissed'
);

CREATE TABLE IF NOT EXISTS public.profile_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  reported_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  reason public.profile_report_reason NOT NULL,
  description TEXT,
  status public.profile_report_status NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ,
  admin_notes TEXT,
  CHECK (reporter_id <> reported_id)
);

ALTER TABLE public.profile_reports ENABLE ROW LEVEL SECURITY;

-- Users can see reports they submitted
CREATE POLICY "select_own_reports"
  ON public.profile_reports FOR SELECT
  TO authenticated USING (auth.uid() = reporter_id);

-- Users can create reports
CREATE POLICY "insert_own_report"
  ON public.profile_reports FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = reporter_id);

-- Users can only delete their own pending reports (cancel a report)
CREATE POLICY "delete_own_report"
  ON public.profile_reports FOR DELETE
  TO authenticated USING (auth.uid() = reporter_id AND status = 'pending');

-- Admins can see all reports
CREATE POLICY "admin_select_all_reports"
  ON public.profile_reports FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

-- Admins can update reports
CREATE POLICY "admin_update_all_reports"
  ON public.profile_reports FOR UPDATE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

CREATE INDEX IF NOT EXISTS idx_profile_reports_reported_id
  ON public.profile_reports(reported_id);
CREATE INDEX IF NOT EXISTS idx_profile_reports_status
  ON public.profile_reports(status);
CREATE INDEX IF NOT EXISTS idx_profile_reports_reporter_id
  ON public.profile_reports(reporter_id);
