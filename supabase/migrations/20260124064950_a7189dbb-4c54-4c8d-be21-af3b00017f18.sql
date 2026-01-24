-- Add background_audio_url column to stories table for image stories with music
ALTER TABLE public.stories ADD COLUMN IF NOT EXISTS background_audio_url text;