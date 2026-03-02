-- Enable full replica identity for messages table to capture DELETE events
ALTER TABLE public.messages REPLICA IDENTITY FULL;