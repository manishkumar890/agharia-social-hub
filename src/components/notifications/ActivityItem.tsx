import { Link } from 'react-router-dom';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Heart, MessageCircle, UserPlus } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

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

interface ActivityItemProps {
  activity: Activity;
}

const ActivityItem = ({ activity }: ActivityItemProps) => {
  const { user } = useAuth();
  const [isFollowing, setIsFollowing] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);

  useEffect(() => {
    if (activity.type === 'follow' && user) {
      checkFollowStatus();
    }
  }, [activity, user]);

  const checkFollowStatus = async () => {
    if (!user) return;
    
    const { data } = await supabase
      .from('followers')
      .select('id')
      .eq('follower_id', user.id)
      .eq('following_id', activity.user.id)
      .single();
    
    setIsFollowing(!!data);
  };

  const handleFollow = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (!user || followLoading) return;
    
    setFollowLoading(true);
    try {
      if (isFollowing) {
        await supabase
          .from('followers')
          .delete()
          .eq('follower_id', user.id)
          .eq('following_id', activity.user.id);
        setIsFollowing(false);
      } else {
        await supabase
          .from('followers')
          .insert({
            follower_id: user.id,
            following_id: activity.user.id,
          });
        setIsFollowing(true);
      }
    } catch (error) {
      console.error('Error toggling follow:', error);
    } finally {
      setFollowLoading(false);
    }
  };

  const getActivityIcon = () => {
    switch (activity.type) {
      case 'like':
        return <Heart className="w-4 h-4 text-red-500 fill-red-500" />;
      case 'comment':
        return <MessageCircle className="w-4 h-4 text-primary" />;
      case 'follow':
        return <UserPlus className="w-4 h-4 text-blue-500" />;
      default:
        return null;
    }
  };

  const getActivityText = () => {
    switch (activity.type) {
      case 'like':
        return 'liked your post.';
      case 'comment':
        return (
          <>
            commented: <span className="text-foreground">"{activity.content?.substring(0, 50)}{(activity.content?.length || 0) > 50 ? '...' : ''}"</span>
          </>
        );
      case 'follow':
        return 'started following you.';
      default:
        return '';
    }
  };

  const getLink = () => {
    if (activity.type === 'follow') {
      return `/user/${activity.user.id}`;
    }
    return activity.post ? `/post/${activity.post.id}` : `/user/${activity.user.id}`;
  };

  const getLinkState = () => {
    if (activity.type !== 'follow' && activity.post && user) {
      // The post belongs to the current user (activity is on their post)
      return { userId: user.id };
    }
    return undefined;
  };

  const userName = activity.user.full_name || activity.user.username || 'User';

  return (
    <Link
      to={getLink()}
      state={getLinkState()}
      className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors cursor-pointer"
    >
      {/* Avatar with activity icon overlay */}
      <div className="relative">
        <Avatar className="w-11 h-11 border-2 border-background">
          <AvatarImage src={activity.user.avatar_url || undefined} />
          <AvatarFallback className="bg-primary text-primary-foreground text-sm">
            {userName.charAt(0).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <div className="absolute -bottom-1 -right-1 bg-background rounded-full p-0.5">
          {getActivityIcon()}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p className="text-sm leading-tight">
          <span className="font-semibold">{userName}</span>{' '}
          <span className="text-muted-foreground">{getActivityText()}</span>
        </p>
        <p className="text-xs text-muted-foreground mt-0.5">
          {formatDistanceToNow(new Date(activity.created_at), { addSuffix: true })}
        </p>
      </div>

      {/* Right side: Follow button or Post thumbnail */}
      {activity.type === 'follow' ? (
        <Button
          size="sm"
          variant={isFollowing ? 'outline' : 'default'}
          className="text-xs h-8 px-4"
          onClick={handleFollow}
          disabled={followLoading}
        >
          {isFollowing ? 'Following' : 'Follow'}
        </Button>
      ) : activity.post ? (
        <div className="w-11 h-11 rounded overflow-hidden flex-shrink-0">
          <img
            src={activity.post.media_type === 'video' && activity.post.thumbnail_url 
              ? activity.post.thumbnail_url 
              : activity.post.image_url}
            alt=""
            className="w-full h-full object-cover"
          />
        </div>
      ) : null}
    </Link>
  );
};

export default ActivityItem;
