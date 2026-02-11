import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import Header from '@/components/Header';
import MobileNav from '@/components/MobileNav';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Heart, MessageCircle, Send, Bookmark, ArrowLeft, MoreHorizontal, Loader2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import ImageCarousel from '@/components/posts/ImageCarousel';
import SendPostDialog from '@/components/SendPostDialog';

interface Post {
  id: string;
  user_id: string;
  image_url: string;
  image_urls?: string[] | null;
  background_audio_url?: string | null;
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

interface Comment {
  id: string;
  user_id: string;
  content: string;
  created_at: string;
  profiles?: {
    full_name: string | null;
    username: string | null;
    avatar_url: string | null;
  };
}

const PostDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, isAdmin } = useAuth();
  const [post, setPost] = useState<Post | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [liked, setLiked] = useState(false);
  const [likesCount, setLikesCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [sendDialogOpen, setSendDialogOpen] = useState(false);

  useEffect(() => {
    if (id) {
      fetchPost();
      fetchComments();
    }
  }, [id]);

  const fetchPost = async () => {
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
      
      setPost({ ...data, profiles: profile } as Post);
      
      // Fetch likes
      const { count } = await supabase
        .from('likes')
        .select('*', { count: 'exact', head: true })
        .eq('post_id', id);
      
      setLikesCount(count || 0);

      // Check if user liked
      if (user) {
        const { data: likeData } = await supabase
          .from('likes')
          .select('id')
          .eq('post_id', id)
          .eq('user_id', user.id)
          .single();
        
        setLiked(!!likeData);
      }
    }
    setLoading(false);
  };

  const fetchComments = async () => {
    const { data: commentsData } = await supabase
      .from('comments')
      .select('*')
      .eq('post_id', id)
      .order('created_at', { ascending: true });

    const commentsWithProfiles = await Promise.all(
      (commentsData || []).map(async (comment) => {
        const { data: profile } = await supabase
          .from('profiles')
          .select('full_name, username, avatar_url')
          .eq('user_id', comment.user_id)
          .single();
        return { ...comment, profiles: profile };
      })
    );

    setComments(commentsWithProfiles as Comment[]);
  };

  const handleLike = async () => {
    if (!user || !post) return;

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

  const handleComment = async () => {
    if (!user || !post || !newComment.trim()) return;

    setSubmitting(true);
    
    const { data, error } = await supabase
      .from('comments')
      .insert({
        post_id: post.id,
        user_id: user.id,
        content: newComment.trim(),
      })
      .select('*')
      .single();

    if (error) {
      toast.error('Failed to post comment');
    } else if (data) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name, username, avatar_url')
        .eq('user_id', user.id)
        .single();
      setComments([...comments, { ...data, profiles: profile } as Comment]);
      setNewComment('');
    }
    
    setSubmitting(false);
  };

  const handleDeletePost = async () => {
    if (!post) return;
    
    const { error } = await supabase
      .from('posts')
      .delete()
      .eq('id', post.id);
    
    if (error) {
      toast.error('Failed to delete post');
    } else {
      toast.success('Post deleted');
      navigate('/');
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    const { error } = await supabase
      .from('comments')
      .delete()
      .eq('id', commentId);
    
    if (error) {
      toast.error('Failed to delete comment');
    } else {
      setComments(comments.filter(c => c.id !== commentId));
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

  if (!post) {
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

  const canDelete = user?.id === post.user_id || isAdmin;

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main className="pt-14 pb-20 md:pb-8">
        <div className="max-w-4xl mx-auto">
          {/* Mobile Back Button */}
          <div className="md:hidden px-4 py-3 flex items-center gap-4 border-b border-border">
            <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <span className="font-semibold">Post</span>
          </div>

          <div className="md:flex md:border md:border-border md:rounded-lg md:overflow-hidden md:m-6">
            {/* Media - shows original aspect ratio */}
            <div className="md:w-1/2 md:flex-shrink-0 bg-muted flex items-center justify-center">
              {post.media_type === 'video' ? (
                <video
                  src={post.image_url}
                  poster={post.thumbnail_url || undefined}
                  className="w-full max-h-[70vh] object-contain"
                  controls
                  controlsList="nodownload noplaybackrate"
                  preload="metadata"
                />
              ) : post.image_urls && post.image_urls.length > 1 ? (
                <ImageCarousel 
                  images={post.image_urls}
                  backgroundAudioUrl={post.background_audio_url}
                  className="w-full max-h-[70vh]"
                />
              ) : (
                <>
                  <img
                    src={post.image_url}
                    alt={post.caption || 'Post'}
                    className="w-full max-h-[70vh] object-contain"
                  />
                  {post.background_audio_url && (
                    <audio src={post.background_audio_url} controls loop className="w-full mt-2" />
                  )}
                </>
              )}
            </div>

            {/* Details */}
            <div className="md:w-1/2 md:flex md:flex-col">
              {/* Post Header */}
              <div className="flex items-center justify-between p-4 border-b border-border">
                <Link to={`/user/${post.user_id}`} className="flex items-center gap-3">
                  <Avatar className="w-8 h-8 border-2 border-primary/30">
                    <AvatarImage src={post.profiles?.avatar_url || undefined} />
                    <AvatarFallback className="bg-primary text-primary-foreground text-xs">
                      {post.profiles?.full_name?.charAt(0) || 'U'}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-semibold text-sm">
                      {post.profiles?.full_name || post.profiles?.username || 'User'}
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
                    {canDelete && (
                      <DropdownMenuItem onClick={handleDeletePost} className="text-destructive">
                        Delete Post
                      </DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              {/* Comments Section */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4 max-h-[300px] md:max-h-none">
                {/* Caption */}
                {post.caption && (
                  <div className="flex gap-3">
                    <Avatar className="w-8 h-8 flex-shrink-0">
                      <AvatarImage src={post.profiles?.avatar_url || undefined} />
                      <AvatarFallback className="bg-primary text-primary-foreground text-xs">
                        {post.profiles?.full_name?.charAt(0) || 'U'}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="text-sm">
                        <span className="font-semibold mr-1">
                          {post.profiles?.username || post.profiles?.full_name || 'User'}
                        </span>
                        {post.caption}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {formatDistanceToNow(new Date(post.created_at), { addSuffix: true })}
                      </p>
                    </div>
                  </div>
                )}

                {/* Comments */}
                {comments.map((comment) => (
                  <div key={comment.id} className="flex gap-3 group">
                    <Link to={`/user/${comment.user_id}`}>
                      <Avatar className="w-8 h-8 flex-shrink-0">
                        <AvatarImage src={comment.profiles?.avatar_url || undefined} />
                        <AvatarFallback className="bg-muted text-muted-foreground text-xs">
                          {comment.profiles?.full_name?.charAt(0) || 'U'}
                        </AvatarFallback>
                      </Avatar>
                    </Link>
                    <div className="flex-1">
                      <p className="text-sm">
                        <Link to={`/user/${comment.user_id}`} className="font-semibold mr-1 hover:underline">
                          {comment.profiles?.username || comment.profiles?.full_name || 'User'}
                        </Link>
                        {comment.content}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        <p className="text-xs text-muted-foreground">
                          {formatDistanceToNow(new Date(comment.created_at), { addSuffix: true })}
                        </p>
                        {(user?.id === comment.user_id || isAdmin) && (
                          <button 
                            onClick={() => handleDeleteComment(comment.id)}
                            className="text-xs text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            Delete
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Actions */}
              <div className="border-t border-border p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <Button variant="ghost" size="icon" onClick={handleLike}>
                      <Heart className={cn(
                        "w-6 h-6",
                        liked ? "text-primary fill-primary" : "text-foreground"
                      )} />
                    </Button>
                    <Button variant="ghost" size="icon">
                      <MessageCircle className="w-6 h-6" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => setSendDialogOpen(true)}>
                      <Send className="w-6 h-6" />
                    </Button>
                  </div>
                  <Button variant="ghost" size="icon">
                    <Bookmark className="w-6 h-6" />
                  </Button>
                </div>

                <p className="font-semibold text-sm mb-2">{likesCount} likes</p>

                {/* Add Comment */}
                <div className="flex items-center gap-2">
                  <Input
                    placeholder="Add a comment..."
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleComment()}
                    className="flex-1"
                  />
                  <Button
                    size="icon"
                    onClick={handleComment}
                    disabled={!newComment.trim() || submitting}
                    className="gradient-maroon text-primary-foreground"
                  >
                    {submitting ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Send className="w-4 h-4" />
                    )}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

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

      <MobileNav />
    </div>
  );
};

export default PostDetail;
