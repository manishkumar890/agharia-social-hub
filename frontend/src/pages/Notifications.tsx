import { useState, useEffect } from 'react';
import { notificationsApi, uploadApi } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { useNotifications } from '@/contexts/NotificationContext';
import Header from '@/components/Header';
import MobileNav from '@/components/MobileNav';
import CategorySlidePopup from '@/components/CategorySlidePopup';
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
    thumbnail_url?: string;
    media_type?: string;
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
      
      // Poll for updates every 30 seconds
      const interval = setInterval(fetchActivities, 30000);
      return () => clearInterval(interval);
    }
  }, [user]);

  const fetchActivities = async () => {
    if (!user) return;

    try {
      const data = await notificationsApi.getNotifications(50);
      
      // Transform to Activity format
      const formattedActivities: Activity[] = data.map((item: any) => ({
        id: item.id,
        type: item.type,
        user: {
          id: item.user_id,
          full_name: item.full_name,
          username: item.username,
          avatar_url: item.avatar_url ? uploadApi.getFileUrl(item.avatar_url) : null,
        },
        post: item.post_id ? {
          id: item.post_id,
          image_url: '', // Post images would need to be fetched separately if needed
        } : undefined,
        content: item.type === 'comment' ? item.message?.replace('commented: ', '') : undefined,
        created_at: item.created_at,
      }));

      setActivities(formattedActivities);
    } catch (error) {
      console.error('Error fetching activities:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main className="pt-14 pb-20 md:pb-16">
        <div className="max-w-xl lg:max-w-2xl mx-auto px-4 py-4">
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
      <CategorySlidePopup />
    </div>
  );
};

export default Notifications;
