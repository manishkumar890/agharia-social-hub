-- Add DELETE policy for messages - sender can delete their own messages
CREATE POLICY "Users can delete their own messages"
ON public.messages
FOR DELETE
USING (auth.uid() = sender_id);

-- Add columns to store original post info when sharing
ALTER TABLE public.messages ADD COLUMN shared_post_id uuid;
ALTER TABLE public.messages ADD COLUMN shared_from_user_id uuid;
ALTER TABLE public.messages ADD COLUMN shared_from_username text;
ALTER TABLE public.messages ADD COLUMN shared_from_avatar_url text;