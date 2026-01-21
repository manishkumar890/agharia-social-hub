import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import Header from '@/components/Header';
import MobileNav from '@/components/MobileNav';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ImagePlus, MapPin, Loader2, X } from 'lucide-react';
import { toast } from 'sonner';

const CreatePost = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [imageUrl, setImageUrl] = useState('');
  const [imagePreview, setImagePreview] = useState('');
  const [caption, setCaption] = useState('');
  const [location, setLocation] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Create preview
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
      
      // For now, use a placeholder URL (in production, would upload to storage)
      setImageUrl(`https://picsum.photos/800/800?random=${Date.now()}`);
    }
  };

  const handleUrlChange = (url: string) => {
    setImageUrl(url);
    setImagePreview(url);
  };

  const clearImage = () => {
    setImageUrl('');
    setImagePreview('');
  };

  const handleSubmit = async () => {
    if (!imageUrl) {
      toast.error('Please add an image');
      return;
    }

    if (!user) {
      toast.error('Please sign in to post');
      return;
    }

    setIsLoading(true);

    try {
      const { error } = await supabase.from('posts').insert({
        user_id: user.id,
        image_url: imageUrl,
        caption: caption.trim() || null,
        location: location.trim() || null,
      });

      if (error) throw error;

      toast.success('Post created successfully!');
      navigate('/');
    } catch (error: any) {
      console.error('Post error:', error);
      toast.error(error.message || 'Failed to create post');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main className="pt-[calc(4rem+3.5rem)] pb-20 md:pb-8">
        <div className="max-w-lg mx-auto px-4 py-6">
          <Card className="shadow-elegant">
            <CardHeader>
              <CardTitle className="font-display text-xl">Create New Post</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Image Upload/Preview */}
              <div className="space-y-2">
                <Label>Photo</Label>
                {imagePreview ? (
                  <div className="relative aspect-square rounded-lg overflow-hidden border border-border">
                    <img 
                      src={imagePreview} 
                      alt="Preview" 
                      className="w-full h-full object-cover"
                    />
                    <Button
                      variant="destructive"
                      size="icon"
                      className="absolute top-2 right-2 h-8 w-8"
                      onClick={clearImage}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                ) : (
                  <label className="flex flex-col items-center justify-center aspect-square border-2 border-dashed border-border rounded-lg cursor-pointer hover:bg-muted/50 transition-colors">
                    <ImagePlus className="w-12 h-12 text-muted-foreground mb-2" />
                    <span className="text-sm text-muted-foreground">Click to upload</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleImageChange}
                      className="hidden"
                    />
                  </label>
                )}
              </div>

              {/* Image URL Input */}
              <div className="space-y-2">
                <Label htmlFor="imageUrl">Or paste image URL</Label>
                <Input
                  id="imageUrl"
                  type="url"
                  placeholder="https://example.com/image.jpg"
                  value={imageUrl}
                  onChange={(e) => handleUrlChange(e.target.value)}
                />
              </div>

              {/* Caption */}
              <div className="space-y-2">
                <Label htmlFor="caption">Caption</Label>
                <Textarea
                  id="caption"
                  placeholder="Write a caption..."
                  value={caption}
                  onChange={(e) => setCaption(e.target.value)}
                  rows={3}
                  className="resize-none"
                />
              </div>

              {/* Location */}
              <div className="space-y-2">
                <Label htmlFor="location">Location</Label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="location"
                    placeholder="Add location"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>

              {/* Submit Button */}
              <Button
                className="w-full gradient-maroon text-primary-foreground"
                onClick={handleSubmit}
                disabled={isLoading || !imageUrl}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    Posting...
                  </>
                ) : (
                  'Share Post'
                )}
              </Button>
            </CardContent>
          </Card>
        </div>
      </main>

      <MobileNav />
    </div>
  );
};

export default CreatePost;
