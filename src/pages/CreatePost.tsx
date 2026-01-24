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
import { ImagePlus, Video, MapPin, Loader2, X, Crown } from 'lucide-react';
import { toast } from 'sonner';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import MultiImageUpload from '@/components/posts/MultiImageUpload';
import { compressImage, compressImages } from '@/lib/imageCompression';

const CreatePost = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { isPremium } = useSubscription();
  
  // Single media states (for non-premium or video)
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [mediaPreview, setMediaPreview] = useState('');
  const [mediaType, setMediaType] = useState<'image' | 'video'>('image');
  const [thumbnailBlob, setThumbnailBlob] = useState<Blob | null>(null);
  
  // Multi-image states (premium only)
  const [multiImages, setMultiImages] = useState<File[]>([]);
  const [multiPreviews, setMultiPreviews] = useState<string[]>([]);
  const [selectedMusic, setSelectedMusic] = useState<{ url: string; name: string; duration?: number } | null>(null);
  
  const [caption, setCaption] = useState('');
  const [location, setLocation] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Size limits based on subscription
  const imageSizeLimit = 30 * 1024 * 1024; // 30MB for images (will be compressed before upload)
  const videoSizeLimit = isPremium ? 100 * 1024 * 1024 : 25 * 1024 * 1024;

  // Generate thumbnail from video
  const generateVideoThumbnail = (videoFile: File): Promise<Blob> => {
    return new Promise((resolve, reject) => {
      const video = document.createElement('video');
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      
      video.preload = 'metadata';
      video.muted = true;
      video.playsInline = true;
      
      video.onloadeddata = () => {
        video.currentTime = Math.min(1, video.duration * 0.1);
      };
      
      video.onseeked = () => {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        ctx?.drawImage(video, 0, 0, canvas.width, canvas.height);
        
        canvas.toBlob((blob) => {
          if (blob) {
            resolve(blob);
          } else {
            reject(new Error('Failed to generate thumbnail'));
          }
        }, 'image/jpeg', 0.8);
        
        URL.revokeObjectURL(video.src);
      };
      
      video.onerror = () => {
        reject(new Error('Failed to load video'));
      };
      
      video.src = URL.createObjectURL(videoFile);
    });
  };

  const handleSingleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > imageSizeLimit) {
        toast.error('Image must be less than 30MB');
        return;
      }

      if (!file.type.startsWith('image/')) {
        toast.error('Please select a valid image file');
        return;
      }

      // Show preview immediately
      const reader = new FileReader();
      reader.onloadend = () => {
        setMediaPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
      
      // Compress image for faster loading (max 1920px, 85% quality)
      const compressedFile = await compressImage(file, 1920, 0.85);
      setMediaFile(compressedFile);
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

      try {
        const thumbnail = await generateVideoThumbnail(file);
        setThumbnailBlob(thumbnail);
      } catch (error) {
        console.error('Failed to generate thumbnail:', error);
      }
    }
  };

  const handleMusicUpload = async (file: File): Promise<string | null> => {
    if (!user) return null;
    
    const fileExt = file.name.split('.').pop();
    const fileName = `${user.id}/audio_${Date.now()}.${fileExt}`;
    
    const { error } = await supabase.storage
      .from('posts')
      .upload(fileName, file);
    
    if (error) {
      toast.error('Failed to upload audio');
      return null;
    }
    
    const { data: urlData } = supabase.storage
      .from('posts')
      .getPublicUrl(fileName);
    
    return urlData.publicUrl;
  };

  const clearMedia = () => {
    setMediaFile(null);
    setMediaPreview('');
    setThumbnailBlob(null);
    setMultiImages([]);
    setMultiPreviews([]);
    setSelectedMusic(null);
  };

  const handleSubmit = async () => {
    const hasMedia = isPremium && multiImages.length > 0 
      ? multiImages.length > 0 
      : mediaFile !== null;

    if (!hasMedia) {
      toast.error('Please add an image or video');
      return;
    }

    if (!user) {
      toast.error('Please sign in to post');
      return;
    }

    setIsLoading(true);

    try {
      // Handle multi-image carousel post (premium only)
      if (isPremium && multiImages.length > 0) {
        const uploadedUrls: string[] = [];
        
        // Compress all images before upload for faster loading
        const compressedImages = await compressImages(multiImages, 1920, 0.85);
        
        for (const imageFile of compressedImages) {
          const fileName = `${user.id}/${Date.now()}_${Math.random().toString(36).substr(2, 9)}.jpg`;
          
          const { error: uploadError } = await supabase.storage
            .from('posts')
            .upload(fileName, imageFile);

          if (uploadError) throw uploadError;

          const { data: urlData } = supabase.storage
            .from('posts')
            .getPublicUrl(fileName);

          uploadedUrls.push(urlData.publicUrl);
        }

        const { error } = await supabase.from('posts').insert({
          user_id: user.id,
          image_url: uploadedUrls[0], // First image as main
          image_urls: uploadedUrls,
          caption: caption.trim() || null,
          location: location.trim() || null,
          media_type: 'image',
          background_audio_url: selectedMusic?.url || null,
        });

        if (error) throw error;
      } else {
        // Handle single image/video post
        const fileExt = mediaFile!.name.split('.').pop();
        const fileName = `${user.id}/${Date.now()}.${fileExt}`;
        
        const { error: uploadError } = await supabase.storage
          .from('posts')
          .upload(fileName, mediaFile!);

        if (uploadError) throw uploadError;

        const { data: urlData } = supabase.storage
          .from('posts')
          .getPublicUrl(fileName);

        const mediaUrl = urlData.publicUrl;

        // Upload thumbnail for videos
        let thumbnailUrl = null;
        if (mediaType === 'video' && thumbnailBlob) {
          const thumbFileName = `${user.id}/${Date.now()}_thumb.jpg`;
          const { error: thumbError } = await supabase.storage
            .from('posts')
            .upload(thumbFileName, thumbnailBlob);

          if (!thumbError) {
            const { data: thumbUrlData } = supabase.storage
              .from('posts')
              .getPublicUrl(thumbFileName);
            thumbnailUrl = thumbUrlData.publicUrl;
          }
        }

        const { error } = await supabase.from('posts').insert({
          user_id: user.id,
          image_url: mediaUrl,
          caption: caption.trim() || null,
          location: location.trim() || null,
          media_type: mediaType,
          thumbnail_url: thumbnailUrl,
        });

        if (error) throw error;
      }

      toast.success('Post created successfully!');
      navigate('/');
    } catch (error: any) {
      console.error('Post error:', error);
      toast.error(error.message || 'Failed to create post');
    } finally {
      setIsLoading(false);
    }
  };

  const isMultiImageMode = isPremium && multiImages.length > 0;
  const hasContent = isMultiImageMode || mediaFile !== null;

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
              <Tabs defaultValue={isPremium ? "multi-photo" : "photo"} className="w-full">
                <TabsList className={`grid w-full ${isPremium ? 'grid-cols-3' : 'grid-cols-2'}`}>
                  {isPremium && (
                    <TabsTrigger value="multi-photo" className="flex items-center gap-2">
                      <Crown className="w-4 h-4" />
                      Photos
                    </TabsTrigger>
                  )}
                  <TabsTrigger value="photo" className="flex items-center gap-2">
                    <ImagePlus className="w-4 h-4" />
                    {isPremium ? 'Single' : 'Photo'}
                  </TabsTrigger>
                  <TabsTrigger value="video" className="flex items-center gap-2">
                    <Video className="w-4 h-4" />
                    Video
                  </TabsTrigger>
                </TabsList>

                {/* Multi-Photo Tab - Premium Only */}
                {isPremium && (
                  <TabsContent value="multi-photo" className="mt-4">
                    <MultiImageUpload
                      images={multiImages}
                      onImagesChange={setMultiImages}
                      previews={multiPreviews}
                      onPreviewsChange={setMultiPreviews}
                      selectedMusic={selectedMusic}
                      onMusicChange={setSelectedMusic}
                      onMusicUpload={handleMusicUpload}
                      isPremium={isPremium}
                      maxImages={10}
                      maxImageSize={imageSizeLimit}
                    />
                  </TabsContent>
                )}

                {/* Single Photo Tab */}
                <TabsContent value="photo" className="mt-4">
                  <div className="space-y-2">
                    <Label>Photo (max 30MB)</Label>
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
                          onChange={handleSingleImageChange}
                          className="hidden"
                        />
                      </label>
                    )}
                  </div>
                </TabsContent>

                {/* Video Tab */}
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
                disabled={isLoading || !hasContent}
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
