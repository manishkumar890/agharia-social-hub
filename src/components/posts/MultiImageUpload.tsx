import { useState, useRef } from 'react';
import { ImagePlus, X, ChevronLeft, ChevronRight, Music } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
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
  maxMusicDuration?: number;
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
  maxImageSize = 5 * 1024 * 1024,
  maxMusicDuration = 60,
}: MultiImageUploadProps) => {
  const [currentPreviewIndex, setCurrentPreviewIndex] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
        toast.error(`Image "${file.name}" exceeds 5MB limit`);
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

  const handlePrev = () => {
    setCurrentPreviewIndex((prev) => (prev === 0 ? previews.length - 1 : prev - 1));
  };

  const handleNext = () => {
    setCurrentPreviewIndex((prev) => (prev === previews.length - 1 ? 0 : prev + 1));
  };

  // No images yet - show upload area
  if (previews.length === 0) {
    return (
      <div className="space-y-4">
        <Label>Photos (up to {maxImages}, max 5MB each)</Label>
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
      <div className="relative aspect-square rounded-lg overflow-hidden border border-border">
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

        {/* Navigation */}
        {previews.length > 1 && (
          <>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="absolute left-2 top-1/2 -translate-y-1/2 h-8 w-8 bg-background/60 backdrop-blur-sm hover:bg-background/80"
              onClick={handlePrev}
            >
              <ChevronLeft className="w-5 h-5" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8 bg-background/60 backdrop-blur-sm hover:bg-background/80"
              onClick={handleNext}
            >
              <ChevronRight className="w-5 h-5" />
            </Button>

            {/* Dots */}
            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-1.5">
              {previews.map((_, index) => (
                <button
                  key={index}
                  type="button"
                  className={cn(
                    "w-1.5 h-1.5 rounded-full transition-all",
                    index === currentPreviewIndex 
                      ? "bg-primary w-2.5" 
                      : "bg-background/60"
                  )}
                  onClick={() => setCurrentPreviewIndex(index)}
                />
              ))}
            </div>
          </>
        )}
      </div>

      {/* Music Selector - Premium only */}
      {isPremium && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Music className="w-4 h-4 text-muted-foreground" />
            <Label>Background Music (max {maxMusicDuration}s)</Label>
          </div>
          <MusicSelector
            selectedMusic={selectedMusic}
            onSelect={(music) => {
              if (music && music.duration && music.duration > maxMusicDuration) {
                toast.error(`Music must be ${maxMusicDuration} seconds or less`);
                return;
              }
              onMusicChange(music);
            }}
            onUpload={onMusicUpload}
            maxSize={10 * 1024 * 1024}
          />
        </div>
      )}
    </div>
  );
};

export default MultiImageUpload;
