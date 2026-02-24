import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate, useLocation, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import Header from '@/components/Header';
import MobileNav from '@/components/MobileNav';
import PostCard from '@/components/PostCard';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Loader2 } from 'lucide-react';

interface Post {
  id: string;
  user_id: string;
  image_url: string;
  image_urls?: string[] | null;
  background_audio_url?: string | null;
  comments_enabled?: boolean;
  caption: string | null;
  location: string | null;
  created_at: string;
  media_type?: string;
  thumbnail_url?: string | null;
  profiles?: {
    full_name: string | null;
    username: string | null;
    avatar_url: string | null;
  };
}

const PostDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const targetPostRef = useRef<HTMLDivElement>(null);
  const hasScrolled = useRef(false);

  // Check if we have a userId from navigation state (coming from profile)
  const fromUserId = (location.state as any)?.userId as string | undefined;

  useEffect(() => {
    if (id) {
      fetchPosts();
    }
  }, [id, fromUserId]);

  // Scroll to the target post once loaded
  useEffect(() => {
    if (!loading && targetPostRef.current && !hasScrolled.current) {
      hasScrolled.current = true;
      setTimeout(() => {
        targetPostRef.current?.scrollIntoView({ behavior: 'instant', block: 'start' });
        // Offset for header
        window.scrollBy(0, -56);
      }, 100);
    }
  }, [loading, posts]);

  const fetchPosts = async () => {
    setLoading(true);
    
    if (fromUserId) {
      // Fetch all posts from this user
      const { data: postsData } = await supabase
        .from('posts')
        .select('*')
        .eq('user_id', fromUserId)
        .order('created_at', { ascending: false });

      if (postsData && postsData.length > 0) {
        // Fetch profile for this user
        const { data: profile } = await supabase
          .from('profiles')
          .select('full_name, username, avatar_url')
          .eq('user_id', fromUserId)
          .single();

        const enriched = postsData.map(p => ({ ...p, profiles: profile })) as Post[];
        setPosts(enriched);
      }
    } else {
      // Single post view (direct link)
      const { data } = await supabase
        .from('posts')
        .select('*')
        .eq('id', id)
        .single();

      if (data) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('full_name, username, avatar_url')
          .eq('user_id', data.user_id)
          .single();

        setPosts([{ ...data, profiles: profile } as Post]);
      }
    }
    
    setLoading(false);
  };

  const handleDelete = () => {
    setPosts(prev => prev.filter(p => p.id !== id));
    if (posts.length <= 1) {
      navigate(-1);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="pt-14 flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
        <MobileNav />
      </div>
    );
  }

  if (posts.length === 0) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="pt-14 text-center py-12">
          <p className="text-muted-foreground">Post not found</p>
          <Button variant="link" onClick={() => navigate('/')}>
            Go back home
          </Button>
        </div>
        <MobileNav />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main className="pt-[calc(44px+41px)] pb-20 md:pb-16">
        {/* Back Button - flush with header */}
        <div className="fixed top-[44px] left-0 right-0 z-40 bg-background border-b border-border px-4 py-2 flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="h-8 w-8">
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <span className="font-semibold text-sm">
            {fromUserId ? 'Posts' : 'Post'}
          </span>
        </div>

        <div className="max-w-lg mx-auto space-y-4 py-2">
          {posts.map((post) => (
            <div
              key={post.id}
              ref={post.id === id ? targetPostRef : undefined}
            >
              <PostCard post={post} onDelete={handleDelete} />
            </div>
          ))}
        </div>
      </main>

      <MobileNav />
    </div>
  );
};

export default PostDetail;
