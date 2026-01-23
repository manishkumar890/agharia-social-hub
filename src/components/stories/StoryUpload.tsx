import { useState } from 'react';
import { X, Upload, Loader2, Crown } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useSubscription } from '@/contexts/SubscriptionContext';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

interface StoryUploadProps {
  onClose: () => void;
  onSuccess: () => void;
}

const StoryUpload = ({ onClose, onSuccess }: StoryUploadProps) => {
  const { user } = useAuth();
  const { isPremium } = useSubscription();
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  // Duration: 30s for free, 60s for premium
  const maxDuration = isPremium ? 60 : 30;
  // Expiry: 24h for free, 48h for premium
  const expiryHours = isPremium ? 48 : 24;

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image must be less than 5MB');
      return;
    }

    setImageFile(file);
    const reader = new FileReader();
    reader.onloadend = () => {
      setImagePreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleUpload = async () => {
    if (!imageFile || !user) return;

    setIsUploading(true);

    try {
      // Upload to storage
      const fileExt = imageFile.name.split('.').pop();
      const fileName = `${user.id}/${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('stories')
        .upload(fileName, imageFile);

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
          {!imagePreview ? (
            <label className="flex flex-col items-center justify-center w-full h-64 border-2 border-dashed border-muted-foreground/30 rounded-lg cursor-pointer hover:bg-muted/50 transition-colors">
              <Upload className="w-10 h-10 text-muted-foreground mb-2" />
              <span className="text-sm text-muted-foreground">Click to upload image</span>
              <input
                type="file"
                accept="image/*"
                onChange={handleImageChange}
                className="hidden"
              />
            </label>
          ) : (
            <div className="relative">
              <img
                src={imagePreview}
                alt="Story preview"
                className="w-full h-64 object-cover rounded-lg"
              />
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  setImageFile(null);
                  setImagePreview(null);
                }}
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
            {!isPremium && (
              <p className="text-xs text-muted-foreground mt-2">
                Upgrade to Premium for 60s stories and 48h visibility!
              </p>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-border">
          <Button
            onClick={handleUpload}
            disabled={!imageFile || isUploading}
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
