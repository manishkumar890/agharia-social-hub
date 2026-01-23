-- Add media columns to messages table
ALTER TABLE public.messages ADD COLUMN media_url text;
ALTER TABLE public.messages ADD COLUMN media_type text;