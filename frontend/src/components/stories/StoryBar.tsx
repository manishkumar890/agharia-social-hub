import { useState, useEffect } from 'react';
import { Plus, UserPlus } from 'lucide-react';
import { storiesApi, followApi, uploadApi } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import StoryViewer from './StoryViewer';
import StoryUpload from './StoryUpload';
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
  hasSeen?: boolean;
}

const StoryBar = () => {
  const { user, profile } = useAuth();
  const [storyUsers, setStoryUsers] = useState<StoryUser[]>([]);
  const [viewingUser, setViewingUser] = useState<StoryUser | null>(null);
  const [showUpload, setShowUpload] = useState(false);
  const [myStories, setMyStories] = useState<Story[]>([]);
  const [followingIds, setFollowingIds] = useState<Set<string>>(new Set());
  const [showFollowPrompt, setShowFollowPrompt] = useState(false);
  const [pendingStoryUser, setPendingStoryUser] = useState<StoryUser | null>(null);
  const [isFollowing, setIsFollowing] = useState(false);

  // Fetch users the current user is following
  const fetchFollowing = async () => {
    if (!user || !profile) {
      setFollowingIds(new Set());
      return;
    }

    try {
      const data = await followApi.getFollowing(profile.user_id);
      setFollowingIds(new Set(data.map((f: any) => f.user_id)));
    } catch (error) {
      console.error('Error fetching following:', error);
    }
  };

  // Fetch following first, then stories
  useEffect(() => {
    fetchFollowing();
  }, [user, profile]);

  // Fetch stories when followingIds changes
  useEffect(() => {
    fetchStories();
    
    // Poll for updates every 30 seconds
    const interval = setInterval(fetchStories, 30000);
    return () => clearInterval(interval);
  }, [user, profile, followingIds]);

  const fetchStories = async () => {
    try {
      const stories = await storiesApi.getStories();

      if (!stories || stories.length === 0) {
        setStoryUsers([]);
        setMyStories([]);
        return;
      }

      // Transform URLs
      const transformedStories = stories.map((s: any) => ({
        ...s,
        media_url: uploadApi.getFileUrl(s.media_url)
      }));

      // Group stories by user
      const userStoriesMap = new Map<string, any>();
      transformedStories.forEach((story: any) => {
        const userId = story.user_id;
        const existing = userStoriesMap.get(userId);
        
        if (existing) {
          existing.stories.push(story);
        } else {
          userStoriesMap.set(userId, {
            user_id: userId,
            avatar_url: story.profiles?.avatar_url ? uploadApi.getFileUrl(story.profiles.avatar_url) : null,
            username: story.profiles?.username || null,
            full_name: story.profiles?.full_name || null,
            stories: [story],
            hasSeen: story.is_viewed || false
          });
        }
      });

      // Set my stories separately
      if (profile) {
        const mine = transformedStories.filter((s: Story) => s.user_id === profile.user_id);
        setMyStories(mine);
      }

      // Filter out current user from the list
      // Only show stories from users that the current user follows
      const otherUsers = Array.from(userStoriesMap.values())
        .filter((u: StoryUser) => u.user_id !== profile?.user_id)
        .filter((u: StoryUser) => followingIds.has(u.user_id))
        .sort((a: StoryUser, b: StoryUser) => {
          if (a.hasSeen === b.hasSeen) return 0;
          return a.hasSeen ? 1 : -1;
        });

      setStoryUsers(otherUsers);
    } catch (error) {
      console.error('Error fetching stories:', error);
    }
  };

  const handleStoryClick = (storyUser: StoryUser) => {
    // Own story - always viewable
    if (storyUser.user_id === profile?.user_id) {
      setViewingUser(storyUser);
      return;
    }

    // Check if user follows this story owner
    if (followingIds.has(storyUser.user_id)) {
      setViewingUser(storyUser);
    } else {
      // Show follow prompt
      setPendingStoryUser(storyUser);
      setShowFollowPrompt(true);
    }
  };

  const handleFollow = async () => {
    if (!profile || !pendingStoryUser) return;

    setIsFollowing(true);
    try {
      await followApi.toggleFollow(pendingStoryUser.user_id);

      // Update local state
      setFollowingIds(prev => new Set([...prev, pendingStoryUser.user_id]));
      toast.success(`You are now following ${pendingStoryUser.username || pendingStoryUser.full_name || 'this user'}`);
      
      // Close dialog and open story viewer
      setShowFollowPrompt(false);
      setViewingUser(pendingStoryUser);
      setPendingStoryUser(null);
    } catch (error) {
      console.error('Error following user:', error);
      toast.error('Failed to follow user');
    } finally {
      setIsFollowing(false);
    }
  };

  const handleViewMyStory = () => {
    if (myStories.length > 0 && profile) {
      setViewingUser({
        user_id: profile.user_id,
        avatar_url: profile.avatar_url ? uploadApi.getFileUrl(profile.avatar_url) : null,
        username: profile.username,
        full_name: profile.full_name,
        stories: myStories
      });
    }
  };

  const avatarUrl = profile?.avatar_url ? uploadApi.getFileUrl(profile.avatar_url) : undefined;

  return (
    <>
      <div className="bg-transparent px-4 py-3">
        <div className="max-w-xl lg:max-w-2xl mx-auto">
          <div className="flex gap-4 overflow-x-auto scrollbar-hide pb-1">
            {/* My Story / Add Story */}
            <div className="flex flex-col items-center gap-1 flex-shrink-0">
              <div className="relative">
                <button
                  onClick={() => myStories.length > 0 ? handleViewMyStory() : setShowUpload(true)}
                  className={`w-16 h-16 rounded-full p-0.5 ${
                    myStories.length > 0 
                      ? 'bg-gradient-to-tr from-primary to-accent' 
                      : 'bg-muted'
                  }`}
                >
                  <Avatar className="w-full h-full border-2 border-card">
                    <AvatarImage src={avatarUrl} />
                    <AvatarFallback className="bg-primary text-primary-foreground">
                      {profile?.full_name?.charAt(0) || 'U'}
                    </AvatarFallback>
                  </Avatar>
                </button>
                {/* Always show add button */}
                <button
                  onClick={() => setShowUpload(true)}
                  className="absolute -bottom-1 -right-1 w-6 h-6 bg-primary rounded-full flex items-center justify-center border-2 border-card"
                >
                  <Plus className="w-4 h-4 text-primary-foreground" />
                </button>
              </div>
              <span className="text-xs text-muted-foreground truncate w-16 text-center">
                Your Story
              </span>
            </div>

            {/* Other users' stories */}
            {storyUsers.map((storyUser) => (
              <div 
                key={storyUser.user_id} 
                className="flex flex-col items-center gap-1 flex-shrink-0"
              >
                <button
                  onClick={() => handleStoryClick(storyUser)}
                  className={`w-16 h-16 rounded-full p-0.5 ${
                    storyUser.hasSeen 
                      ? 'bg-muted-foreground/40' // Gray ring for seen stories
                      : 'bg-gradient-to-tr from-primary to-accent' // Colorful ring for unseen
                  }`}
                >
                  <Avatar className="w-full h-full border-2 border-card">
                    <AvatarImage src={storyUser.avatar_url || undefined} />
                    <AvatarFallback className="bg-primary text-primary-foreground">
                      {storyUser.full_name?.charAt(0) || storyUser.username?.charAt(0) || 'U'}
                    </AvatarFallback>
                  </Avatar>
                </button>
                <span className="text-xs text-muted-foreground truncate w-16 text-center">
                  {storyUser.username || storyUser.full_name || 'User'}
                </span>
              </div>
            ))}

            {/* Empty state */}
            {storyUsers.length === 0 && myStories.length === 0 && (
              <div className="flex items-center text-sm text-muted-foreground pl-4">
                No stories yet. Be the first to share!
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Story Viewer Modal */}
      {viewingUser && (
        <StoryViewer
          storyUser={viewingUser}
          onClose={() => setViewingUser(null)}
          onRefresh={fetchStories}
        />
      )}

      {/* Story Upload Modal */}
      {showUpload && (
        <StoryUpload
          onClose={() => setShowUpload(false)}
          onSuccess={() => {
            setShowUpload(false);
            fetchStories();
          }}
        />
      )}

      {/* Follow Prompt Dialog */}
      <Dialog open={showFollowPrompt} onOpenChange={setShowFollowPrompt}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="w-5 h-5 text-primary" />
              Follow to View Story
            </DialogTitle>
            <DialogDescription>
              Follow {pendingStoryUser?.username || pendingStoryUser?.full_name || 'this user'} to view their stories
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col items-center gap-4 py-4">
            <Avatar className="w-20 h-20 border-4 border-primary/20">
              <AvatarImage src={pendingStoryUser?.avatar_url || undefined} />
              <AvatarFallback className="bg-primary text-primary-foreground text-2xl">
                {pendingStoryUser?.full_name?.charAt(0) || pendingStoryUser?.username?.charAt(0) || 'U'}
              </AvatarFallback>
            </Avatar>
            <p className="font-semibold text-lg">
              {pendingStoryUser?.full_name || pendingStoryUser?.username || 'User'}
            </p>
            {pendingStoryUser?.username && pendingStoryUser?.full_name && (
              <p className="text-muted-foreground text-sm">@{pendingStoryUser.username}</p>
            )}
          </div>
          <div className="flex gap-3">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => {
                setShowFollowPrompt(false);
                setPendingStoryUser(null);
              }}
            >
              Cancel
            </Button>
            <Button
              className="flex-1"
              onClick={handleFollow}
              disabled={isFollowing}
            >
              {isFollowing ? (
                <>
                  <span className="animate-spin mr-2">⏳</span>
                  Following...
                </>
              ) : (
                <>
                  <UserPlus className="w-4 h-4 mr-2" />
                  Follow & View
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default StoryBar;
