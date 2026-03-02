-- Add columns for multiple images and background music in posts
ALTER TABLE public.posts 
ADD COLUMN image_urls text[] DEFAULT NULL,
ADD COLUMN background_audio_url text DEFAULT NULL;

-- Add comment for clarity
COMMENT ON COLUMN public.posts.image_urls IS 'Array of image URLs for carousel posts (premium feature)';
COMMENT ON COLUMN public.posts.background_audio_url IS 'Background music URL for photo posts (premium feature)';