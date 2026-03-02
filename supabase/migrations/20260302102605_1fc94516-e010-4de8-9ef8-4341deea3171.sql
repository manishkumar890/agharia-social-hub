
-- 1. Auto-assign admin role trigger for the bootstrap admin phone
CREATE OR REPLACE FUNCTION public.auto_assign_admin_role()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Auto-assign admin role when profile is created with the admin phone
  IF NEW.phone = '7326937200' THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.user_id, 'admin')
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_auto_assign_admin
AFTER INSERT ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.auto_assign_admin_role();

-- 2. Fix get_user_phone: add authorization check
CREATE OR REPLACE FUNCTION public.get_user_phone(_user_id uuid)
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only allow users to get their own phone or admins
  IF auth.uid() != _user_id AND NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Unauthorized access to phone number';
  END IF;
  RETURN (SELECT phone FROM public.profiles WHERE user_id = _user_id);
END;
$$;

-- 3. Add input validation constraints
ALTER TABLE public.profiles
ADD CONSTRAINT profiles_phone_format
CHECK (phone ~ '^\d{10}$');

ALTER TABLE public.profiles
ADD CONSTRAINT profiles_username_format
CHECK (username IS NULL OR (username ~ '^[a-zA-Z0-9_]{3,30}$'));

ALTER TABLE public.profiles
ADD CONSTRAINT profiles_bio_length
CHECK (bio IS NULL OR LENGTH(bio) <= 500);

ALTER TABLE public.comments
ADD CONSTRAINT comments_content_length
CHECK (LENGTH(content) > 0 AND LENGTH(content) <= 1000);

ALTER TABLE public.posts
ADD CONSTRAINT posts_caption_length
CHECK (caption IS NULL OR LENGTH(caption) <= 2200);
