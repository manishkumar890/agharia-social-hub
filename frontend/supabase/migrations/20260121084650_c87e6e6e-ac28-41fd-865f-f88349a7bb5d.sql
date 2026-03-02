-- Create OTP verification table
CREATE TABLE public.phone_otps (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    phone TEXT NOT NULL,
    otp_code TEXT NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    verified BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.phone_otps ENABLE ROW LEVEL SECURITY;

-- Allow inserts from edge functions (service role) - no public access needed
-- OTPs should only be managed via edge functions

-- Create index for faster lookups
CREATE INDEX idx_phone_otps_phone ON public.phone_otps(phone);
CREATE INDEX idx_phone_otps_expires ON public.phone_otps(expires_at);

-- Function to clean up expired OTPs (can be run periodically)
CREATE OR REPLACE FUNCTION public.cleanup_expired_otps()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
    DELETE FROM public.phone_otps WHERE expires_at < now();
$$;