import { useState, useRef } from 'react';
import { X, Upload, Loader2, Crown, Image, Video } from 'lucide-react';
import { storiesApi, uploadApi } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { useSubscription } from '@/contexts/SubscriptionContext';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import MusicSelector from './MusicSelector';
import { compressImage } from '@/lib/imageCompression';

interface StoryUploadProps {
  onClose: () => void;
  onSuccess: () => void;
}

const StoryUpload = ({ onClose, onSuccess }: StoryUploadProps) => {
  const { user, profile } = useAuth();
  const { isPremium } = useSubscription();
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [mediaPreview, setMediaPreview] = useState<string | null>(null);
  const [mediaType, setMediaType] = useState<'image' | 'video'>('image');
  const [isUploading, setIsUploading] = useState(false);
  const [selectedMusic, setSelectedMusic] = useState<{ url: string; name: string; duration?: number } | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  const [selectedExpiry, setSelectedExpiry] = useState<24 | 48>(24);

  // Limits based on subscription
  const maxImageSize = 30 * 1024 * 1024; // 30MB for images (will be compressed)
  const maxVideoSize = isPremium ? 50 * 1024 * 1024 : 25 * 1024 * 1024; // 50MB premium, 25MB free
  const maxAudioSize = 5 * 1024 * 1024; // 5MB for background audio
  const maxVideoDuration = isPremium ? 60 : 30; // 60s premium, 30s free
  const maxMusicDuration = isPremium ? 60 : 30; // 60s premium, 30s free for music
  const defaultImageDuration = 5; // 5 seconds for image stories without music

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file');
      return;
    }

    if (file.size > maxImageSize) {
      toast.error('Image must be less than 30MB');
      return;
    }

    // Compress image before setting
    try {
      const compressedFile = await compressImage(file, 1920, 0.85);
      setMediaFile(compressedFile);
      setMediaType('image');
      const reader = new FileReader();
      reader.onloadend = () => {
        setMediaPreview(reader.result as string);
      };
      reader.readAsDataURL(compressedFile);
    } catch (error) {
      console.error('Error compressing image:', error);
      // Fall back to original file
      setMediaFile(file);
      setMediaType('image');
      const reader = new FileReader();
      reader.onloadend = () => {
        setMediaPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
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
        if (video.duration > maxVideoDuration) {
          toast.error(`Video must be ${maxVideoDuration} seconds or less`);
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
    // Clear music when switching to video
    setSelectedMusic(null);
  };

  const handleAudioUpload = async (file: File): Promise<string | null> => {
    if (!user) return null;

    try {
      const result = await uploadApi.uploadFile('stories', file);
      return result.url;
    } catch (error) {
      console.error('Error uploading audio:', error);
      return null;
    }
  };

  const clearMedia = () => {
    setMediaFile(null);
    setMediaPreview(null);
    setSelectedMusic(null);
  };

  const handleUpload = async () => {
    if (!mediaFile || !user) return;

    setIsUploading(true);

    try {
      // Calculate story duration
      let storyDuration = defaultImageDuration;
      if (mediaType === 'video') {
        storyDuration = maxVideoDuration;
      } else if (selectedMusic?.duration) {
        storyDuration = Math.min(selectedMusic.duration, maxMusicDuration);
      }

      // Upload story using the API
      await storiesApi.createStory(mediaFile, mediaType, storyDuration);

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
      <div className="bg-card rounded-lg max-w-md w-full overflow-hidden max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border flex-shrink-0">
          <h2 className="font-semibold">Add Story</h2>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="w-5 h-5" />
          </Button>
        </div>

        {/* Content */}
        <div className="p-4 overflow-y-auto flex-1">
          {!mediaPreview ? (
            <Tabs defaultValue="image" className="w-full">
              <TabsList className="grid w-full grid-cols-2 mb-4">
                <TabsTrigger value="image" className="flex items-center gap-1 text-xs sm:text-sm">
                  <Image className="w-4 h-4" />
                  Photo
                </TabsTrigger>
                <TabsTrigger value="video" className="flex items-center gap-1 text-xs sm:text-sm">
                  <Video className="w-4 h-4" />
                  Video
                </TabsTrigger>
              </TabsList>

              <TabsContent value="image">
                <label className="flex flex-col items-center justify-center w-full h-48 border-2 border-dashed border-muted-foreground/30 rounded-lg cursor-pointer hover:bg-muted/50 transition-colors">
                  <Upload className="w-10 h-10 text-muted-foreground mb-2" />
                  <span className="text-sm text-muted-foreground">Click to upload image</span>
                  <span className="text-xs text-muted-foreground mt-1">Max 30MB • Auto-compressed</span>
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
                    Max {isPremium ? '50' : '25'}MB, {maxVideoDuration}s
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
            <div className="space-y-4">
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

              {/* Music selector - only for images */}
              {mediaType === 'image' && (
                <MusicSelector
                  selectedMusic={selectedMusic}
                  onSelect={setSelectedMusic}
                  onUpload={handleAudioUpload}
                  maxSize={maxAudioSize}
                />
              )}
            </div>
          )}

          {/* Story info */}
          <div className="mt-4 p-3 bg-muted rounded-lg space-y-3">
            <div className="flex items-center gap-2 text-sm">
              {isPremium && <Crown className="w-4 h-4 text-primary" />}
              <span className="text-muted-foreground">
                {mediaType === 'image' ? 'Photo' : 'Video'} Duration: <span className="text-foreground font-medium">
                  {mediaType === 'image' 
                    ? (selectedMusic?.duration 
                        ? `${Math.min(selectedMusic.duration, maxMusicDuration)}s (music)` 
                        : `${defaultImageDuration}s`)
                    : `${maxVideoDuration}s`}
                </span>
              </span>
            </div>
            
            {/* Expiry Selection */}
            <div>
              <span className="text-sm text-muted-foreground block mb-2">Delete after:</span>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant={selectedExpiry === 24 ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSelectedExpiry(24)}
                  className="flex-1"
                >
                  24 hours
                </Button>
                <Button
                  type="button"
                  variant={selectedExpiry === 48 ? "default" : "outline"}
                  size="sm"
                  onClick={() => {
                    if (isPremium) {
                      setSelectedExpiry(48);
                    } else {
                      toast.error('48 hour stories are for Premium users only');
                    }
                  }}
                  disabled={!isPremium}
                  className="flex-1 relative"
                >
                  48 hours
                  {!isPremium && <Crown className="w-3 h-3 ml-1 text-primary" />}
                </Button>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
              <span className="text-muted-foreground">
                Video: <span className="text-foreground font-medium">{isPremium ? '50' : '25'}MB</span>
              </span>
              <span className="text-muted-foreground">
                Audio: <span className="text-foreground font-medium">5MB</span>
              </span>
            </div>
            {!isPremium && (
              <p className="text-xs text-muted-foreground">
                Upgrade to Premium for 60s stories, 48h visibility & 50MB videos!
              </p>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-border flex-shrink-0">
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
