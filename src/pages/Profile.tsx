import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import Header from '@/components/Header';
import MobileNav from '@/components/MobileNav';
import FollowersDialog from '@/components/FollowersDialog';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Grid3X3, Settings } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

interface Post {
  id: string;
  image_url: string;
  created_at: string;
}

const Profile = () => {
  const { user, profile, isAdmin } = useAuth();
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
      // Fetch user posts
      const { data: postsData, count: postsCount } = await supabase
        .from('posts')
        .select('id, image_url, created_at', { count: 'exact' })
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      setPosts(postsData || []);

      // Fetch followers count
      const { count: followersCount } = await supabase
        .from('followers')
        .select('*', { count: 'exact', head: true })
        .eq('following_id', user.id);

      // Fetch following count
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

  if (!user || !profile) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="pt-[calc(4rem+3.5rem)] pb-20 flex items-center justify-center">
          <p className="text-muted-foreground">Loading...</p>
        </div>
        <MobileNav />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main className="pt-[calc(4rem+3.5rem)] pb-20 md:pb-8">
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
                <h1 className="text-xl font-semibold">
                  {profile.username || profile.full_name}
                </h1>
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

          {/* Posts Section */}
          <div className="w-full">
            <div className="flex items-center gap-2 mb-4 border-b border-border pb-2">
              <Grid3X3 className="w-4 h-4" />
              <span className="text-sm font-medium">Posts</span>
            </div>

            {loading ? (
              <div className="grid grid-cols-3 gap-1">
                {Array.from({ length: 9 }).map((_, i) => (
                  <Skeleton key={i} className="aspect-square" />
                ))}
              </div>
            ) : posts.length === 0 ? (
              <div className="text-center py-12">
                <Grid3X3 className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="font-semibold mb-2">No Posts Yet</h3>
                <p className="text-muted-foreground text-sm mb-4">
                  Share your first photo with the community
                </p>
                <Button asChild className="gradient-maroon text-primary-foreground">
                  <Link to="/create">Create Post</Link>
                </Button>
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-1">
                {posts.map((post) => (
                  <Link
                    key={post.id}
                    to={`/post/${post.id}`}
                    className="aspect-square bg-muted overflow-hidden"
                  >
                    <img
                      src={post.image_url}
                      alt=""
                      className="w-full h-full object-cover hover:opacity-80 transition-opacity"
                    />
                  </Link>
                ))}
              </div>
            )}
          </div>
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
