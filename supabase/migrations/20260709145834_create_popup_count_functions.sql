-- Create functions for incrementing popup counts
CREATE OR REPLACE FUNCTION increment_popup_view_count(popup_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE admin_popups 
  SET view_count = view_count + 1 
  WHERE id = popup_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION increment_popup_close_count(popup_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE admin_popups 
  SET close_count = close_count + 1 
  WHERE id = popup_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;