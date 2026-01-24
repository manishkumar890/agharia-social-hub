import { useState, useRef } from 'react';
import { Music, Upload, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

interface MusicSelectorProps {
  selectedMusic: { url: string; name: string; duration?: number } | null;
  onSelect: (music: { url: string; name: string; duration?: number } | null) => void;
  onUpload: (file: File) => Promise<string | null>;
  maxSize?: number; // in bytes
}

const MusicSelector = ({ selectedMusic, onSelect, onUpload, maxSize = 10 * 1024 * 1024 }: MusicSelectorProps) => {
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('audio/')) {
      toast.error('Please select an audio file');
      return;
    }

    if (file.size > maxSize) {
      toast.error(`Audio must be less than ${Math.round(maxSize / (1024 * 1024))}MB`);
      return;
    }

    // Get audio duration
    const audio = document.createElement('audio');
    audio.preload = 'metadata';
    
    const getDuration = new Promise<number>((resolve) => {
      audio.onloadedmetadata = () => {
        URL.revokeObjectURL(audio.src);
        resolve(Math.round(audio.duration));
      };
      audio.onerror = () => {
        resolve(30); // Default to 30 seconds if can't determine
      };
    });

    audio.src = URL.createObjectURL(file);
    const duration = await getDuration;

    setIsUploading(true);
    try {
      const url = await onUpload(file);
      if (url) {
        onSelect({ url, name: file.name, duration });
      }
    } catch {
      toast.error('Failed to upload audio');
    } finally {
      setIsUploading(false);
    }

    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleRemoveMusic = () => {
    onSelect(null);
  };

  return (
    <div className="relative">
      <input
        ref={fileInputRef}
        type="file"
        accept="audio/*"
        onChange={handleFileUpload}
        className="hidden"
      />

      {selectedMusic ? (
        <div className="flex items-center gap-2 p-2 bg-primary/10 rounded-lg">
          <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
            <Music className="w-4 h-4 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{selectedMusic.name}</p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={handleRemoveMusic}
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
      ) : (
        <Button
          variant="outline"
          className="w-full justify-center gap-2"
          onClick={() => fileInputRef.current?.click()}
          disabled={isUploading}
        >
          {isUploading ? (
            <>Uploading...</>
          ) : (
            <>
              <Upload className="w-4 h-4" />
              Upload Your Audio (max 10MB)
            </>
          )}
        </Button>
      )}
    </div>
  );
};

export default MusicSelector;
