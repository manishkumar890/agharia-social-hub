import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Heart, MessageCircle, Share2, Bookmark, MoreHorizontal } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import PremiumBadge from '@/components/PremiumBadge';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import { toast } from 'sonner';

interface Post {
  id: string;
  user_id: string;
  image_url: string;
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

interface PostCardProps {
  post: Post;
  onDelete?: () => void;
}

const PostCard = ({ post, onDelete }: PostCardProps) => {
  const { user, isAdmin } = useAuth();
  const [liked, setLiked] = useState(false);
  const [likesCount, setLikesCount] = useState(0);
  const [commentsCount, setCommentsCount] = useState(0);
  const [animateLike, setAnimateLike] = useState(false);
  const [isAuthorPremium, setIsAuthorPremium] = useState(false);

  useEffect(() => {
    fetchLikesAndComments();
    fetchAuthorPremiumStatus();
  }, [post.id]);

  const fetchAuthorPremiumStatus = async () => {
    const { data } = await supabase
      .from('user_subscriptions')
      .select('plan_type')
      .eq('user_id', post.user_id)
      .single();

    setIsAuthorPremium(data?.plan_type === 'premium');
  };

  const fetchLikesAndComments = async () => {
    // Fetch likes count
    const { count: likesTotal } = await supabase
      .from('likes')
      .select('*', { count: 'exact', head: true })
      .eq('post_id', post.id);
    
    setLikesCount(likesTotal || 0);

    // Check if user liked this post
    if (user) {
      const { data: userLike } = await supabase
        .from('likes')
        .select('id')
        .eq('post_id', post.id)
        .eq('user_id', user.id)
        .single();
      
      setLiked(!!userLike);
    }

    // Fetch comments count
    const { count: commentsTotal } = await supabase
      .from('comments')
      .select('*', { count: 'exact', head: true })
      .eq('post_id', post.id);
    
    setCommentsCount(commentsTotal || 0);
  };

  const handleLike = async () => {
    if (!user) return;

    setAnimateLike(true);
    setTimeout(() => setAnimateLike(false), 300);

    if (liked) {
      await supabase
        .from('likes')
        .delete()
        .eq('post_id', post.id)
        .eq('user_id', user.id);
      
      setLiked(false);
      setLikesCount(prev => prev - 1);
    } else {
      await supabase
        .from('likes')
        .insert({ post_id: post.id, user_id: user.id });
      
      setLiked(true);
      setLikesCount(prev => prev + 1);
    }
  };

  const handleDelete = async () => {
    const { error } = await supabase
      .from('posts')
      .delete()
      .eq('id', post.id);
    
    if (error) {
      toast.error('Failed to delete post');
    } else {
      toast.success('Post deleted');
      onDelete?.();
    }
  };

  const handleShare = async () => {
    try {
      await navigator.share({
        title: 'Agharia Samaj Post',
        text: post.caption || 'Check out this post!',
        url: window.location.origin + '/post/' + post.id
      });
    } catch {
      // Fallback to copy link
      navigator.clipboard.writeText(window.location.origin + '/post/' + post.id);
      toast.success('Link copied to clipboard');
    }
  };

  const canDelete = user?.id === post.user_id || isAdmin;

  return (
    <article className="bg-card border border-border rounded-lg overflow-hidden animate-fade-in shadow-sm">
      {/* Post Header */}
      <div className="flex items-center justify-between p-3">
        <Link to={`/user/${post.user_id}`} className="flex items-center gap-3">
          <Avatar className="w-9 h-9 border-2 border-primary/30">
            <AvatarImage src={post.profiles?.avatar_url || undefined} />
            <AvatarFallback className="bg-primary text-primary-foreground text-sm">
              {post.profiles?.full_name?.charAt(0) || post.profiles?.username?.charAt(0) || 'U'}
            </AvatarFallback>
          </Avatar>
          <div>
            <p className="font-medium text-sm text-foreground flex items-center gap-1">
              {post.profiles?.full_name || post.profiles?.username || 'User'}
              {isAuthorPremium && <PremiumBadge size="sm" />}
            </p>
            {post.location && (
              <p className="text-xs text-muted-foreground">{post.location}</p>
            )}
          </div>
        </Link>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <MoreHorizontal className="w-5 h-5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={handleShare}>Share</DropdownMenuItem>
            {canDelete && (
              <DropdownMenuItem onClick={handleDelete} className="text-destructive">
                Delete
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Post Media */}
      <div 
        className="relative bg-muted cursor-pointer"
        onDoubleClick={handleLike}
      >
        {post.media_type === 'video' ? (
          <video 
            src={post.image_url} 
            poster={post.thumbnail_url || undefined}
            className="w-full h-full object-cover"
            controls
            controlsList="nodownload noplaybackrate"
            preload="metadata"
          />
        ) : (
          <img 
            src={post.image_url} 
            alt={post.caption || 'Post image'} 
            className="w-full h-full object-cover"
          />
        )}
        {animateLike && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <Heart className="w-24 h-24 text-primary fill-primary animate-heart opacity-80" />
          </div>
        )}
      </div>

      {/* Post Actions */}
      <div className="p-3">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-3">
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-9 w-9"
              onClick={handleLike}
            >
              <Heart className={cn(
                "w-6 h-6 transition-colors",
                liked ? "text-primary fill-primary" : "text-foreground"
              )} />
            </Button>
            <Button variant="ghost" size="icon" className="h-9 w-9" asChild>
              <Link to={`/post/${post.id}`}>
                <MessageCircle className="w-6 h-6" />
              </Link>
            </Button>
            <Button variant="ghost" size="icon" className="h-9 w-9" onClick={handleShare}>
              <Share2 className="w-6 h-6" />
            </Button>
          </div>
          <Button variant="ghost" size="icon" className="h-9 w-9">
            <Bookmark className="w-6 h-6" />
          </Button>
        </div>

        {/* Likes Count */}
        <p className="font-semibold text-sm mb-1">{likesCount} likes</p>

        {/* Caption */}
        {post.caption && (
          <p className="text-sm">
            <span className="font-semibold mr-1">
              {post.profiles?.username || post.profiles?.full_name || 'User'}
            </span>
            {post.caption}
          </p>
        )}

        {/* Comments Count */}
        {commentsCount > 0 && (
          <Link to={`/post/${post.id}`} className="text-sm text-muted-foreground mt-1 block">
            View all {commentsCount} comments
          </Link>
        )}

        {/* Timestamp */}
        <p className="text-xs text-muted-foreground mt-1 uppercase">
          {formatDistanceToNow(new Date(post.created_at), { addSuffix: true })}
        </p>
      </div>
    </article>
  );
};

export default PostCard;
