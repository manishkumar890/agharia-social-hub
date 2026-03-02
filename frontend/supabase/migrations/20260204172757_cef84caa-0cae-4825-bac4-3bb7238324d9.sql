-- Create table for storing multiple videos per category
CREATE TABLE public.category_videos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  category_id TEXT NOT NULL,
  video_url TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.category_videos ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Category videos are viewable by everyone"
ON public.category_videos
FOR SELECT
USING (true);

CREATE POLICY "Only admins can insert category videos"
ON public.category_videos
FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Only admins can update category videos"
ON public.category_videos
FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Only admins can delete category videos"
ON public.category_videos
FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));