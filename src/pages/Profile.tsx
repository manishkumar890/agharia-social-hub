import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useSubscription } from '@/contexts/SubscriptionContext';
import Header from '@/components/Header';
import MobileNav from '@/components/MobileNav';
import FollowersDialog from '@/components/FollowersDialog';
import VerificationBadge from '@/components/VerificationBadge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Grid3X3, Image, Video, Settings } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

interface Post {
  id: string;
  image_url: string;
  created_at: string;
  media_type: string;
  thumbnail_url?: string | null;
}

const Profile = () => {
  const { user, profile, isAdmin } = useAuth();
  const { isPremium } = useSubscription();
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ posts: 0, followers: 0, following: 0 });
  const [followersOpen, setFollowersOpen] = useState(false);
  const [followingOpen, setFollowingOpen] = useState(false);

  useEffect(() => {
    if (user) {
      fetchUserData();
    }
  }, [user]);

  const fetchUserData = async () => {
    if (!user) return;

    try {
      const { data: postsData, count: postsCount } = await supabase
        .from('posts')
        .select('id, image_url, created_at, media_type, thumbnail_url', { count: 'exact' })
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      setPosts(postsData || []);

      const { count: followersCount } = await supabase
        .from('followers')
        .select('*', { count: 'exact', head: true })
        .eq('following_id', user.id);

      const { count: followingCount } = await supabase
        .from('followers')
        .select('*', { count: 'exact', head: true })
        .eq('follower_id', user.id);

      setStats({
        posts: postsCount || 0,
        followers: followersCount || 0,
        following: followingCount || 0,
      });
    } catch (error) {
      console.error('Error fetching user data:', error);
    } finally {
      setLoading(false);
    }
  };

  const imagePosts = posts.filter(p => p.media_type === 'image' || !p.media_type);
  const videoPosts = posts.filter(p => p.media_type === 'video');

  if (!user || !profile) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="pt-14 pb-20 flex items-center justify-center">
          <p className="text-muted-foreground">Loading...</p>
        </div>
        <MobileNav />
      </div>
    );
  }

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
          <h3 className="font-semibold mb-2">No Posts Yet</h3>
          <p className="text-muted-foreground text-sm mb-4">
            Share your first photo or video with the community
          </p>
          <Button asChild className="gradient-maroon text-primary-foreground">
            <Link to="/create">Create Post</Link>
          </Button>
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

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main className="pt-14 pb-20 md:pb-8">
        <div className="max-w-4xl mx-auto px-4 py-6">
          {/* Profile Header */}
          <div className="flex flex-col md:flex-row items-center md:items-start gap-6 md:gap-12 mb-8">
            <Avatar className="w-24 h-24 md:w-36 md:h-36 border-4 border-primary/30">
              <AvatarImage src={profile.avatar_url || undefined} />
              <AvatarFallback className="bg-primary text-primary-foreground text-3xl font-display">
                {profile.full_name?.charAt(0) || 'U'}
              </AvatarFallback>
            </Avatar>

            <div className="flex-1 text-center md:text-left">
              <div className="flex flex-col md:flex-row items-center gap-4 mb-4">
                <div className="flex items-center gap-2">
                  <h1 className="text-xl font-semibold">
                    {profile.username || profile.full_name}
                  </h1>
                  <VerificationBadge isPremium={isPremium} isOwnProfile={true} size="lg" />
                </div>
                <Button variant="outline" size="sm" asChild>
                  <Link to="/settings">
                    <Settings className="w-4 h-4 mr-2" />
                    Edit Profile
                  </Link>
                </Button>
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
                <p className="text-sm text-muted-foreground">📱 +91 {profile.phone}</p>
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
      {user && (
        <>
          <FollowersDialog
            userId={user.id}
            type="followers"
            open={followersOpen}
            onOpenChange={setFollowersOpen}
          />
          <FollowersDialog
            userId={user.id}
            type="following"
            open={followingOpen}
            onOpenChange={setFollowingOpen}
          />
        </>
      )}
    </div>
  );
};

export default Profile;
