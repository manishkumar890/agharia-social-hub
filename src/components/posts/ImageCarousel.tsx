import { useState, useRef, useEffect } from 'react';
import { Music } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface ImageCarouselProps {
  images: string[];
  backgroundAudioUrl?: string | null;
  className?: string;
}

const ImageCarousel = ({ 
  images, 
  backgroundAudioUrl, 
  className
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

  // Auto-play audio when component mounts
  useEffect(() => {
    if (backgroundAudioUrl && audioRef.current) {
      audioRef.current.play().then(() => {
        setIsPlaying(true);
      }).catch(() => {
        setIsPlaying(false);
      });
    }
  }, [backgroundAudioUrl]);

  const toggleAudio = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
        setIsPlaying(false);
      } else {
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

      {/* Dots Indicator */}
      {images.length > 1 && (
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-1.5">
          {images.map((_, index) => (
            <button
              key={index}
              className={cn(
                "w-1.5 h-1.5 rounded-full transition-all",
                index === currentIndex 
                  ? "bg-primary w-2.5" 
                  : "bg-background/60"
              )}
              onClick={(e) => {
                e.stopPropagation();
                setCurrentIndex(index);
              }}
            />
          ))}
        </div>
      )}

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
