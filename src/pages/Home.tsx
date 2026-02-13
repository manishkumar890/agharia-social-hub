import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import Header from '@/components/Header';
import MobileNav from '@/components/MobileNav';
import PostCard from '@/components/PostCard';
import StoryBar from '@/components/stories/StoryBar';
import { Skeleton } from '@/components/ui/skeleton';
import { RefreshCw } from 'lucide-react';

interface Post {
  id: string;
  user_id: string;
  image_url: string;
  caption: string | null;
  location: string | null;
  created_at: string;
  profiles?: {
    full_name: string | null;
    username: string | null;
    avatar_url: string | null;
  };
}

const Home = () => {
  const { user } = useAuth();
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchPosts = async () => {
    try {
      // Fetch posts first
      const { data: postsData, error } = await supabase
        .from('posts')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      
      if (!postsData || postsData.length === 0) {
        setPosts([]);
        return;
      }

      // Get unique user IDs
      const userIds = [...new Set(postsData.map(p => p.user_id))];
      
      // Fetch profiles for these users
      const { data: profilesData } = await supabase
        .from('profiles')
        .select('user_id, full_name, username, avatar_url')
        .in('user_id', userIds);

      // Create a map for quick lookup
      const profilesMap = new Map(
        (profilesData || []).map(p => [p.user_id, p])
      );

      // Combine posts with profiles
      const postsWithProfiles: Post[] = postsData.map(post => ({
        ...post,
        profiles: profilesMap.get(post.user_id) || undefined
      }));

      setPosts(postsWithProfiles);
    } catch (error) {
      console.error('Error fetching posts:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPosts();

    // Subscribe to realtime updates
    const channel = supabase
      .channel('posts-feed')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'posts' },
        () => fetchPosts()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const handleDeletePost = (postId: string) => {
    setPosts(posts.filter(p => p.id !== postId));
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />

      {/* Content scrolls under the fixed navbar */}
      <main className="pt-14 pb-20 md:pb-8">
        {/* Story Bar (scrolls with posts) */}
        <StoryBar />

        <div className="max-w-xl lg:max-w-2xl mx-auto px-4">
          {/* Posts Feed */}
          <div className="space-y-6">
            {loading ? (
              // Loading skeletons
              Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="bg-card border border-border rounded-lg overflow-hidden">
                  <div className="p-3 flex items-center gap-3">
                    <Skeleton className="w-9 h-9 rounded-full" />
                    <Skeleton className="h-4 w-24" />
                  </div>
                  <Skeleton className="aspect-square w-full" />
                  <div className="p-3 space-y-2">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-3 w-20" />
                  </div>
                </div>
              ))
            ) : posts.length === 0 ? (
              <div className="text-center py-12">
                <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-muted flex items-center justify-center">
                  <RefreshCw className="w-8 h-8 text-muted-foreground" />
                </div>
                <h3 className="font-display text-lg font-semibold mb-2">No posts yet</h3>
                <p className="text-muted-foreground text-sm">
                  Be the first to share something with the community!
                </p>
              </div>
            ) : (
              posts.map((post) => (
                <PostCard 
                  key={post.id} 
                  post={post} 
                  onDelete={() => handleDeletePost(post.id)} 
                />
              ))
            )}
          </div>
        </div>
      </main>

      <MobileNav />
    </div>
  );
};

export default Home;
