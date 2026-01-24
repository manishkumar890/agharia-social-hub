import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import Header from '@/components/Header';
import MobileNav from '@/components/MobileNav';
import { Bookmark } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

interface SavedPost {
  id: string;
  post_id: string;
  posts: {
    id: string;
    image_url: string;
  };
}

const Saved = () => {
  const { user } = useAuth();
  const [savedPosts, setSavedPosts] = useState<SavedPost[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchSavedPosts();
    }
  }, [user]);

  const fetchSavedPosts = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('saved_posts')
        .select(`
          id,
          post_id,
          posts (
            id,
            image_url
          )
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setSavedPosts(data || []);
    } catch (error) {
      console.error('Error fetching saved posts:', error);
    } finally {
      setLoading(false);
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="pt-[calc(4rem+3.5rem)] pb-20 flex items-center justify-center">
          <p className="text-muted-foreground">Please sign in to view saved posts.</p>
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
          <div className="flex items-center gap-3 mb-6">
            <Bookmark className="w-6 h-6 text-primary" />
            <h1 className="text-2xl font-display font-semibold">Saved Posts</h1>
          </div>

          {loading ? (
            <div className="grid grid-cols-3 gap-1">
              {Array.from({ length: 9 }).map((_, i) => (
                <Skeleton key={i} className="aspect-square" />
              ))}
            </div>
          ) : savedPosts.length === 0 ? (
            <div className="text-center py-12">
              <Bookmark className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="font-semibold mb-2">No Saved Posts</h3>
              <p className="text-muted-foreground text-sm">
                Posts you save will appear here
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-1">
              {savedPosts.map((saved) => (
                <Link
                  key={saved.id}
                  to={`/post/${saved.posts.id}`}
                  className="aspect-square bg-muted overflow-hidden"
                >
                  <img
                    src={saved.posts.image_url}
                    alt=""
                    className="w-full h-full object-cover hover:opacity-80 transition-opacity"
                  />
                </Link>
              ))}
            </div>
          )}
        </div>
      </main>

      <MobileNav />
    </div>
  );
};

export default Saved;
