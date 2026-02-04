-- Add thumbnail_url column to category_videos table
ALTER TABLE public.category_videos 
ADD COLUMN thumbnail_url TEXT NOT NULL DEFAULT '';

-- Remove the default after adding (to make it truly required for new inserts)
ALTER TABLE public.category_videos 
ALTER COLUMN thumbnail_url DROP DEFAULT;