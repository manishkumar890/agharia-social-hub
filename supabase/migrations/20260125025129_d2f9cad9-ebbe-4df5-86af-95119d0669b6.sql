-- Add is_disabled column to profiles table for admin to disable users
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_disabled BOOLEAN NOT NULL DEFAULT false;

-- Add comment for documentation
COMMENT ON COLUMN public.profiles.is_disabled IS 'When true, user cannot access their account';