-- Add date of birth field to profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS dob DATE;

-- Add a unique register number for VIP card
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS register_no TEXT UNIQUE;

-- Create a function to generate register numbers
CREATE OR REPLACE FUNCTION generate_register_no()
RETURNS TRIGGER AS $$
BEGIN
  NEW.register_no := 'AS' || TO_CHAR(NOW(), 'YYYY') || LPAD(CAST(FLOOR(RANDOM() * 100000) AS TEXT), 5, '0');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create trigger to auto-generate register_no on profile creation
DROP TRIGGER IF EXISTS set_register_no ON public.profiles;
CREATE TRIGGER set_register_no
BEFORE INSERT ON public.profiles
FOR EACH ROW
WHEN (NEW.register_no IS NULL)
EXECUTE FUNCTION generate_register_no();

-- Update existing profiles with register numbers
UPDATE public.profiles 
SET register_no = 'AS' || TO_CHAR(created_at, 'YYYY') || LPAD(CAST(FLOOR(RANDOM() * 100000) AS TEXT), 5, '0')
WHERE register_no IS NULL;