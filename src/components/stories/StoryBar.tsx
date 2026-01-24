import { useState, useEffect } from 'react';
import { Plus } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import StoryViewer from './StoryViewer';
import StoryUpload from './StoryUpload';

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

  useEffect(() => {
    fetchStories();
  }, [user]);

  const fetchStories = async () => {
    try {
      // Fetch all active stories - chronological order (first uploaded = first)
      const { data: stories, error } = await supabase
        .from('stories')
        .select('*')
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: true }); // Changed to ascending for chronological order

      if (error) throw error;

      if (!stories || stories.length === 0) {
        setStoryUsers([]);
        setMyStories([]);
        return;
      }

      // Get unique user IDs
      const userIds = [...new Set(stories.map(s => s.user_id))];

      // Fetch profiles
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, avatar_url, username, full_name')
        .in('user_id', userIds);

      const profilesMap = new Map(
        (profiles || []).map(p => [p.user_id, p])
      );

      // Fetch user's story views to determine seen status
      let viewedStoryIds: Set<string> = new Set();
      if (user) {
        const { data: views } = await supabase
          .from('story_views')
          .select('story_id')
          .eq('viewer_id', user.id);
        
        if (views) {
          viewedStoryIds = new Set(views.map(v => v.story_id));
        }
      }

      // Group stories by user (maintaining chronological order)
      const userStoriesMap = new Map<string, Story[]>();
      stories.forEach(story => {
        const existing = userStoriesMap.get(story.user_id) || [];
        userStoriesMap.set(story.user_id, [...existing, story]);
      });

      // Build story users array with seen status
      const users: StoryUser[] = [];
      userStoriesMap.forEach((userStories, userId) => {
        const profile = profilesMap.get(userId);
        // User has seen all stories if all their stories are in viewedStoryIds
        const hasSeen = userStories.every(story => viewedStoryIds.has(story.id));
        users.push({
          user_id: userId,
          avatar_url: profile?.avatar_url || null,
          username: profile?.username || null,
          full_name: profile?.full_name || null,
          stories: userStories,
          hasSeen
        });
      });

      // Set my stories separately
      if (user) {
        const mine = stories.filter(s => s.user_id === user.id);
        setMyStories(mine);
      }

      // Filter out current user from the list (will show separately)
      // Sort: unseen stories first, then seen stories
      const otherUsers = users
        .filter(u => u.user_id !== user?.id)
        .sort((a, b) => {
          if (a.hasSeen === b.hasSeen) return 0;
          return a.hasSeen ? 1 : -1;
        });
      setStoryUsers(otherUsers);
    } catch (error) {
      console.error('Error fetching stories:', error);
    }
  };

  const handleStoryClick = (storyUser: StoryUser) => {
    setViewingUser(storyUser);
  };

  const handleViewMyStory = () => {
    if (myStories.length > 0 && user && profile) {
      setViewingUser({
        user_id: user.id,
        avatar_url: profile.avatar_url,
        username: profile.username,
        full_name: profile.full_name,
        stories: myStories
      });
    }
  };

  return (
    <>
      <div className="bg-transparent px-4 py-3">
        <div className="max-w-lg mx-auto">
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
                    <AvatarImage src={profile?.avatar_url || undefined} />
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
    </>
  );
};

export default StoryBar;
