import { useState, useRef, useEffect } from 'react';
import { Music, Play, Pause, Check, Upload, X, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';

// Preset music tracks (royalty-free from web)
const PRESET_TRACKS = [
  {
    id: 'upbeat-1',
    name: 'Happy Vibes',
    artist: 'Acoustic',
    url: 'https://cdn.pixabay.com/download/audio/2022/03/15/audio_8a8cd1c3a8.mp3',
    duration: 30
  },
  {
    id: 'chill-1',
    name: 'Chill Beats',
    artist: 'Lo-Fi',
    url: 'https://cdn.pixabay.com/download/audio/2022/10/25/audio_946b0939c3.mp3',
    duration: 30
  },
  {
    id: 'inspiring-1',
    name: 'Inspiring',
    artist: 'Cinematic',
    url: 'https://cdn.pixabay.com/download/audio/2022/02/22/audio_d1718ab41b.mp3',
    duration: 30
  },
  {
    id: 'fun-1',
    name: 'Fun Day',
    artist: 'Pop',
    url: 'https://cdn.pixabay.com/download/audio/2021/11/25/audio_91b32e02f9.mp3',
    duration: 30
  },
  {
    id: 'soft-1',
    name: 'Soft Piano',
    artist: 'Classical',
    url: 'https://cdn.pixabay.com/download/audio/2022/01/18/audio_d0c6ff6a8f.mp3',
    duration: 30
  },
  {
    id: 'energetic-1',
    name: 'Energetic',
    artist: 'Electronic',
    url: 'https://cdn.pixabay.com/download/audio/2022/04/27/audio_2aa1f1b8a3.mp3',
    duration: 30
  }
];

interface MusicSelectorProps {
  selectedMusic: { url: string; name: string; duration?: number } | null;
  onSelect: (music: { url: string; name: string; duration?: number } | null) => void;
  onUpload: (file: File) => Promise<string | null>;
  maxSize?: number; // in bytes
}
const MusicSelector = ({ selectedMusic, onSelect, onUpload, maxSize = 5 * 1024 * 1024 }: MusicSelectorProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const filteredTracks = PRESET_TRACKS.filter(track =>
    track.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    track.artist.toLowerCase().includes(searchQuery.toLowerCase())
  );

  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
      }
    };
  }, []);

  const handlePlayPause = (track: typeof PRESET_TRACKS[0]) => {
    if (!audioRef.current) return;

    if (playingId === track.id) {
      audioRef.current.pause();
      setPlayingId(null);
    } else {
      audioRef.current.src = track.url;
      audioRef.current.play().catch(() => {});
      setPlayingId(track.id);
    }
  };

  const handleSelect = (track: typeof PRESET_TRACKS[0]) => {
    if (audioRef.current) {
      audioRef.current.pause();
    }
    setPlayingId(null);
    onSelect({ url: track.url, name: track.name, duration: track.duration });
    setIsOpen(false);
  };

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
        setIsOpen(false);
      }
    } catch {
      toast.error('Failed to upload audio');
    } finally {
      setIsUploading(false);
    }
  };

  const handleRemoveMusic = () => {
    if (audioRef.current) {
      audioRef.current.pause();
    }
    setPlayingId(null);
    onSelect(null);
  };

  return (
    <div className="relative">
      <audio ref={audioRef} onEnded={() => setPlayingId(null)} />
      <input
        ref={fileInputRef}
        type="file"
        accept="audio/*"
        onChange={handleFileUpload}
        className="hidden"
      />

      {/* Selected music display or add button */}
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
          className="w-full justify-start gap-2"
          onClick={() => setIsOpen(true)}
        >
          <Music className="w-4 h-4" />
          Add Music
        </Button>
      )}

      {/* Music selector modal */}
      {isOpen && (
        <div className="fixed inset-0 z-[110] bg-black/80 flex items-end sm:items-center justify-center">
          <div className="bg-card w-full max-w-md rounded-t-2xl sm:rounded-2xl max-h-[80vh] flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-border">
              <h3 className="font-semibold">Add Music</h3>
              <Button variant="ghost" size="icon" onClick={() => setIsOpen(false)}>
                <X className="w-5 h-5" />
              </Button>
            </div>

            {/* Search */}
            <div className="p-4 border-b border-border">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search music..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>

            {/* Upload option */}
            <div className="p-4 border-b border-border">
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
                    Upload Your Audio (max 5MB)
                  </>
                )}
              </Button>
            </div>

            {/* Preset tracks */}
            <ScrollArea className="flex-1 p-4">
              <div className="space-y-2">
                {filteredTracks.map((track) => (
                  <div
                    key={track.id}
                    className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors"
                  >
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-10 w-10 rounded-full bg-primary/10"
                      onClick={() => handlePlayPause(track)}
                    >
                      {playingId === track.id ? (
                        <Pause className="w-4 h-4 text-primary" />
                      ) : (
                        <Play className="w-4 h-4 text-primary" />
                      )}
                    </Button>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{track.name}</p>
                      <p className="text-xs text-muted-foreground">{track.artist}</p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleSelect(track)}
                    >
                      <Check className="w-4 h-4 mr-1" />
                      Use
                    </Button>
                  </div>
                ))}
                {filteredTracks.length === 0 && (
                  <p className="text-center text-muted-foreground py-4">
                    No tracks found
                  </p>
                )}
              </div>
            </ScrollArea>
          </div>
        </div>
      )}
    </div>
  );
};

export default MusicSelector;
