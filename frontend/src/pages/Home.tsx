import { useState, useEffect, useCallback } from 'react';
import { postsApi, uploadApi } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import Header from '@/components/Header';
import MobileNav from '@/components/MobileNav';
import PostCard from '@/components/PostCard';
import StoryBar from '@/components/stories/StoryBar';
import { Skeleton } from '@/components/ui/skeleton';
import { RefreshCw } from 'lucide-react';
import CategorySlidePopup from '@/components/CategorySlidePopup';

interface Post {
  id: string;
  user_id: string;
  image_url: string;
  image_urls?: string[];
  caption: string | null;
  location: string | null;
  created_at: string;
  media_type?: string;
  likes_count?: number;
  comments_count?: number;
  is_liked?: boolean;
  is_saved?: boolean;
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

  const fetchPosts = useCallback(async () => {
    try {
      const data = await postsApi.getPosts({ limit: 30 });
      
      // Transform URLs for local storage
      const transformedPosts = data.map((post: Post) => ({
        ...post,
        image_url: uploadApi.getFileUrl(post.image_url),
        image_urls: post.image_urls?.map((url: string) => uploadApi.getFileUrl(url)),
        profiles: post.profiles ? {
          ...post.profiles,
          avatar_url: post.profiles.avatar_url ? uploadApi.getFileUrl(post.profiles.avatar_url) : null
        } : undefined
      }));
      
      setPosts(transformedPosts);
    } catch (error) {
      console.error('Error fetching posts:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPosts();
    
    // Poll for updates every 30 seconds
    const interval = setInterval(fetchPosts, 30000);
    
    return () => clearInterval(interval);
  }, [fetchPosts]);

  const handleDeletePost = (postId: string) => {
    setPosts(posts.filter(p => p.id !== postId));
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />

      {/* Content scrolls under the fixed navbar */}
      <main className="pt-14 pb-20 md:pb-16">
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
      <CategorySlidePopup />
    </div>
  );
};

export default Home;
