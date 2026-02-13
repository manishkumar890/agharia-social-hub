
-- Create call_logs table for storing call history
CREATE TABLE public.call_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  caller_id UUID NOT NULL,
  receiver_id UUID NOT NULL,
  call_type TEXT NOT NULL DEFAULT 'voice' CHECK (call_type IN ('voice', 'video')),
  status TEXT NOT NULL DEFAULT 'ringing' CHECK (status IN ('ringing', 'ongoing', 'ended', 'missed', 'declined', 'failed')),
  started_at TIMESTAMP WITH TIME ZONE,
  ended_at TIMESTAMP WITH TIME ZONE,
  duration_seconds INTEGER,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.call_logs ENABLE ROW LEVEL SECURITY;

-- Users can view call logs for their conversations
CREATE POLICY "Users can view their call logs"
ON public.call_logs
FOR SELECT
USING (auth.uid() = caller_id OR auth.uid() = receiver_id);

-- Users can insert call logs (as caller)
CREATE POLICY "Users can create call logs"
ON public.call_logs
FOR INSERT
WITH CHECK (auth.uid() = caller_id);

-- Users can update call logs they're part of
CREATE POLICY "Users can update their call logs"
ON public.call_logs
FOR UPDATE
USING (auth.uid() = caller_id OR auth.uid() = receiver_id);

-- Enable realtime for call_logs
ALTER PUBLICATION supabase_realtime ADD TABLE public.call_logs;
