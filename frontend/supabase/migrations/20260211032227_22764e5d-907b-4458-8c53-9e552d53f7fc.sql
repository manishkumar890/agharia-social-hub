
-- Create contact_queries table for premium user support
CREATE TABLE public.contact_queries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  full_name TEXT,
  username TEXT,
  email TEXT,
  phone TEXT,
  query TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.contact_queries ENABLE ROW LEVEL SECURITY;

-- Users can insert their own queries
CREATE POLICY "Users can submit their own queries"
ON public.contact_queries
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Users can view their own queries
CREATE POLICY "Users can view their own queries"
ON public.contact_queries
FOR SELECT
USING (auth.uid() = user_id);

-- Admins can view all queries
CREATE POLICY "Admins can view all queries"
ON public.contact_queries
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

-- Admins can update query status
CREATE POLICY "Admins can update queries"
ON public.contact_queries
FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role));

-- Admins can delete queries
CREATE POLICY "Admins can delete queries"
ON public.contact_queries
FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));
