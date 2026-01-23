import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useSubscription } from '@/contexts/SubscriptionContext';
import Header from '@/components/Header';
import MobileNav from '@/components/MobileNav';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ImagePlus, Video, MapPin, Loader2, X } from 'lucide-react';
import { toast } from 'sonner';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

const CreatePost = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { isPremium } = useSubscription();
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [mediaPreview, setMediaPreview] = useState('');
  const [mediaType, setMediaType] = useState<'image' | 'video'>('image');
  const [caption, setCaption] = useState('');
  const [location, setLocation] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Size limits based on subscription
  const imageSizeLimit = 5 * 1024 * 1024; // 5MB for images
  const videoSizeLimit = isPremium ? 100 * 1024 * 1024 : 25 * 1024 * 1024; // 100MB premium, 25MB free

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > imageSizeLimit) {
        toast.error('Image must be less than 5MB');
        return;
      }

      if (!file.type.startsWith('image/')) {
        toast.error('Please select a valid image file');
        return;
      }

      const reader = new FileReader();
      reader.onloadend = () => {
        setMediaPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
      setMediaFile(file);
      setMediaType('image');
    }
  };

  const handleVideoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const maxSize = videoSizeLimit;
      const maxSizeMB = isPremium ? 100 : 25;

      if (file.size > maxSize) {
        toast.error(`Video must be less than ${maxSizeMB}MB${!isPremium ? '. Upgrade to Premium for 100MB limit!' : ''}`);
        return;
      }

      if (!file.type.startsWith('video/')) {
        toast.error('Please select a valid video file');
        return;
      }

      const reader = new FileReader();
      reader.onloadend = () => {
        setMediaPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
      setMediaFile(file);
      setMediaType('video');
    }
  };

  const clearMedia = () => {
    setMediaFile(null);
    setMediaPreview('');
  };

  const handleSubmit = async () => {
    if (!mediaFile) {
      toast.error('Please add an image or video');
      return;
    }

    if (!user) {
      toast.error('Please sign in to post');
      return;
    }

    setIsLoading(true);

    try {
      const fileExt = mediaFile.name.split('.').pop();
      const fileName = `${user.id}/${Date.now()}.${fileExt}`;
      
      const { error: uploadError } = await supabase.storage
        .from('posts')
        .upload(fileName, mediaFile);

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from('posts')
        .getPublicUrl(fileName);

      const mediaUrl = urlData.publicUrl;

      const { error } = await supabase.from('posts').insert({
        user_id: user.id,
        image_url: mediaUrl,
        caption: caption.trim() || null,
        location: location.trim() || null,
        media_type: mediaType,
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
      
      <main className="pt-14 pb-20 md:pb-8">
        <div className="max-w-lg mx-auto px-4 py-6">
          <Card className="shadow-elegant">
            <CardHeader>
              <CardTitle className="font-display text-xl">Create New Post</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Media Upload Tabs */}
              <Tabs defaultValue="image" className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="image" className="flex items-center gap-2">
                    <ImagePlus className="w-4 h-4" />
                    Photo
                  </TabsTrigger>
                  <TabsTrigger value="video" className="flex items-center gap-2">
                    <Video className="w-4 h-4" />
                    Video
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="image" className="mt-4">
                  <div className="space-y-2">
                    <Label>Photo (max 5MB)</Label>
                    {mediaPreview && mediaType === 'image' ? (
                      <div className="relative aspect-square rounded-lg overflow-hidden border border-border">
                        <img 
                          src={mediaPreview} 
                          alt="Preview" 
                          className="w-full h-full object-cover"
                        />
                        <Button
                          variant="destructive"
                          size="icon"
                          className="absolute top-2 right-2 h-8 w-8"
                          onClick={clearMedia}
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    ) : (
                      <label className="flex flex-col items-center justify-center aspect-square border-2 border-dashed border-border rounded-lg cursor-pointer hover:bg-muted/50 transition-colors">
                        <ImagePlus className="w-12 h-12 text-muted-foreground mb-2" />
                        <span className="text-sm text-muted-foreground">Click to upload photo</span>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleImageChange}
                          className="hidden"
                        />
                      </label>
                    )}
                  </div>
                </TabsContent>

                <TabsContent value="video" className="mt-4">
                  <div className="space-y-2">
                    <Label>
                      Video (max {isPremium ? '100MB' : '25MB'})
                      {!isPremium && (
                        <span className="text-xs text-muted-foreground ml-2">
                          Premium: up to 100MB
                        </span>
                      )}
                    </Label>
                    {mediaPreview && mediaType === 'video' ? (
                      <div className="relative aspect-video rounded-lg overflow-hidden border border-border">
                        <video 
                          src={mediaPreview} 
                          className="w-full h-full object-cover"
                          controls
                        />
                        <Button
                          variant="destructive"
                          size="icon"
                          className="absolute top-2 right-2 h-8 w-8"
                          onClick={clearMedia}
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    ) : (
                      <label className="flex flex-col items-center justify-center aspect-video border-2 border-dashed border-border rounded-lg cursor-pointer hover:bg-muted/50 transition-colors">
                        <Video className="w-12 h-12 text-muted-foreground mb-2" />
                        <span className="text-sm text-muted-foreground">Click to upload video</span>
                        <span className="text-xs text-muted-foreground mt-1">
                          Max {isPremium ? '100MB' : '25MB'}
                        </span>
                        <input
                          type="file"
                          accept="video/*"
                          onChange={handleVideoChange}
                          className="hidden"
                        />
                      </label>
                    )}
                  </div>
                </TabsContent>
              </Tabs>

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
                disabled={isLoading || !mediaFile}
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
