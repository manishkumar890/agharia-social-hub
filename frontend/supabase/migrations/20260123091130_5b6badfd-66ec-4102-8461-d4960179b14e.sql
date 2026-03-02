-- Add media_type column to posts table to distinguish between images and videos
ALTER TABLE public.posts ADD COLUMN media_type text NOT NULL DEFAULT 'image';

-- Add check constraint for valid media types
ALTER TABLE public.posts ADD CONSTRAINT valid_media_type CHECK (media_type IN ('image', 'video'));