import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, ChevronLeft, ChevronRight, Eye, Heart, Trash2, Loader2, Music, Pause } from 'lucide-react';
import { storiesApi, uploadApi } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { formatDistanceToNow } from 'date-fns';
import { toast } from 'sonner';

interface Story {
  id: string;
  user_id: string;
  media_url: string;
  media_type?: string;
  duration: number;
  created_at: string;
  expires_at: string;
  background_audio_url?: string;
}

interface StoryUser {
  user_id: string;
  avatar_url: string | null;
  username: string | null;
  full_name: string | null;
  stories: Story[];
}

interface StoryViewerProps {
  storyUser: StoryUser;
  onClose: () => void;
  onRefresh: () => void;
}

const StoryViewer = ({ storyUser, onClose, onRefresh }: StoryViewerProps) => {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [viewCount, setViewCount] = useState(0);
  const [likeCount, setLikeCount] = useState(0);
  const [isLiked, setIsLiked] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const bgAudioRef = useRef<HTMLAudioElement>(null);
  const [imageReady, setImageReady] = useState(false);
  const [audioReady, setAudioReady] = useState(false);

  const currentStory = storyUser.stories[currentIndex];
  const isOwnStory = profile?.user_id === storyUser.user_id;
  const isVideo = currentStory?.media_type === 'video';
  const isImage = currentStory?.media_type === 'image' || !currentStory?.media_type;
  const hasBackgroundAudio = isImage && !!currentStory?.background_audio_url;

  // Handle back button
  useEffect(() => {
    const handlePopState = (e: PopStateEvent) => {
      e.preventDefault();
      window.history.pushState(null, '', window.location.href);
      onClose();
      navigate('/', { replace: true });
    };

    window.history.pushState(null, '', window.location.href);
    window.addEventListener('popstate', handlePopState);

    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, [onClose, navigate]);

  // Record view
  useEffect(() => {
    if (!user || isOwnStory || !currentStory) return;

    const recordView = async () => {
      try {
        await storiesApi.viewStory(currentStory.id);
      } catch (error) {
        console.error('Error recording view:', error);
      }
    };

    recordView();
  }, [currentStory?.id, user, isOwnStory]);

  const handleLike = async () => {
    if (!user) {
      toast.error('Please login to like stories');
      return;
    }

    const wasLiked = isLiked;
    setIsLiked(!wasLiked);
    setLikeCount(prev => wasLiked ? prev - 1 : prev + 1);

    try {
      await storiesApi.toggleStoryLike(currentStory.id);
    } catch (error) {
      setIsLiked(wasLiked);
      setLikeCount(prev => wasLiked ? prev + 1 : prev - 1);
      console.error('Error toggling like:', error);
      toast.error('Failed to update like');
    }
  };

  const goToNext = useCallback(() => {
    if (currentIndex < storyUser.stories.length - 1) {
      setCurrentIndex(prev => prev + 1);
      setProgress(0);
    }
  }, [currentIndex, storyUser.stories.length]);

  const autoAdvance = useCallback(() => {
    if (currentIndex < storyUser.stories.length - 1) {
      setCurrentIndex(prev => prev + 1);
      setProgress(0);
    } else {
      onClose();
    }
  }, [currentIndex, storyUser.stories.length, onClose]);

  const goToPrev = useCallback(() => {
    if (currentIndex > 0) {
      setCurrentIndex(prev => prev - 1);
      setProgress(0);
    }
  }, [currentIndex]);

  // Progress timer
  useEffect(() => {
    if (isPaused || isLoading) return;

    if (isVideo) {
      const video = videoRef.current;
      if (!video) return;
      
      const handleTimeUpdate = () => {
        if (video.duration) {
          const progressPercent = (video.currentTime / video.duration) * 100;
          setProgress(progressPercent);
        }
      };

      const handleEnded = () => {
        autoAdvance();
      };

      video.addEventListener('timeupdate', handleTimeUpdate);
      video.addEventListener('ended', handleEnded);

      return () => {
        video.removeEventListener('timeupdate', handleTimeUpdate);
        video.removeEventListener('ended', handleEnded);
      };
    }

    const duration = currentStory.duration * 1000;
    const interval = 50;
    const increment = (interval / duration) * 100;

    const timer = setInterval(() => {
      setProgress(prev => {
        if (prev >= 100) {
          autoAdvance();
          return 0;
        }
        return prev + increment;
      });
    }, interval);

    return () => clearInterval(timer);
  }, [currentStory?.duration, isPaused, autoAdvance, isVideo, isLoading]);

  // Reset progress when story changes
  useEffect(() => {
    setProgress(0);
    setIsLoading(true);
    setImageReady(false);
    setAudioReady(false);
    
    if (videoRef.current) {
      videoRef.current.currentTime = 0;
      videoRef.current.play().catch(() => {});
    }
  }, [currentIndex]);

  // Sync image + background audio loading
  useEffect(() => {
    if (hasBackgroundAudio) {
      if (imageReady && audioReady) {
        setIsLoading(false);
        if (bgAudioRef.current) {
          bgAudioRef.current.currentTime = 0;
          bgAudioRef.current.play().catch(() => {});
        }
      }
    } else if (isImage && imageReady) {
      setIsLoading(false);
    }
  }, [imageReady, audioReady, hasBackgroundAudio, isImage]);

  const handleMediaLoaded = () => {
    setIsLoading(false);
  };

  const handleTouchStart = () => {
    setIsPaused(true);
    if (videoRef.current) videoRef.current.pause();
    if (bgAudioRef.current) bgAudioRef.current.pause();
  };
  
  const handleTouchEnd = () => {
    setIsPaused(false);
    if (videoRef.current) videoRef.current.play().catch(() => {});
    if (bgAudioRef.current) bgAudioRef.current.play().catch(() => {});
  };

  const togglePause = () => {
    if (isPaused) {
      handleTouchEnd();
    } else {
      handleTouchStart();
    }
  };

  const handleDelete = async () => {
    if (!currentStory || !user || !isOwnStory) {
      toast.error('You can only delete your own story');
      return;
    }
    
    setIsDeleting(true);
    try {
      await storiesApi.deleteStory(currentStory.id);
      toast.success('Story deleted');
      
      if (storyUser.stories.length > 1) {
        if (currentIndex === storyUser.stories.length - 1) {
          setCurrentIndex(prev => Math.max(0, prev - 1));
        }
        onRefresh();
      } else {
        onClose();
        onRefresh();
      }
    } catch (error) {
      console.error('Error deleting story:', error);
      toast.error('Failed to delete story');
    } finally {
      setIsDeleting(false);
      setShowDeleteDialog(false);
    }
  };

  if (!currentStory) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[100] bg-black flex items-center justify-center">
      {/* Progress bars */}
      <div className="absolute top-2 left-2 right-2 flex gap-1 z-30">
        {storyUser.stories.map((_, index) => (
          <div key={index} className="flex-1 h-1 bg-white/30 rounded-full overflow-hidden">
            <div 
              className={`h-full bg-white rounded-full ${isPaused ? '' : 'transition-all ease-linear'}`}
              style={{ 
                width: index < currentIndex ? '100%' : 
                       index === currentIndex ? `${progress}%` : '0%',
                transitionDuration: isPaused ? '0ms' : '50ms'
              }}
            />
          </div>
        ))}
      </div>

      {/* Header */}
      <div className="absolute top-6 left-0 right-0 px-4 flex items-center justify-between z-30">
        <div className="flex items-center gap-3">
          <Avatar className="w-10 h-10 border-2 border-white">
            <AvatarImage src={storyUser.avatar_url || undefined} />
            <AvatarFallback className="bg-primary text-primary-foreground">
              {storyUser.full_name?.charAt(0) || 'U'}
            </AvatarFallback>
          </Avatar>
          <div>
            <p className="text-white font-medium text-sm">
              {storyUser.username || storyUser.full_name || 'Unknown'}
            </p>
            <p className="text-white/70 text-xs">
              {formatDistanceToNow(new Date(currentStory.created_at), { addSuffix: true })}
            </p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={onClose}
          className="text-white hover:bg-white/20"
        >
          <X className="w-6 h-6" />
        </Button>
      </div>

      {/* Story Content */}
      <div 
        className="w-full h-full flex items-center justify-center relative"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        onMouseEnter={handleTouchStart}
        onMouseLeave={handleTouchEnd}
      >
        {/* Loading indicator */}
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center z-10">
            <div className="w-12 h-12 border-4 border-white/30 border-t-white rounded-full animate-spin" />
          </div>
        )}

        {/* Pause indicator */}
        {isPaused && !isLoading && (
          <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none">
            <div className="w-16 h-16 rounded-full bg-black/50 flex items-center justify-center">
              <Pause className="w-8 h-8 text-white" />
            </div>
          </div>
        )}

        {isVideo ? (
          <video
            ref={videoRef}
            src={currentStory.media_url}
            className="max-w-full max-h-full object-contain"
            autoPlay
            playsInline
            onLoadedData={handleMediaLoaded}
            onCanPlay={handleMediaLoaded}
          />
        ) : (
          <>
            <img
              src={currentStory.media_url}
              alt="Story"
              className={`max-w-full max-h-full object-contain transition-opacity duration-500 ${isLoading ? 'opacity-0' : 'opacity-100'}`}
              onLoad={() => setImageReady(true)}
            />
            {/* Background audio for image stories */}
            {hasBackgroundAudio && (
              <>
                <audio
                  ref={bgAudioRef}
                  src={currentStory.background_audio_url}
                  loop
                  preload="auto"
                  onCanPlayThrough={() => setAudioReady(true)}
                  className="hidden"
                />
                <div className={`absolute bottom-24 left-4 flex items-center gap-2 px-3 py-1.5 bg-black/50 rounded-full z-20 transition-opacity duration-500 ${isLoading ? 'opacity-0' : 'opacity-100'}`}>
                  <Music className="w-4 h-4 text-white animate-pulse" />
                  <span className="text-white text-xs">♪ Music</span>
                </div>
              </>
            )}
          </>
        )}
      </div>

      {/* Mobile pause/play button */}
      <button
        onClick={togglePause}
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-20 h-20 z-15 md:hidden"
        aria-label={isPaused ? 'Play' : 'Pause'}
      />

      {/* Navigation */}
      <button
        onClick={goToPrev}
        className="absolute left-0 top-0 bottom-0 w-1/3 z-10"
        disabled={currentIndex === 0}
      />
      <button
        onClick={goToNext}
        className="absolute right-0 top-0 bottom-0 w-1/3 z-10"
      />

      {/* Navigation arrows for desktop */}
      {currentIndex > 0 && (
        <Button
          variant="ghost"
          size="icon"
          onClick={goToPrev}
          className="absolute left-4 top-1/2 -translate-y-1/2 text-white hover:bg-white/20 hidden md:flex z-20"
        >
          <ChevronLeft className="w-8 h-8" />
        </Button>
      )}
      {currentIndex < storyUser.stories.length - 1 && (
        <Button
          variant="ghost"
          size="icon"
          onClick={goToNext}
          className="absolute right-4 top-1/2 -translate-y-1/2 text-white hover:bg-white/20 hidden md:flex z-20"
        >
          <ChevronRight className="w-8 h-8" />
        </Button>
      )}

      {/* Bottom stats and actions */}
      <div className="absolute bottom-8 left-0 right-0 px-4 flex items-center justify-between z-20">
        {isOwnStory ? (
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-white">
              <Eye className="w-5 h-5" />
              <span className="text-sm">{viewCount}</span>
            </div>
            <div className="flex items-center gap-1 text-white">
              <Heart className={`w-6 h-6 ${likeCount > 0 ? 'fill-red-500 text-red-500' : ''}`} />
              <span className="text-sm">{likeCount}</span>
            </div>
          </div>
        ) : (
          <div />
        )}

        <div className="flex items-center gap-3">
          {!isOwnStory && (
            <button
              onClick={handleLike}
              className="flex items-center gap-1 text-white"
            >
              <Heart className={`w-6 h-6 transition-colors ${isLiked ? 'fill-red-500 text-red-500' : ''}`} />
              <span className="text-sm">{likeCount}</span>
            </button>
          )}
          {isOwnStory && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => {
                setShowDeleteDialog(true);
                setIsPaused(true);
                if (videoRef.current) videoRef.current.pause();
                if (bgAudioRef.current) bgAudioRef.current.pause();
              }}
              className="text-white hover:bg-white/20"
            >
              <Trash2 className="w-5 h-5" />
            </Button>
          )}
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog
        open={showDeleteDialog}
        onOpenChange={(open) => {
          if (!open && isDeleting) return;
          setShowDeleteDialog(open);
          if (!open) {
            setIsPaused(false);
            if (videoRef.current) videoRef.current.play().catch(() => {});
            if (bgAudioRef.current) bgAudioRef.current.play().catch(() => {});
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Story</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this story for everyone, and it cannot be recovered.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleDelete();
              }}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? (
                <span className="inline-flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Deleting...
                </span>
              ) : (
                'Delete'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default StoryViewer;
