import { useState, useRef } from 'react';
import { X, Upload, Loader2, Crown, Image, Video } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useSubscription } from '@/contexts/SubscriptionContext';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';

interface StoryUploadProps {
  onClose: () => void;
  onSuccess: () => void;
}

const StoryUpload = ({ onClose, onSuccess }: StoryUploadProps) => {
  const { user } = useAuth();
  const { isPremium } = useSubscription();
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [mediaPreview, setMediaPreview] = useState<string | null>(null);
  const [mediaType, setMediaType] = useState<'image' | 'video'>('image');
  const [isUploading, setIsUploading] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  // Limits based on subscription
  const maxImageSize = 5 * 1024 * 1024; // 5MB for images
  const maxVideoSize = isPremium ? 50 * 1024 * 1024 : 25 * 1024 * 1024; // 50MB premium, 25MB free
  const maxDuration = isPremium ? 60 : 30; // 60s premium, 30s free
  const expiryHours = isPremium ? 48 : 24;

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file');
      return;
    }

    if (file.size > maxImageSize) {
      toast.error('Image must be less than 5MB');
      return;
    }

    setMediaFile(file);
    setMediaType('image');
    const reader = new FileReader();
    reader.onloadend = () => {
      setMediaPreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleVideoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('video/')) {
      toast.error('Please select a video file');
      return;
    }

    if (file.size > maxVideoSize) {
      toast.error(`Video must be less than ${isPremium ? '50' : '25'}MB`);
      return;
    }

    // Check video duration
    const video = document.createElement('video');
    video.preload = 'metadata';
    
    const checkDuration = new Promise<boolean>((resolve) => {
      video.onloadedmetadata = () => {
        URL.revokeObjectURL(video.src);
        if (video.duration > maxDuration) {
          toast.error(`Video must be ${maxDuration} seconds or less`);
          resolve(false);
        } else {
          resolve(true);
        }
      };
      video.onerror = () => {
        toast.error('Error loading video');
        resolve(false);
      };
    });

    video.src = URL.createObjectURL(file);
    const isValid = await checkDuration;

    if (!isValid) return;

    setMediaFile(file);
    setMediaType('video');
    setMediaPreview(URL.createObjectURL(file));
  };

  const clearMedia = () => {
    setMediaFile(null);
    setMediaPreview(null);
  };

  const handleUpload = async () => {
    if (!mediaFile || !user) return;

    setIsUploading(true);

    try {
      // Upload to storage
      const fileExt = mediaFile.name.split('.').pop();
      const fileName = `${user.id}/${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('stories')
        .upload(fileName, mediaFile);

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('stories')
        .getPublicUrl(fileName);

      // Calculate expiry time
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + expiryHours);

      // Create story record
      const { error: insertError } = await supabase
        .from('stories')
        .insert({
          user_id: user.id,
          media_url: publicUrl,
          media_type: mediaType,
          duration: maxDuration,
          expires_at: expiresAt.toISOString()
        });

      if (insertError) throw insertError;

      toast.success('Story uploaded!');
      onSuccess();
    } catch (error) {
      console.error('Error uploading story:', error);
      toast.error('Failed to upload story');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center p-4">
      <div className="bg-card rounded-lg max-w-md w-full overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h2 className="font-semibold">Add Story</h2>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="w-5 h-5" />
          </Button>
        </div>

        {/* Content */}
        <div className="p-4">
          {!mediaPreview ? (
            <Tabs defaultValue="image" className="w-full">
              <TabsList className="grid w-full grid-cols-2 mb-4">
                <TabsTrigger value="image" className="flex items-center gap-2">
                  <Image className="w-4 h-4" />
                  Photo
                </TabsTrigger>
                <TabsTrigger value="video" className="flex items-center gap-2">
                  <Video className="w-4 h-4" />
                  Video
                </TabsTrigger>
              </TabsList>

              <TabsContent value="image">
                <label className="flex flex-col items-center justify-center w-full h-48 border-2 border-dashed border-muted-foreground/30 rounded-lg cursor-pointer hover:bg-muted/50 transition-colors">
                  <Upload className="w-10 h-10 text-muted-foreground mb-2" />
                  <span className="text-sm text-muted-foreground">Click to upload image</span>
                  <span className="text-xs text-muted-foreground mt-1">Max 5MB</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageChange}
                    className="hidden"
                  />
                </label>
              </TabsContent>

              <TabsContent value="video">
                <label className="flex flex-col items-center justify-center w-full h-48 border-2 border-dashed border-muted-foreground/30 rounded-lg cursor-pointer hover:bg-muted/50 transition-colors">
                  <Video className="w-10 h-10 text-muted-foreground mb-2" />
                  <span className="text-sm text-muted-foreground">Click to upload video</span>
                  <span className="text-xs text-muted-foreground mt-1">
                    Max {isPremium ? '50' : '25'}MB, {maxDuration}s
                  </span>
                  <input
                    type="file"
                    accept="video/*"
                    onChange={handleVideoChange}
                    className="hidden"
                  />
                </label>
              </TabsContent>
            </Tabs>
          ) : (
            <div className="relative">
              {mediaType === 'image' ? (
                <img
                  src={mediaPreview}
                  alt="Story preview"
                  className="w-full h-64 object-cover rounded-lg"
                />
              ) : (
                <video
                  ref={videoRef}
                  src={mediaPreview}
                  className="w-full h-64 object-cover rounded-lg"
                  controls
                  muted
                />
              )}
              <Button
                variant="secondary"
                size="sm"
                onClick={clearMedia}
                className="absolute top-2 right-2"
              >
                Change
              </Button>
            </div>
          )}

          {/* Story info */}
          <div className="mt-4 p-3 bg-muted rounded-lg">
            <div className="flex items-center gap-2 text-sm">
              {isPremium && <Crown className="w-4 h-4 text-primary" />}
              <span className="text-muted-foreground">
                Duration: <span className="text-foreground font-medium">{maxDuration}s</span>
              </span>
            </div>
            <div className="flex items-center gap-2 text-sm mt-1">
              <span className="text-muted-foreground">
                Expires in: <span className="text-foreground font-medium">{expiryHours} hours</span>
              </span>
            </div>
            <div className="flex items-center gap-2 text-sm mt-1">
              <span className="text-muted-foreground">
                Video limit: <span className="text-foreground font-medium">{isPremium ? '50' : '25'}MB</span>
              </span>
            </div>
            {!isPremium && (
              <p className="text-xs text-muted-foreground mt-2">
                Upgrade to Premium for 60s stories, 48h visibility & 50MB videos!
              </p>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-border">
          <Button
            onClick={handleUpload}
            disabled={!mediaFile || isUploading}
            className="w-full"
          >
            {isUploading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Uploading...
              </>
            ) : (
              'Share Story'
            )}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default StoryUpload;
