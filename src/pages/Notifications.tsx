import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useNotifications } from '@/contexts/NotificationContext';
import Header from '@/components/Header';
import MobileNav from '@/components/MobileNav';
import ActivityItem from '@/components/notifications/ActivityItem';
import { Heart } from 'lucide-react';

interface Activity {
  id: string;
  type: 'like' | 'comment' | 'follow';
  user: {
    id: string;
    full_name: string | null;
    username: string | null;
    avatar_url: string | null;
  };
  post?: {
    id: string;
    image_url: string;
  };
  content?: string;
  created_at: string;
}

const Notifications = () => {
  const { user } = useAuth();
  const { markAsRead } = useNotifications();
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);

  // Mark notifications as read when page is visited
  useEffect(() => {
    markAsRead();
  }, [markAsRead]);

  useEffect(() => {
    if (user) {
      fetchActivities();
    }
  }, [user]);

  // Real-time subscriptions for live updates
  useEffect(() => {
    if (!user) return;

    const likesChannel = supabase
      .channel('activity-likes')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'likes' },
        () => fetchActivities()
      )
      .subscribe();

    const commentsChannel = supabase
      .channel('activity-comments')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'comments' },
        () => fetchActivities()
      )
      .subscribe();

    const followersChannel = supabase
      .channel('activity-followers')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'followers', filter: `following_id=eq.${user.id}` },
        () => fetchActivities()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(likesChannel);
      supabase.removeChannel(commentsChannel);
      supabase.removeChannel(followersChannel);
    };
  }, [user]);

  const fetchActivities = async () => {
    if (!user) return;

    try {
      // Fetch likes on user's posts
      const { data: likesData } = await supabase
        .from('likes')
        .select(`
          id,
          created_at,
          posts!inner (id, image_url, user_id),
          profiles:user_id (id, full_name, username, avatar_url)
        `)
        .eq('posts.user_id', user.id)
        .neq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(20);

      // Fetch comments on user's posts
      const { data: commentsData } = await supabase
        .from('comments')
        .select(`
          id,
          content,
          created_at,
          posts!inner (id, image_url, user_id),
          profiles:user_id (id, full_name, username, avatar_url)
        `)
        .eq('posts.user_id', user.id)
        .neq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(20);

      // Fetch followers
      const { data: followersData } = await supabase
        .from('followers')
        .select(`
          id,
          created_at,
          profiles:follower_id (id, full_name, username, avatar_url)
        `)
        .eq('following_id', user.id)
        .order('created_at', { ascending: false })
        .limit(20);

      // Combine and format activities
      const allActivities: Activity[] = [];

      likesData?.forEach((like: any) => {
        if (like.profiles) {
          allActivities.push({
            id: like.id,
            type: 'like',
            user: {
              id: like.profiles.id,
              full_name: like.profiles.full_name,
              username: like.profiles.username,
              avatar_url: like.profiles.avatar_url,
            },
            post: {
              id: like.posts.id,
              image_url: like.posts.image_url,
            },
            created_at: like.created_at,
          });
        }
      });

      commentsData?.forEach((comment: any) => {
        if (comment.profiles) {
          allActivities.push({
            id: comment.id,
            type: 'comment',
            user: {
              id: comment.profiles.id,
              full_name: comment.profiles.full_name,
              username: comment.profiles.username,
              avatar_url: comment.profiles.avatar_url,
            },
            post: {
              id: comment.posts.id,
              image_url: comment.posts.image_url,
            },
            content: comment.content,
            created_at: comment.created_at,
          });
        }
      });

      followersData?.forEach((follower: any) => {
        if (follower.profiles) {
          allActivities.push({
            id: follower.id,
            type: 'follow',
            user: {
              id: follower.profiles.id,
              full_name: follower.profiles.full_name,
              username: follower.profiles.username,
              avatar_url: follower.profiles.avatar_url,
            },
            created_at: follower.created_at,
          });
        }
      });

      // Sort by date
      allActivities.sort((a, b) => 
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );

      setActivities(allActivities);
    } catch (error) {
      console.error('Error fetching activities:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main className="pt-14 pb-20 md:pb-8">
        <div className="max-w-lg mx-auto px-4 py-4">
          <h2 className="text-lg font-display font-semibold mb-4">Activity</h2>

          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-center gap-3 p-3 animate-pulse">
                  <div className="w-11 h-11 rounded-full bg-muted" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-muted rounded w-3/4" />
                    <div className="h-3 bg-muted rounded w-1/4" />
                  </div>
                </div>
              ))}
            </div>
          ) : activities.length === 0 ? (
            <div className="text-center py-12">
              <Heart className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="font-semibold mb-2">No Activity Yet</h3>
              <p className="text-muted-foreground text-sm">
                When people interact with your posts, you'll see it here
              </p>
            </div>
          ) : (
            <div className="space-y-1">
              {activities.map((activity) => (
                <ActivityItem 
                  key={`${activity.type}-${activity.id}`} 
                  activity={activity} 
                />
              ))}
            </div>
          )}
        </div>
      </main>

      <MobileNav />
    </div>
  );
};

export default Notifications;
