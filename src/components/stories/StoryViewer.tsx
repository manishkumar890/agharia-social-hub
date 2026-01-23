import { useState, useEffect, useCallback, useRef } from 'react';
import { X, ChevronLeft, ChevronRight, Eye, Heart, Trash2, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
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

interface ViewerInfo {
  user_id: string;
  username: string | null;
  full_name: string | null;
  avatar_url: string | null;
}

const StoryViewer = ({ storyUser, onClose, onRefresh }: StoryViewerProps) => {
  const { user } = useAuth();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [viewCount, setViewCount] = useState(0);
  const [likeCount, setLikeCount] = useState(0);
  const [isLiked, setIsLiked] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showViewers, setShowViewers] = useState(false);
  const [showLikers, setShowLikers] = useState(false);
  const [viewers, setViewers] = useState<ViewerInfo[]>([]);
  const [likers, setLikers] = useState<ViewerInfo[]>([]);
  const videoRef = useRef<HTMLVideoElement>(null);

  const currentStory = storyUser.stories[currentIndex];
  const isOwnStory = user?.id === storyUser.user_id;
  const isVideo = currentStory?.media_type === 'video';

  // Record view
  useEffect(() => {
    if (!user || isOwnStory) return;

    const recordView = async () => {
      try {
        await supabase
          .from('story_views')
          .upsert({
            story_id: currentStory.id,
            viewer_id: user.id
          }, {
            onConflict: 'story_id,viewer_id'
          });
      } catch (error) {
        console.error('Error recording view:', error);
      }
    };

    recordView();
  }, [currentStory.id, user, isOwnStory]);

  // Fetch counts and like status
  const fetchCounts = useCallback(async () => {
    const [viewsResult, likesResult] = await Promise.all([
      supabase
        .from('story_views')
        .select('*', { count: 'exact', head: true })
        .eq('story_id', currentStory.id),
      supabase
        .from('story_likes')
        .select('*', { count: 'exact', head: true })
        .eq('story_id', currentStory.id)
    ]);

    setViewCount(viewsResult.count || 0);
    setLikeCount(likesResult.count || 0);

    // Check if current user liked
    if (user) {
      const { data: likeData } = await supabase
        .from('story_likes')
        .select('id')
        .eq('story_id', currentStory.id)
        .eq('user_id', user.id)
        .maybeSingle();
      
      setIsLiked(!!likeData);
    }
  }, [currentStory.id, user]);

  // Fetch viewers list for story owner
  const fetchViewers = useCallback(async () => {
    if (!isOwnStory) return;
    
    const { data: viewsData } = await supabase
      .from('story_views')
      .select('viewer_id')
      .eq('story_id', currentStory.id);

    if (viewsData && viewsData.length > 0) {
      const userIds = viewsData.map(v => v.viewer_id);
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, username, full_name, avatar_url')
        .in('user_id', userIds);

      setViewers(profiles || []);
    } else {
      setViewers([]);
    }
  }, [currentStory.id, isOwnStory]);

  // Fetch likers list for story owner
  const fetchLikers = useCallback(async () => {
    if (!isOwnStory) return;
    
    const { data: likesData } = await supabase
      .from('story_likes')
      .select('user_id')
      .eq('story_id', currentStory.id);

    if (likesData && likesData.length > 0) {
      const userIds = likesData.map(l => l.user_id);
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, username, full_name, avatar_url')
        .in('user_id', userIds);

      setLikers(profiles || []);
    } else {
      setLikers([]);
    }
  }, [currentStory.id, isOwnStory]);

  useEffect(() => {
    fetchCounts();
    if (isOwnStory) {
      fetchViewers();
      fetchLikers();
    }

    // Subscribe to realtime updates for views, likes
    const channel = supabase
      .channel(`story-stats-${currentStory.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'story_views', filter: `story_id=eq.${currentStory.id}` },
        () => {
          fetchCounts();
          if (isOwnStory) fetchViewers();
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'story_likes', filter: `story_id=eq.${currentStory.id}` },
        () => {
          fetchCounts();
          if (isOwnStory) fetchLikers();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentStory.id, fetchCounts, fetchViewers, fetchLikers, isOwnStory]);

  const handleLike = async () => {
    if (!user) {
      toast.error('Please login to like stories');
      return;
    }

    try {
      if (isLiked) {
        await supabase
          .from('story_likes')
          .delete()
          .eq('story_id', currentStory.id)
          .eq('user_id', user.id);
      } else {
        await supabase
          .from('story_likes')
          .insert({
            story_id: currentStory.id,
            user_id: user.id
          });
      }
    } catch (error) {
      console.error('Error toggling like:', error);
    }
  };

  // Navigation by click - does NOT close on last story
  const goToNext = useCallback(() => {
    if (currentIndex < storyUser.stories.length - 1) {
      setCurrentIndex(prev => prev + 1);
      setProgress(0);
      setShowViewers(false);
      setShowLikers(false);
    }
    // Do nothing if on last story - user must click close button
  }, [currentIndex, storyUser.stories.length]);

  // Auto-advance when story finishes - DOES close on last story
  const autoAdvance = useCallback(() => {
    if (currentIndex < storyUser.stories.length - 1) {
      setCurrentIndex(prev => prev + 1);
      setProgress(0);
      setShowViewers(false);
      setShowLikers(false);
    } else {
      onClose();
    }
  }, [currentIndex, storyUser.stories.length, onClose]);

  const goToPrev = useCallback(() => {
    if (currentIndex > 0) {
      setCurrentIndex(prev => prev - 1);
      setProgress(0);
      setShowViewers(false);
      setShowLikers(false);
    }
  }, [currentIndex]);

  // Progress timer
  useEffect(() => {
    if (isPaused || showViewers || showLikers) return;

    // For videos, use video duration instead
    if (isVideo && videoRef.current) {
      const video = videoRef.current;
      
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

    // For images, use the duration from story
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
  }, [currentStory.duration, isPaused, autoAdvance, isVideo, showViewers, showLikers]);

  // Reset progress when story changes
  useEffect(() => {
    setProgress(0);
    if (videoRef.current) {
      videoRef.current.currentTime = 0;
      videoRef.current.play().catch(() => {});
    }
  }, [currentIndex]);

  const handleTouchStart = () => {
    setIsPaused(true);
    if (videoRef.current) videoRef.current.pause();
  };
  
  const handleTouchEnd = () => {
    setIsPaused(false);
    if (videoRef.current) videoRef.current.play().catch(() => {});
  };

  const toggleViewers = () => {
    setShowViewers(!showViewers);
    setShowLikers(false);
    if (!showViewers) {
      setIsPaused(true);
      if (videoRef.current) videoRef.current.pause();
    } else {
      setIsPaused(false);
      if (videoRef.current) videoRef.current.play().catch(() => {});
    }
  };

  const toggleLikers = () => {
    setShowLikers(!showLikers);
    setShowViewers(false);
    if (!showLikers) {
      setIsPaused(true);
      if (videoRef.current) videoRef.current.pause();
    } else {
      setIsPaused(false);
      if (videoRef.current) videoRef.current.play().catch(() => {});
    }
  };

  const handleDelete = async () => {
    if (!currentStory) return;
    if (!user || !isOwnStory) {
      toast.error('You can only delete your own story');
      return;
    }
    
    setIsDeleting(true);
    try {
      // Delete story from database
      const { error, count } = await supabase
        .from('stories')
        .delete({ count: 'exact' })
        .eq('id', currentStory.id)
        .eq('user_id', user.id);

      if (error) throw error;
      if (!count) {
        throw new Error('Delete blocked (not owner or not signed in)');
      }

      toast.success('Story deleted');
      
      // If there are more stories, go to next or previous
      if (storyUser.stories.length > 1) {
        if (currentIndex === storyUser.stories.length - 1) {
          // If it's the last story, go back
          setCurrentIndex(prev => Math.max(0, prev - 1));
        }
        // Refresh to update the list
        onRefresh();
      } else {
        // No more stories, close the viewer
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

  // Guard against empty stories array - don't auto close
  if (!currentStory) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[100] bg-black flex items-center justify-center">
      {/* Progress bars */}
      <div className="absolute top-2 left-2 right-2 flex gap-1 z-30">
        {storyUser.stories.map((_, index) => (
          <div key={index} className="flex-1 h-0.5 bg-white/30 rounded-full overflow-hidden">
            <div 
              className="h-full bg-white transition-all duration-50"
              style={{ 
                width: index < currentIndex ? '100%' : 
                       index === currentIndex ? `${progress}%` : '0%' 
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
              {storyUser.username || storyUser.full_name || 'User'}
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
        className="w-full h-full flex items-center justify-center"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        onMouseDown={handleTouchStart}
        onMouseUp={handleTouchEnd}
      >
        {isVideo ? (
          <video
            ref={videoRef}
            src={currentStory.media_url}
            className="max-w-full max-h-full object-contain"
            autoPlay
            muted
            playsInline
          />
        ) : (
          <img
            src={currentStory.media_url}
            alt="Story"
            className="max-w-full max-h-full object-contain"
          />
        )}
      </div>

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
        {/* View and Like counts (for owner - clickable) */}
        {isOwnStory ? (
          <div className="flex items-center gap-4">
            <button
              onClick={toggleViewers}
              className="flex items-center gap-2 text-white hover:opacity-80 transition-opacity"
            >
              <Eye className="w-5 h-5" />
              <span className="text-sm">{viewCount}</span>
            </button>
            <button
              onClick={toggleLikers}
              className="flex items-center gap-1 text-white hover:opacity-80 transition-opacity"
            >
              <Heart 
                className={`w-6 h-6 ${likeCount > 0 ? 'fill-red-500 text-red-500' : ''}`} 
              />
              <span className="text-sm">{likeCount}</span>
            </button>
          </div>
        ) : (
          <div />
        )}

        {/* Like button (for non-owners) + Delete button for owner */}
        <div className="flex items-center gap-3">
          {!isOwnStory && (
            <button
              onClick={handleLike}
              className="flex items-center gap-1 text-white"
            >
              <Heart 
                className={`w-6 h-6 transition-colors ${isLiked ? 'fill-red-500 text-red-500' : ''}`} 
              />
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
              }}
              className="text-white hover:bg-white/20"
            >
              <Trash2 className="w-5 h-5" />
            </Button>
          )}
        </div>
      </div>

      {/* Viewers Panel */}
      {showViewers && isOwnStory && (
        <div 
          className="absolute bottom-0 left-0 right-0 bg-black/80 backdrop-blur-sm rounded-t-2xl max-h-[60vh] flex flex-col z-20"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between p-4 border-b border-white/10">
            <h3 className="text-white font-semibold flex items-center gap-2">
              <Eye className="w-5 h-5" /> Viewers ({viewers.length})
            </h3>
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleViewers}
              className="text-white hover:bg-white/20"
            >
              <X className="w-5 h-5" />
            </Button>
          </div>
          <ScrollArea className="flex-1 p-4">
            {viewers.length === 0 ? (
              <p className="text-white/60 text-center py-4">No views yet</p>
            ) : (
              <div className="space-y-3">
                {viewers.map((viewer) => (
                  <div key={viewer.user_id} className="flex items-center gap-3">
                    <Avatar className="w-10 h-10">
                      <AvatarImage src={viewer.avatar_url || undefined} />
                      <AvatarFallback className="bg-primary text-primary-foreground">
                        {viewer.full_name?.charAt(0) || 'U'}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="text-white text-sm font-medium">
                        {viewer.username || viewer.full_name || 'User'}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </div>
      )}

      {/* Likers Panel */}
      {showLikers && isOwnStory && (
        <div 
          className="absolute bottom-0 left-0 right-0 bg-black/80 backdrop-blur-sm rounded-t-2xl max-h-[60vh] flex flex-col z-20"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between p-4 border-b border-white/10">
            <h3 className="text-white font-semibold flex items-center gap-2">
              <Heart className="w-5 h-5 fill-red-500 text-red-500" /> Likes ({likers.length})
            </h3>
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleLikers}
              className="text-white hover:bg-white/20"
            >
              <X className="w-5 h-5" />
            </Button>
          </div>
          <ScrollArea className="flex-1 p-4">
            {likers.length === 0 ? (
              <p className="text-white/60 text-center py-4">No likes yet</p>
            ) : (
              <div className="space-y-3">
                {likers.map((liker) => (
                  <div key={liker.user_id} className="flex items-center gap-3">
                    <Avatar className="w-10 h-10">
                      <AvatarImage src={liker.avatar_url || undefined} />
                      <AvatarFallback className="bg-primary text-primary-foreground">
                        {liker.full_name?.charAt(0) || 'U'}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="text-white text-sm font-medium">
                        {liker.username || liker.full_name || 'User'}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog
        open={showDeleteDialog}
        onOpenChange={(open) => {
          // Don't allow the dialog to close while a delete is in progress
          if (!open && isDeleting) return;
          setShowDeleteDialog(open);

          // If the dialog is closing (cancel/outside click/escape), resume playback
          if (!open) {
            setIsPaused(false);
            if (videoRef.current) videoRef.current.play().catch(() => {});
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
            <AlertDialogCancel 
              disabled={isDeleting}
              onClick={() => {
                setShowDeleteDialog(false);
                setIsPaused(false);
                if (videoRef.current) videoRef.current.play().catch(() => {});
              }}
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                // Prevent Radix from auto-closing the dialog so we can show loading state
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
