-- Add media_type column to stories table
ALTER TABLE public.stories ADD COLUMN IF NOT EXISTS media_type text NOT NULL DEFAULT 'image';

-- Create story_likes table
CREATE TABLE public.story_likes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  story_id UUID NOT NULL REFERENCES public.stories(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(story_id, user_id)
);

-- Enable RLS on story_likes
ALTER TABLE public.story_likes ENABLE ROW LEVEL SECURITY;

-- RLS policies for story_likes
CREATE POLICY "Story likes are viewable by everyone"
ON public.story_likes
FOR SELECT
USING (true);

CREATE POLICY "Users can like stories"
ON public.story_likes
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can unlike stories"
ON public.story_likes
FOR DELETE
USING (auth.uid() = user_id);

-- Create story_comments table
CREATE TABLE public.story_comments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  story_id UUID NOT NULL REFERENCES public.stories(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on story_comments
ALTER TABLE public.story_comments ENABLE ROW LEVEL SECURITY;

-- RLS policies for story_comments
CREATE POLICY "Story comments are viewable by everyone"
ON public.story_comments
FOR SELECT
USING (true);

CREATE POLICY "Users can create comments"
ON public.story_comments
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own comments"
ON public.story_comments
FOR DELETE
USING (auth.uid() = user_id);

-- Enable realtime for story_views, story_likes, story_comments
ALTER PUBLICATION supabase_realtime ADD TABLE public.story_views;
ALTER PUBLICATION supabase_realtime ADD TABLE public.story_likes;
ALTER PUBLICATION supabase_realtime ADD TABLE public.story_comments;