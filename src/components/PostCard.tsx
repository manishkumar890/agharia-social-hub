import { useState, useEffect, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Heart, MessageSquare, Send, Bookmark, MoreHorizontal } from 'lucide-react';
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
import SendPostDialog from '@/components/SendPostDialog';
import LikesDialog from '@/components/LikesDialog';
import CommentsDrawer from '@/components/CommentsDrawer';
import ImageCarousel from '@/components/posts/ImageCarousel';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { cn } from '@/lib/utils';
import { mediaManager } from '@/lib/mediaManager';
import { formatDistanceToNow } from 'date-fns';
import { toast } from 'sonner';

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

interface PostCardProps {
  post: Post;
  onDelete?: () => void;
}

const PostCard = ({ post, onDelete }: PostCardProps) => {
  const { user, isAdmin } = useAuth();
  const [liked, setLiked] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [likesCount, setLikesCount] = useState(0);
  const [commentsCount, setCommentsCount] = useState(0);
  const [animateLike, setAnimateLike] = useState(false);
  const [animateUnlike, setAnimateUnlike] = useState(false);
  const [isAuthorPremium, setIsAuthorPremium] = useState(false);
  const [sendDialogOpen, setSendDialogOpen] = useState(false);
  const [saved, setSaved] = useState(false);
  const [likesDialogOpen, setLikesDialogOpen] = useState(false);
  const [commentsDrawerOpen, setCommentsDrawerOpen] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const postRef = useRef<HTMLElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const likeInProgressRef = useRef(false);

  // IntersectionObserver to detect when post is visible
  useEffect(() => {
    const el = postRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => setIsVisible(entry.isIntersecting),
      { threshold: 0.5 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Auto-pause video when post scrolls out of view
  useEffect(() => {
    if (!isVisible && videoRef.current && !videoRef.current.paused) {
      videoRef.current.pause();
    }
  }, [isVisible]);

  useEffect(() => {
    fetchLikesAndComments();
    fetchAuthorPremiumStatus();
    fetchSavedStatus();
  }, [post.id, user]);

  const fetchAuthorPremiumStatus = async () => {
    const [{ data: subData }, { data: profileData }] = await Promise.all([
      supabase
        .from('user_subscriptions')
        .select('plan_type')
        .eq('user_id', post.user_id)
        .single(),
      supabase
        .from('profiles')
        .select('phone')
        .eq('user_id', post.user_id)
        .single(),
    ]);

    const isAdminPhone = profileData?.phone === '7326937200';
    setIsAuthorPremium(isAdminPhone || subData?.plan_type === 'premium');
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
        .maybeSingle();
      
      setLiked(!!userLike);
    }

    // Fetch comments count
    const { count: commentsTotal } = await supabase
      .from('comments')
      .select('*', { count: 'exact', head: true })
      .eq('post_id', post.id);
    
    setCommentsCount(commentsTotal || 0);
  };

  const fetchSavedStatus = async () => {
    if (!user) return;
    
    const { data } = await supabase
      .from('saved_posts')
      .select('id')
      .eq('post_id', post.id)
      .eq('user_id', user.id)
      .maybeSingle();
    
    setSaved(!!data);
  };

  const handleSave = async () => {
    if (!user) {
      toast.error('Please login to save posts');
      return;
    }

    if (saved) {
      const { error } = await supabase
        .from('saved_posts')
        .delete()
        .eq('post_id', post.id)
        .eq('user_id', user.id);
      
      if (error) {
        toast.error('Failed to unsave post');
      } else {
        setSaved(false);
        toast.success('Post unsaved');
      }
    } else {
      const { error } = await supabase
        .from('saved_posts')
        .insert({ post_id: post.id, user_id: user.id });
      
      if (error) {
        toast.error('Failed to save post');
      } else {
        setSaved(true);
        toast.success('Post saved');
      }
    }
  };

  const handleLike = async () => {
    if (!user) return;
    if (likeInProgressRef.current) return;
    likeInProgressRef.current = true;
    try {
      if (liked) {
        setAnimateUnlike(true);
        setTimeout(() => setAnimateUnlike(false), 900);

        await supabase
          .from('likes')
          .delete()
          .eq('post_id', post.id)
          .eq('user_id', user.id);
        
        setLiked(false);
        setLikesCount(prev => prev - 1);
      } else {
        setAnimateLike(true);
        setTimeout(() => setAnimateLike(false), 300);

        await supabase
          .from('likes')
          .insert({ post_id: post.id, user_id: user.id });
        
        setLiked(true);
        setLikesCount(prev => prev + 1);
      }
    } finally {
      likeInProgressRef.current = false;
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

  const handleSend = () => {
    if (!user) {
      toast.error('Please login to send posts');
      return;
    }
    setSendDialogOpen(true);
  };

  const canDelete = user?.id === post.user_id || isAdmin;

  return (
    <article ref={postRef} className="bg-card border border-border rounded-lg overflow-hidden animate-fade-in shadow-sm">
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
            <DropdownMenuItem onClick={handleSend}>Send</DropdownMenuItem>
            {canDelete && (
              <DropdownMenuItem onClick={() => setDeleteDialogOpen(true)} className="text-destructive">
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
            ref={videoRef}
            src={post.image_url} 
            poster={post.thumbnail_url || undefined}
            className="w-full h-full object-cover"
            playsInline
            webkit-playsinline=""
            controls
            controlsList="nodownload noplaybackrate"
            preload="metadata"
            onPlay={() => {
              mediaManager.play(() => {
                videoRef.current?.pause();
              });
            }}
          />
        ) : post.image_urls && post.image_urls.length > 1 ? (
          <ImageCarousel 
            images={post.image_urls}
            backgroundAudioUrl={post.background_audio_url}
            isVisible={isVisible}
          />
        ) : post.background_audio_url ? (
          <ImageCarousel 
            images={[post.image_url]}
            backgroundAudioUrl={post.background_audio_url}
            isVisible={isVisible}
          />
        ) : (
          <>
            {!imageLoaded && (
              <div className="w-full aspect-square bg-muted animate-pulse" />
            )}
            <img 
              src={post.image_url} 
              alt={post.caption || 'Post image'} 
              className={cn("w-full h-full object-cover", !imageLoaded && "hidden")}
              onLoad={() => setImageLoaded(true)}
            />
          </>
        )}
        {animateLike && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <Heart className="w-24 h-24 text-primary fill-primary animate-heart opacity-80" />
          </div>
        )}
        {animateUnlike && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
            {/* Full heart pops in, then splits */}
            <div className="relative w-24 h-24">
              {/* Full heart - shows first then hides */}
              <Heart className="w-24 h-24 text-primary fill-primary absolute inset-0 opacity-0 animate-[heartAppear_0.3s_ease-out_forwards]" />
              {/* Left half - clips left side, falls left */}
              <Heart 
                className="w-24 h-24 text-primary fill-primary absolute inset-0 opacity-0 animate-[heartLeftFall_0.6s_ease-in_0.3s_forwards]" 
                style={{ clipPath: 'polygon(0 0, 52% 0, 52% 100%, 0 100%)' }}
              />
              {/* Right half - clips right side, falls right */}
              <Heart 
                className="w-24 h-24 text-primary fill-primary absolute inset-0 opacity-0 animate-[heartRightFall_0.6s_ease-in_0.3s_forwards]" 
                style={{ clipPath: 'polygon(48% 0, 100% 0, 100% 100%, 48% 100%)' }}
              />
            </div>
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
              className="h-9 w-9 hover:bg-transparent active:bg-transparent"
              onClick={handleLike}
            >
              <Heart className={cn(
                "w-6 h-6 transition-all",
                liked ? "text-primary fill-primary" : "text-foreground",
                animateUnlike && "animate-heart-break"
              )} />
            </Button>
            {post.comments_enabled !== false && (
              <Button variant="ghost" size="icon" className="h-9 w-9 hover:bg-transparent active:bg-transparent" onClick={() => setCommentsDrawerOpen(true)}>
                <MessageSquare className="w-6 h-6" />
              </Button>
            )}
            <Button variant="ghost" size="icon" className="h-9 w-9 hover:bg-transparent active:bg-transparent" onClick={handleSend}>
              <Send className="w-6 h-6" />
            </Button>
          </div>
          <Button variant="ghost" size="icon" className="h-9 w-9 hover:bg-transparent active:bg-transparent" onClick={handleSave}>
            <Bookmark className={cn(
              "w-6 h-6 transition-colors",
              saved ? "text-primary fill-primary" : "text-foreground"
            )} />
          </Button>
        </div>

        {/* Likes Count */}
        <button onClick={() => setLikesDialogOpen(true)} className="font-semibold text-sm mb-1 hover:opacity-70 transition-opacity">
          {likesCount} {likesCount === 1 ? 'like' : 'likes'}
        </button>

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
        {post.comments_enabled !== false && commentsCount > 0 && (
          <button onClick={() => setCommentsDrawerOpen(true)} className="text-sm text-muted-foreground mt-1 block hover:opacity-70 transition-opacity">
            View all {commentsCount} comments
          </button>
        )}

        {/* Timestamp */}
        <p className="text-xs text-muted-foreground mt-1 uppercase">
          {formatDistanceToNow(new Date(post.created_at), { addSuffix: true })}
        </p>
      </div>

      <SendPostDialog
        open={sendDialogOpen}
        onOpenChange={setSendDialogOpen}
        postId={post.id}
        postUrl={`${window.location.origin}/post/${post.id}`}
        mediaUrl={post.image_url}
        mediaType={post.media_type || 'image'}
        postAuthorId={post.user_id}
        postAuthorUsername={post.profiles?.username || post.profiles?.full_name || null}
        postAuthorAvatar={post.profiles?.avatar_url || null}
      />

      <LikesDialog
        open={likesDialogOpen}
        onOpenChange={setLikesDialogOpen}
        postId={post.id}
      />

      <CommentsDrawer
        open={commentsDrawerOpen}
        onOpenChange={setCommentsDrawerOpen}
        postId={post.id}
        commentsEnabled={post.comments_enabled !== false}
        onCommentsCountChange={setCommentsCount}
      />

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Post</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this post? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </article>
  );
};

export default PostCard;
