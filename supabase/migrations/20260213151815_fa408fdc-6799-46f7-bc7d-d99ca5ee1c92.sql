
-- Create app_settings table for admin controls
CREATE TABLE public.app_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  value text NOT NULL DEFAULT 'true',
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

-- Everyone can read settings
CREATE POLICY "App settings are viewable by everyone"
ON public.app_settings FOR SELECT
USING (true);

-- Only admins can update settings
CREATE POLICY "Only admins can update app settings"
ON public.app_settings FOR UPDATE
USING (public.has_role(auth.uid(), 'admin'));

-- Only admins can insert settings
CREATE POLICY "Only admins can insert app settings"
ON public.app_settings FOR INSERT
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Insert default settings
INSERT INTO public.app_settings (key, value) VALUES
  ('voice_call_enabled', 'true'),
  ('video_call_enabled', 'true');
