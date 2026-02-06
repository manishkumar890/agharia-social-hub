import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import Header from '@/components/Header';
import MobileNav from '@/components/MobileNav';
import FollowersDialog from '@/components/FollowersDialog';
import VerificationBadge from '@/components/VerificationBadge';
import VIPCard from '@/components/VIPCard';
import StoryViewer from '@/components/stories/StoryViewer';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogTrigger, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Grid3X3, Image, Video, Loader2, MessageCircle, Crown, UserPlus } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';

interface Profile {
  id: string;
  user_id: string;
  phone: string;
  full_name: string | null;
  username: string | null;
  avatar_url: string | null;
  bio: string | null;
  dob?: string | null;
  register_no?: string | null;
}

interface Post {
  id: string;
  image_url: string;
  media_type: string;
  thumbnail_url?: string | null;
}

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

const UserProfile = () => {
  const { userId } = useParams<{ userId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [stats, setStats] = useState({ posts: 0, followers: 0, following: 0 });
  const [isFollowing, setIsFollowing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [followLoading, setFollowLoading] = useState(false);
  const [followersOpen, setFollowersOpen] = useState(false);
  const [followingOpen, setFollowingOpen] = useState(false);
  const [isPremiumUser, setIsPremiumUser] = useState(false);
  const [userStories, setUserStories] = useState<Story[]>([]);
  const [showStoryViewer, setShowStoryViewer] = useState(false);
  const [showFollowPopup, setShowFollowPopup] = useState(false);

  const isOwnProfile = user?.id === userId;

  useEffect(() => {
    if (userId) {
      fetchUserData();
      fetchUserStories();
    }
  }, [userId, user]);

  const fetchUserStories = async () => {
    if (!userId) return;
    try {
      const { data: stories } = await supabase
        .from('stories')
        .select('*')
        .eq('user_id', userId)
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: true });
      
      setUserStories(stories || []);
    } catch (error) {
      console.error('Error fetching user stories:', error);
    }
  };

  const fetchUserData = async () => {
    try {
      const { data: profileData } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (profileData) {
        setProfile(profileData);
      }

      const { data: postsData, count: postsCount } = await supabase
        .from('posts')
        .select('id, image_url, media_type, thumbnail_url', { count: 'exact' })
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      setPosts(postsData || []);

      const { count: followersCount } = await supabase
        .from('followers')
        .select('*', { count: 'exact', head: true })
        .eq('following_id', userId);

      const { count: followingCount } = await supabase
        .from('followers')
        .select('*', { count: 'exact', head: true })
        .eq('follower_id', userId);

      setStats({
        posts: postsCount || 0,
        followers: followersCount || 0,
        following: followingCount || 0,
      });

      if (user && userId !== user.id) {
        const { data: followData } = await supabase
          .from('followers')
          .select('id')
          .eq('follower_id', user.id)
          .eq('following_id', userId)
          .single();

        setIsFollowing(!!followData);
      }

      const { data: subscriptionData } = await supabase
        .from('user_subscriptions')
        .select('plan_type')
        .eq('user_id', userId)
        .single();

      setIsPremiumUser(subscriptionData?.plan_type === 'premium');
    } catch (error) {
      console.error('Error fetching user data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleFollow = async () => {
    if (!user || !userId) return;

    setFollowLoading(true);

    try {
      if (isFollowing) {
        await supabase
          .from('followers')
          .delete()
          .eq('follower_id', user.id)
          .eq('following_id', userId);

        setIsFollowing(false);
        setStats(prev => ({ ...prev, followers: prev.followers - 1 }));
        toast.success('Unfollowed');
      } else {
        await supabase
          .from('followers')
          .insert({
            follower_id: user.id,
            following_id: userId,
          });

        setIsFollowing(true);
        setStats(prev => ({ ...prev, followers: prev.followers + 1 }));
        toast.success('Following!');
      }
    } catch (error) {
      console.error('Follow error:', error);
    } finally {
      setFollowLoading(false);
    }
  };

  const handleMessage = async () => {
    if (!user || !userId) return;

    // Check if conversation already exists
    const { data: existingConv } = await supabase
      .from('conversations')
      .select('id')
      .or(`and(participant_1.eq.${user.id},participant_2.eq.${userId}),and(participant_1.eq.${userId},participant_2.eq.${user.id})`)
      .single();

    if (existingConv) {
      navigate(`/messages/${existingConv.id}`);
      return;
    }

    // Create new conversation
    const { data: newConv, error } = await supabase
      .from('conversations')
      .insert({
        participant_1: user.id,
        participant_2: userId
      })
      .select('id')
      .single();

    if (error) {
      toast.error('Failed to start conversation');
      return;
    }

    navigate(`/messages/${newConv.id}`);
  };

  const imagePosts = posts.filter(p => p.media_type === 'image' || !p.media_type);
  const videoPosts = posts.filter(p => p.media_type === 'video');

  const renderPostGrid = (postsToRender: Post[]) => {
    if (loading) {
      return (
        <div className="grid grid-cols-3 gap-1">
          {Array.from({ length: 9 }).map((_, i) => (
            <Skeleton key={i} className="aspect-square" />
          ))}
        </div>
      );
    }

    if (postsToRender.length === 0) {
      return (
        <div className="text-center py-12">
          <Grid3X3 className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">No posts yet</p>
        </div>
      );
    }

    return (
      <div className="grid grid-cols-3 gap-1">
        {postsToRender.map((post) => (
          <Link
            key={post.id}
            to={`/post/${post.id}`}
            className="aspect-square bg-muted overflow-hidden relative"
          >
            {post.media_type === 'video' ? (
              <>
                {post.thumbnail_url ? (
                  <img
                    src={post.thumbnail_url}
                    alt=""
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <video
                    src={post.image_url}
                    className="w-full h-full object-cover"
                    preload="metadata"
                  />
                )}
                <div className="absolute top-2 right-2">
                  <Video className="w-4 h-4 text-white drop-shadow-lg" />
                </div>
              </>
            ) : (
              <img
                src={post.image_url}
                alt=""
                className="w-full h-full object-cover hover:opacity-80 transition-opacity"
              />
            )}
          </Link>
        ))}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="pt-14 pb-20 flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
        <MobileNav />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="pt-14 pb-20 text-center py-12">
          <p className="text-muted-foreground">User not found</p>
        </div>
        <MobileNav />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main className="pt-14 pb-20 md:pb-8">
        <div className="max-w-4xl mx-auto px-4 py-6">
          {/* Profile Header */}
          <div className="flex flex-col md:flex-row items-center md:items-start gap-6 md:gap-12 mb-8">
            {/* Profile Avatar with Story Ring */}
            <button
              onClick={() => {
                if (userStories.length > 0) {
                  // Allow viewing if own profile or following
                  if (isOwnProfile || isFollowing) {
                    setShowStoryViewer(true);
                  } else {
                    setShowFollowPopup(true);
                  }
                }
              }}
              disabled={userStories.length === 0}
              className={`w-24 h-24 md:w-36 md:h-36 rounded-full p-1 ${
                userStories.length > 0 
                  ? 'bg-gradient-to-tr from-primary to-accent cursor-pointer' 
                  : 'bg-muted cursor-default'
              }`}
            >
              <Avatar className="w-full h-full border-2 border-card">
                <AvatarImage src={profile.avatar_url || undefined} />
                <AvatarFallback className="bg-primary text-primary-foreground text-3xl font-display">
                  {profile.full_name?.charAt(0) || 'U'}
                </AvatarFallback>
              </Avatar>
            </button>

            <div className="flex-1 text-center md:text-left">
              <div className="flex flex-col md:flex-row items-center gap-4 mb-4">
                <div className="flex items-center gap-2">
                  <h1 className="text-xl font-semibold">
                    {profile.username || profile.full_name}
                  </h1>
                  {isPremiumUser && <VerificationBadge isPremium={true} isOwnProfile={false} size="lg" />}
                </div>
                {isPremiumUser && (
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button variant="outline" size="sm" className="gap-2 border-amber-500/50 text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/30">
                        <Crown className="w-4 h-4" />
                        VIP Card
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-md bg-transparent border-none shadow-none overflow-visible [&>button]:absolute [&>button]:-top-3 [&>button]:-right-3 [&>button]:bg-white [&>button]:rounded-full [&>button]:p-1.5 [&>button]:shadow-lg [&>button]:z-50 [&>button]:border [&>button]:border-border/30">
                      <VIPCard
                        fullName={profile.full_name || ''}
                        username={profile.username || ''}
                        avatarUrl={profile.avatar_url}
                        registerNo={profile.register_no}
                        isOwner={isOwnProfile}
                      />
                    </DialogContent>
                  </Dialog>
                )}
                {!isOwnProfile && (
                  <div className="flex gap-2">
                    <Button
                      onClick={handleFollow}
                      disabled={followLoading}
                      variant={isFollowing ? 'outline' : 'default'}
                      className={!isFollowing ? 'gradient-maroon text-primary-foreground' : ''}
                    >
                      {followLoading ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : isFollowing ? (
                        'Following'
                      ) : (
                        'Follow'
                      )}
                    </Button>
                    <Button
                      onClick={handleMessage}
                      variant="outline"
                      className="flex items-center gap-2"
                    >
                      <MessageCircle className="w-4 h-4" />
                      Message
                    </Button>
                  </div>
                )}
              </div>

              {/* Stats */}
              <div className="flex justify-center md:justify-start gap-8 mb-4">
                <div className="text-center">
                  <span className="font-bold">{stats.posts}</span>
                  <p className="text-sm text-muted-foreground">posts</p>
                </div>
                <button 
                  onClick={() => setFollowersOpen(true)}
                  className="text-center hover:opacity-70 transition-opacity"
                >
                  <span className="font-bold">{stats.followers}</span>
                  <p className="text-sm text-muted-foreground">followers</p>
                </button>
                <button 
                  onClick={() => setFollowingOpen(true)}
                  className="text-center hover:opacity-70 transition-opacity"
                >
                  <span className="font-bold">{stats.following}</span>
                  <p className="text-sm text-muted-foreground">following</p>
                </button>
              </div>

              {/* Bio */}
              <div>
                <p className="font-semibold">{profile.full_name}</p>
                {profile.bio && <p className="text-sm text-muted-foreground">{profile.bio}</p>}
              </div>
            </div>
          </div>

          {/* Posts Section with Tabs */}
          <Tabs defaultValue="all" className="w-full">
            <TabsList className="grid w-full grid-cols-3 mb-4">
              <TabsTrigger value="all" className="flex items-center gap-2">
                <Grid3X3 className="w-4 h-4" />
                <span className="hidden sm:inline">All</span>
              </TabsTrigger>
              <TabsTrigger value="images" className="flex items-center gap-2">
                <Image className="w-4 h-4" />
                <span className="hidden sm:inline">Images</span>
              </TabsTrigger>
              <TabsTrigger value="videos" className="flex items-center gap-2">
                <Video className="w-4 h-4" />
                <span className="hidden sm:inline">Videos</span>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="all">
              {renderPostGrid(posts)}
            </TabsContent>

            <TabsContent value="images">
              {renderPostGrid(imagePosts)}
            </TabsContent>

            <TabsContent value="videos">
              {renderPostGrid(videoPosts)}
            </TabsContent>
          </Tabs>
        </div>
      </main>

      <MobileNav />

      {/* Followers/Following Dialogs */}
      {userId && (
        <>
          <FollowersDialog
            userId={userId}
            type="followers"
            open={followersOpen}
            onOpenChange={setFollowersOpen}
          />
          <FollowersDialog
            userId={userId}
            type="following"
            open={followingOpen}
            onOpenChange={setFollowingOpen}
          />
        </>
      )}

      {/* Story Viewer */}
      {showStoryViewer && profile && userId && (
        <StoryViewer
          storyUser={{
            user_id: userId,
            avatar_url: profile.avatar_url,
            username: profile.username,
            full_name: profile.full_name,
            stories: userStories
          }}
          onClose={() => setShowStoryViewer(false)}
          onRefresh={fetchUserStories}
        />
      )}

      {/* Follow to View Story Popup */}
      <Dialog open={showFollowPopup} onOpenChange={setShowFollowPopup}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="w-5 h-5 text-primary" />
              Follow to View Story
            </DialogTitle>
            <DialogDescription>
              Follow @{profile.username || profile.full_name} to view their stories and stay updated with their content.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-3 mt-4">
            <Button
              onClick={async () => {
                await handleFollow();
                setShowFollowPopup(false);
                // After following, show the story
                if (userStories.length > 0) {
                  setShowStoryViewer(true);
                }
              }}
              disabled={followLoading}
              className="gradient-maroon text-primary-foreground"
            >
              {followLoading ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <UserPlus className="w-4 h-4 mr-2" />
              )}
              Follow {profile.username || profile.full_name}
            </Button>
            <Button variant="outline" onClick={() => setShowFollowPopup(false)}>
              Maybe Later
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default UserProfile;
