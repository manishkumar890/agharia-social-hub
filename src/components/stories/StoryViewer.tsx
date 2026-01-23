import { useState, useEffect, useCallback } from 'react';
import { X, ChevronLeft, ChevronRight, Eye } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { formatDistanceToNow } from 'date-fns';

interface Story {
  id: string;
  user_id: string;
  media_url: string;
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

const StoryViewer = ({ storyUser, onClose, onRefresh }: StoryViewerProps) => {
  const { user } = useAuth();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [viewCount, setViewCount] = useState(0);

  const currentStory = storyUser.stories[currentIndex];
  const isOwnStory = user?.id === storyUser.user_id;

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

  // Fetch view count for own stories
  useEffect(() => {
    if (!isOwnStory) return;

    const fetchViewCount = async () => {
      const { count } = await supabase
        .from('story_views')
        .select('*', { count: 'exact', head: true })
        .eq('story_id', currentStory.id);
      
      setViewCount(count || 0);
    };

    fetchViewCount();
  }, [currentStory.id, isOwnStory]);

  const goToNext = useCallback(() => {
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
    if (isPaused) return;

    const duration = currentStory.duration * 1000; // Convert to ms
    const interval = 50; // Update every 50ms
    const increment = (interval / duration) * 100;

    const timer = setInterval(() => {
      setProgress(prev => {
        if (prev >= 100) {
          goToNext();
          return 0;
        }
        return prev + increment;
      });
    }, interval);

    return () => clearInterval(timer);
  }, [currentStory.duration, isPaused, goToNext]);

  // Reset progress when story changes
  useEffect(() => {
    setProgress(0);
  }, [currentIndex]);

  const handleTouchStart = () => setIsPaused(true);
  const handleTouchEnd = () => setIsPaused(false);

  return (
    <div className="fixed inset-0 z-[100] bg-black flex items-center justify-center">
      {/* Progress bars */}
      <div className="absolute top-2 left-2 right-2 flex gap-1 z-10">
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
      <div className="absolute top-6 left-0 right-0 px-4 flex items-center justify-between z-10">
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
        <img
          src={currentStory.media_url}
          alt="Story"
          className="max-w-full max-h-full object-contain"
        />
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
          className="absolute left-4 top-1/2 -translate-y-1/2 text-white hover:bg-white/20 hidden md:flex"
        >
          <ChevronLeft className="w-8 h-8" />
        </Button>
      )}
      {currentIndex < storyUser.stories.length - 1 && (
        <Button
          variant="ghost"
          size="icon"
          onClick={goToNext}
          className="absolute right-4 top-1/2 -translate-y-1/2 text-white hover:bg-white/20 hidden md:flex"
        >
          <ChevronRight className="w-8 h-8" />
        </Button>
      )}

      {/* View count for own stories */}
      {isOwnStory && (
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-2 text-white">
          <Eye className="w-5 h-5" />
          <span className="text-sm">{viewCount} views</span>
        </div>
      )}
    </div>
  );
};

export default StoryViewer;
