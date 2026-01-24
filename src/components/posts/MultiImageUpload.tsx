import { useState, useRef } from 'react';
import { ImagePlus, X, Music } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import MusicSelector from '@/components/stories/MusicSelector';

interface MultiImageUploadProps {
  images: File[];
  onImagesChange: (images: File[]) => void;
  previews: string[];
  onPreviewsChange: (previews: string[]) => void;
  selectedMusic: { url: string; name: string; duration?: number } | null;
  onMusicChange: (music: { url: string; name: string; duration?: number } | null) => void;
  onMusicUpload: (file: File) => Promise<string | null>;
  isPremium: boolean;
  maxImages?: number;
  maxImageSize?: number;
}

const MultiImageUpload = ({
  images,
  onImagesChange,
  previews,
  onPreviewsChange,
  selectedMusic,
  onMusicChange,
  onMusicUpload,
  isPremium,
  maxImages = 10,
  maxImageSize = 30 * 1024 * 1024,
}: MultiImageUploadProps) => {
  const [currentPreviewIndex, setCurrentPreviewIndex] = useState(0);
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Minimum swipe distance
  const minSwipeDistance = 50;

  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    setTouchEnd(e.targetTouches[0].clientX);
  };

  const handleTouchEnd = () => {
    if (!touchStart || !touchEnd) return;
    
    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > minSwipeDistance;
    const isRightSwipe = distance < -minSwipeDistance;
    
    if (isLeftSwipe && currentPreviewIndex < previews.length - 1) {
      setCurrentPreviewIndex(prev => prev + 1);
    }
    if (isRightSwipe && currentPreviewIndex > 0) {
      setCurrentPreviewIndex(prev => prev - 1);
    }
  };

  const handleAddImages = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    
    if (images.length + files.length > maxImages) {
      toast.error(`You can upload up to ${maxImages} photos at once`);
      return;
    }

    const validFiles: File[] = [];
    const validPreviews: string[] = [];

    for (const file of files) {
      if (file.size > maxImageSize) {
        toast.error(`Image "${file.name}" exceeds 30MB limit`);
        continue;
      }

      if (!file.type.startsWith('image/')) {
        toast.error(`"${file.name}" is not a valid image`);
        continue;
      }

      validFiles.push(file);
      validPreviews.push(URL.createObjectURL(file));
    }

    if (validFiles.length > 0) {
      onImagesChange([...images, ...validFiles]);
      onPreviewsChange([...previews, ...validPreviews]);
    }

    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleRemoveImage = (index: number) => {
    const newImages = images.filter((_, i) => i !== index);
    const newPreviews = previews.filter((_, i) => i !== index);
    
    // Revoke the URL to prevent memory leaks
    URL.revokeObjectURL(previews[index]);
    
    onImagesChange(newImages);
    onPreviewsChange(newPreviews);

    // Adjust current index if needed
    if (currentPreviewIndex >= newPreviews.length) {
      setCurrentPreviewIndex(Math.max(0, newPreviews.length - 1));
    }
  };

  // No images yet - show upload area
  if (previews.length === 0) {
    return (
      <div className="space-y-4">
        <Label>Photos (up to {maxImages}, max 30MB each)</Label>
        <label className="flex flex-col items-center justify-center aspect-square border-2 border-dashed border-border rounded-lg cursor-pointer hover:bg-muted/50 transition-colors">
          <ImagePlus className="w-12 h-12 text-muted-foreground mb-2" />
          <span className="text-sm text-muted-foreground">Click to upload photos</span>
          <span className="text-xs text-muted-foreground mt-1">
            Premium: Add up to 10 photos with music
          </span>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            onChange={handleAddImages}
            className="hidden"
          />
        </label>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Label>Photos ({previews.length}/{maxImages})</Label>
        {previews.length < maxImages && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
          >
            <ImagePlus className="w-4 h-4 mr-1" />
            Add More
          </Button>
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          onChange={handleAddImages}
          className="hidden"
        />
      </div>

      {/* Preview Carousel */}
      <div 
        className="relative aspect-square rounded-lg overflow-hidden border border-border"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {/* Image Counter */}
        {previews.length > 1 && (
          <div className="absolute top-3 right-12 z-10 bg-background/70 backdrop-blur-sm px-2.5 py-1 rounded-full">
            <span className="text-xs font-medium">
              {currentPreviewIndex + 1}/{previews.length}
            </span>
          </div>
        )}

        {/* Main Image */}
        <div 
          className="flex transition-transform duration-300 ease-out h-full"
          style={{ transform: `translateX(-${currentPreviewIndex * 100}%)` }}
        >
          {previews.map((preview, index) => (
            <div key={index} className="w-full h-full flex-shrink-0 relative">
              <img
                src={preview}
                alt={`Preview ${index + 1}`}
                className="w-full h-full object-cover"
              />
              <Button
                type="button"
                variant="destructive"
                size="icon"
                className="absolute top-2 right-2 h-8 w-8"
                onClick={() => handleRemoveImage(index)}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          ))}
        </div>
      </div>

      {/* Music Selector - Premium only */}
      {isPremium && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Music className="w-4 h-4 text-muted-foreground" />
            <Label>Background Music (max 10MB)</Label>
          </div>
          <MusicSelector
            selectedMusic={selectedMusic}
            onSelect={onMusicChange}
            onUpload={onMusicUpload}
            maxSize={10 * 1024 * 1024}
          />
        </div>
      )}
    </div>
  );
};

export default MultiImageUpload;
