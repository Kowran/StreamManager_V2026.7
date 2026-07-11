-- Admin Popup System
CREATE TABLE IF NOT EXISTS admin_popups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  image_url TEXT,
  popup_type TEXT DEFAULT 'info' CHECK (popup_type IN ('info', 'warning', 'success', 'error', 'announcement', 'promotion')),
  position TEXT DEFAULT 'center' CHECK (position IN ('center', 'top', 'bottom', 'top-right', 'top-left', 'bottom-right', 'bottom-left')),
  display_duration INTEGER DEFAULT 0, -- 0 = until closed by user, otherwise seconds
  show_once BOOLEAN DEFAULT false, -- Show only once per user
  start_date TIMESTAMPTZ DEFAULT NOW(),
  end_date TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT true,
  priority INTEGER DEFAULT 0, -- Higher priority shows first
  button_text TEXT,
  button_url TEXT,
  allow_close BOOLEAN DEFAULT true,
  overlay BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  view_count INTEGER DEFAULT 0,
  close_count INTEGER DEFAULT 0
);

-- Track which users have seen popups (for show_once feature)
CREATE TABLE IF NOT EXISTS popup_views (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  popup_id UUID NOT NULL REFERENCES admin_popups(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  viewed_at TIMESTAMPTZ DEFAULT NOW(),
  closed_at TIMESTAMPTZ,
  clicked_button BOOLEAN DEFAULT false,
  UNIQUE(popup_id, user_id)
);

-- Enable RLS
ALTER TABLE admin_popups ENABLE ROW LEVEL SECURITY;
ALTER TABLE popup_views ENABLE ROW LEVEL SECURITY;

-- Admin Popups Policies
CREATE POLICY "admin_select_popups" ON admin_popups
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "admin_insert_popups" ON admin_popups
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "admin_update_popups" ON admin_popups
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "admin_delete_popups" ON admin_popups
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role = 'admin'
    )
  );

-- Popup Views Policies
CREATE POLICY "user_insert_own_popup_views" ON popup_views
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "user_select_own_popup_views" ON popup_views
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "admin_select_all_popup_views" ON popup_views
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role = 'admin'
    )
  );

-- Indexes
CREATE INDEX idx_admin_popups_active ON admin_popups(is_active);
CREATE INDEX idx_admin_popups_dates ON admin_popups(start_date, end_date);
CREATE INDEX idx_popup_views_user_id ON popup_views(user_id);
CREATE INDEX idx_popup_views_popup_id ON popup_views(popup_id);

-- Trigger to update timestamps
CREATE OR REPLACE FUNCTION update_popup_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER admin_popups_updated_at
  BEFORE UPDATE ON admin_popups
  FOR EACH ROW
  EXECUTE FUNCTION update_popup_updated_at();