import { useState, useRef, useEffect } from 'react';
import { Music } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { mediaManager } from '@/lib/mediaManager';

interface ImageCarouselProps {
  images: string[];
  backgroundAudioUrl?: string | null;
  className?: string;
  isVisible?: boolean;
}

const ImageCarousel = ({ 
  images, 
  backgroundAudioUrl, 
  className,
  isVisible = true
}: ImageCarouselProps) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const audioRef = useRef<HTMLAudioElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);

  // Minimum swipe distance (in px)
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
    
    if (isLeftSwipe && currentIndex < images.length - 1) {
      setCurrentIndex(prev => prev + 1);
    }
    if (isRightSwipe && currentIndex > 0) {
      setCurrentIndex(prev => prev - 1);
    }
  };

  // Auto-pause audio when post scrolls out of view
  useEffect(() => {
    if (!isVisible && audioRef.current && isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    }
  }, [isVisible]);

  const toggleAudio = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
        setIsPlaying(false);
      } else {
        // Register with global manager so other media stops
        mediaManager.play(() => {
          audioRef.current?.pause();
          setIsPlaying(false);
        });
        audioRef.current.play();
        setIsPlaying(true);
      }
    }
  };

  if (images.length === 0) return null;

  // Single image - no carousel needed
  if (images.length === 1) {
    return (
      <div className={cn("relative", className)}>
        <img
          src={images[0]}
          alt="Post image"
          className="w-full h-full object-cover"
        />
        {backgroundAudioUrl && (
          <>
            <audio ref={audioRef} src={backgroundAudioUrl} loop />
            <Button
              variant="ghost"
              size="icon"
              className="absolute bottom-3 right-3 h-8 w-8 bg-background/60 backdrop-blur-sm hover:bg-background/80"
              onClick={toggleAudio}
            >
              <Music className={cn("w-4 h-4", isPlaying && "text-primary")} />
            </Button>
          </>
        )}
      </div>
    );
  }

  return (
    <div 
      ref={containerRef}
      className={cn("relative overflow-hidden", className)}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Image Count Indicator - Instagram style */}
      {images.length > 1 && (
        <div className="absolute top-3 right-3 z-10 bg-background/70 backdrop-blur-sm px-2.5 py-1 rounded-full">
          <span className="text-xs font-medium text-foreground">
            {currentIndex + 1}/{images.length}
          </span>
        </div>
      )}

      {/* Images */}
      <div 
        className="flex transition-transform duration-300 ease-out"
        style={{ transform: `translateX(-${currentIndex * 100}%)` }}
      >
        {images.map((image, index) => (
          <div key={index} className="w-full flex-shrink-0">
            <img
              src={image}
              alt={`Post image ${index + 1}`}
              className="w-full h-full object-cover"
            />
          </div>
        ))}
      </div>


      {/* Music indicator */}
      {backgroundAudioUrl && (
        <>
          <audio ref={audioRef} src={backgroundAudioUrl} loop />
          <Button
            variant="ghost"
            size="icon"
            className="absolute bottom-3 right-3 h-8 w-8 bg-background/60 backdrop-blur-sm hover:bg-background/80"
            onClick={toggleAudio}
          >
            <Music className={cn("w-4 h-4", isPlaying && "text-primary")} />
          </Button>
        </>
      )}
    </div>
  );
};

export default ImageCarousel;
