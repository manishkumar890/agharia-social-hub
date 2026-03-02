import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { commentsApi, uploadApi } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { useIsMobile } from '@/hooks/use-mobile';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/ui/drawer';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Send, Loader2, Heart } from 'lucide-react';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { formatDistanceToNow } from 'date-fns';
import { toast } from 'sonner';

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

interface CommentsDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  postId: string;
  commentsEnabled?: boolean;
  onCommentsCountChange?: (count: number) => void;
}

const CommentsDrawer = ({ open, onOpenChange, postId, commentsEnabled = true, onCommentsCountChange }: CommentsDrawerProps) => {
  const { user, profile, isAdmin } = useAuth();
  const isMobile = useIsMobile();
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [deleteCommentId, setDeleteCommentId] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      fetchComments();
    }
  }, [open, postId]);

  const fetchComments = async () => {
    setLoading(true);
    try {
      const data = await commentsApi.getComments(postId);
      
      // Transform avatar URLs
      const enriched: Comment[] = data.map((c: any) => ({
        ...c,
        profiles: c.profiles ? {
          ...c.profiles,
          avatar_url: c.profiles.avatar_url ? uploadApi.getFileUrl(c.profiles.avatar_url) : null
        } : undefined
      }));
      
      setComments(enriched);
    } catch (error) {
      console.error('Error fetching comments:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleComment = async () => {
    if (!user || !newComment.trim()) return;

    setSubmitting(true);
    try {
      const data = await commentsApi.createComment(postId, newComment.trim());
      
      const newC: Comment = {
        ...data,
        profiles: data.profiles ? {
          ...data.profiles,
          avatar_url: data.profiles.avatar_url ? uploadApi.getFileUrl(data.profiles.avatar_url) : null
        } : undefined
      };
      
      setComments(prev => {
        const updated = [...prev, newC];
        onCommentsCountChange?.(updated.length);
        return updated;
      });
      setNewComment('');
      
      // Scroll to bottom
      setTimeout(() => {
        scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
      }, 100);
    } catch (error) {
      toast.error('Failed to post comment');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    try {
      await commentsApi.deleteComment(commentId);
      setComments(prev => {
        const updated = prev.filter(c => c.id !== commentId);
        onCommentsCountChange?.(updated.length);
        return updated;
      });
    } catch (error) {
      toast.error('Failed to delete comment');
    }
  };

  const commentsList = (
    <div className="flex flex-col flex-1 min-h-0">
      {!commentsEnabled ? (
        <div className="flex-1 flex items-center justify-center p-6">
          <p className="text-sm text-muted-foreground">Comments are turned off</p>
        </div>
      ) : loading ? (
        <div className="flex-1 flex items-center justify-center p-6">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : comments.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center p-6 gap-2">
          <p className="font-semibold text-lg">No comments yet</p>
          <p className="text-sm text-muted-foreground">Start the conversation.</p>
        </div>
      ) : (
        <ScrollArea className="flex-1" ref={scrollRef as any}>
          <div className="p-4 space-y-4">
            {comments.map((comment) => (
              <div key={comment.id} className="flex gap-3 group">
                <Link to={`/user/${comment.user_id}`} onClick={() => onOpenChange(false)}>
                  <Avatar className="w-8 h-8 flex-shrink-0">
                    <AvatarImage src={comment.profiles?.avatar_url || undefined} />
                    <AvatarFallback className="bg-muted text-muted-foreground text-xs">
                      {comment.profiles?.full_name?.charAt(0) || 'U'}
                    </AvatarFallback>
                  </Avatar>
                </Link>
                <div className="flex-1 min-w-0">
                  <p className="text-sm">
                    <Link
                      to={`/user/${comment.user_id}`}
                      className="font-semibold mr-1 hover:underline"
                      onClick={() => onOpenChange(false)}
                    >
                      {comment.profiles?.username || comment.profiles?.full_name || 'Unknown'}
                    </Link>
                    {comment.content}
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    <p className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(comment.created_at), { addSuffix: true })}
                    </p>
                    {(profile?.user_id === comment.user_id || isAdmin) && (
                      <button
                        onClick={() => setDeleteCommentId(comment.id)}
                        className="text-xs text-destructive"
                      >
                        Delete
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      )}

      {/* Comment Input */}
      {commentsEnabled && (
        <div className="border-t border-border p-3 flex items-center gap-2">
          <Input
            placeholder="Add a comment..."
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleComment()}
            className="flex-1 border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0"
          />
          <Button
            variant="ghost"
            size="sm"
            onClick={handleComment}
            disabled={!newComment.trim() || submitting || !user}
            className="text-primary font-semibold"
          >
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Post'}
          </Button>
        </div>
      )}
    </div>
  );

  const confirmDialog = (
    <AlertDialog open={!!deleteCommentId} onOpenChange={(open) => !open && setDeleteCommentId(null)}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete Comment</AlertDialogTitle>
          <AlertDialogDescription>
            This action cannot be undone. Are you sure you want to delete this comment?
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={() => {
              if (deleteCommentId) {
                handleDeleteComment(deleteCommentId);
                setDeleteCommentId(null);
              }
            }}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );

  if (isMobile) {
    return (
      <>
        {confirmDialog}
        <Drawer open={open} onOpenChange={onOpenChange}>
          <DrawerContent className="flex flex-col max-h-[85vh]">
            <DrawerHeader className="border-b border-border pb-3">
              <DrawerTitle className="text-center">Comments</DrawerTitle>
            </DrawerHeader>
            {commentsList}
          </DrawerContent>
        </Drawer>
      </>
    );
  }

  return (
    <>
      {confirmDialog}
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md max-h-[70vh] flex flex-col p-0">
          <DialogHeader className="p-4 border-b border-border">
            <DialogTitle className="text-center">Comments</DialogTitle>
          </DialogHeader>
          {commentsList}
        </DialogContent>
      </Dialog>
    </>
  );
};

export default CommentsDrawer;
