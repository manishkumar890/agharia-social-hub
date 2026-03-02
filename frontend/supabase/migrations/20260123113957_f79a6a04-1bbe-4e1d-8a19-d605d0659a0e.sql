-- Drop the existing policy that references stories table with expiry check
DROP POLICY IF EXISTS "Story views are viewable by story owner" ON public.story_views;

-- Create a new policy that allows story owners to view all their story views
-- without being blocked by the stories table RLS expiry check
CREATE POLICY "Story views are viewable by story owner"
ON public.story_views
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.stories s
    WHERE s.id = story_views.story_id 
    AND s.user_id = auth.uid()
  )
);

-- Also allow viewers to see their own view records
CREATE POLICY "Users can view their own story views"
ON public.story_views
FOR SELECT
USING (viewer_id = auth.uid());