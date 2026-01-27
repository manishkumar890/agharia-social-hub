-- Create category_settings table for storing category video links and banner images
CREATE TABLE public.category_settings (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    category_id TEXT NOT NULL UNIQUE,
    video_url TEXT,
    banner_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.category_settings ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Category settings are viewable by everyone" 
ON public.category_settings 
FOR SELECT 
USING (true);

CREATE POLICY "Only admins can insert category settings" 
ON public.category_settings 
FOR INSERT 
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Only admins can update category settings" 
ON public.category_settings 
FOR UPDATE 
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Only admins can delete category settings" 
ON public.category_settings 
FOR DELETE 
USING (has_role(auth.uid(), 'admin'::app_role));

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_category_settings_updated_at
BEFORE UPDATE ON public.category_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create storage bucket for category banners
INSERT INTO storage.buckets (id, name, public) VALUES ('category-banners', 'category-banners', true);

-- Create storage policies for category banners
CREATE POLICY "Category banners are publicly accessible" 
ON storage.objects 
FOR SELECT 
USING (bucket_id = 'category-banners');

CREATE POLICY "Admins can upload category banners" 
ON storage.objects 
FOR INSERT 
WITH CHECK (bucket_id = 'category-banners' AND has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update category banners" 
ON storage.objects 
FOR UPDATE 
USING (bucket_id = 'category-banners' AND has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete category banners" 
ON storage.objects 
FOR DELETE 
USING (bucket_id = 'category-banners' AND has_role(auth.uid(), 'admin'::app_role));