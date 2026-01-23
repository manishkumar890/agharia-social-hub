import { useState, useEffect } from 'react';
import { X, Send, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { formatDistanceToNow } from 'date-fns';
import { toast } from 'sonner';

interface Comment {
  id: string;
  user_id: string;
  content: string;
  created_at: string;
  profile?: {
    username: string | null;
    full_name: string | null;
    avatar_url: string | null;
  };
}

interface StoryCommentsProps {
  storyId: string;
  onClose: () => void;
}

const StoryComments = ({ storyId, onClose }: StoryCommentsProps) => {
  const { user } = useAuth();
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  const fetchComments = async () => {
    try {
      const { data: commentsData, error } = await supabase
        .from('story_comments')
        .select('*')
        .eq('story_id', storyId)
        .order('created_at', { ascending: true });

      if (error) throw error;

      if (commentsData && commentsData.length > 0) {
        const userIds = [...new Set(commentsData.map(c => c.user_id))];
        const { data: profiles } = await supabase
          .from('profiles')
          .select('user_id, username, full_name, avatar_url')
          .in('user_id', userIds);

        const profilesMap = new Map(
          (profiles || []).map(p => [p.user_id, p])
        );

        const commentsWithProfiles = commentsData.map(comment => ({
          ...comment,
          profile: profilesMap.get(comment.user_id)
        }));

        setComments(commentsWithProfiles);
      } else {
        setComments([]);
      }
    } catch (error) {
      console.error('Error fetching comments:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchComments();

    // Subscribe to realtime updates
    const channel = supabase
      .channel(`story-comments-${storyId}`)
      .on(
        'postgres_changes',
        { 
          event: '*', 
          schema: 'public', 
          table: 'story_comments',
          filter: `story_id=eq.${storyId}`
        },
        () => fetchComments()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [storyId]);

  const handleSend = async () => {
    if (!newComment.trim() || !user) return;

    setSending(true);
    try {
      const { error } = await supabase
        .from('story_comments')
        .insert({
          story_id: storyId,
          user_id: user.id,
          content: newComment.trim()
        });

      if (error) throw error;
      setNewComment('');
    } catch (error) {
      console.error('Error posting comment:', error);
      toast.error('Failed to post comment');
    } finally {
      setSending(false);
    }
  };

  return (
    <div 
      className="absolute bottom-0 left-0 right-0 bg-black/80 backdrop-blur-sm rounded-t-2xl max-h-[60vh] flex flex-col"
      onClick={(e) => e.stopPropagation()}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-white/10">
        <h3 className="text-white font-semibold">Comments</h3>
        <Button
          variant="ghost"
          size="icon"
          onClick={onClose}
          className="text-white hover:bg-white/20"
        >
          <X className="w-5 h-5" />
        </Button>
      </div>

      {/* Comments List */}
      <ScrollArea className="flex-1 p-4">
        {loading ? (
          <div className="flex justify-center py-4">
            <Loader2 className="w-6 h-6 text-white animate-spin" />
          </div>
        ) : comments.length === 0 ? (
          <p className="text-white/60 text-center py-4">No comments yet</p>
        ) : (
          <div className="space-y-4">
            {comments.map((comment) => (
              <div key={comment.id} className="flex gap-3">
                <Avatar className="w-8 h-8">
                  <AvatarImage src={comment.profile?.avatar_url || undefined} />
                  <AvatarFallback className="bg-primary text-primary-foreground text-xs">
                    {comment.profile?.full_name?.charAt(0) || 'U'}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-white text-sm font-medium">
                      {comment.profile?.username || comment.profile?.full_name || 'User'}
                    </span>
                    <span className="text-white/40 text-xs">
                      {formatDistanceToNow(new Date(comment.created_at), { addSuffix: true })}
                    </span>
                  </div>
                  <p className="text-white/80 text-sm">{comment.content}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </ScrollArea>

      {/* Input */}
      {user && (
        <div className="p-4 border-t border-white/10 flex gap-2">
          <Input
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            placeholder="Add a comment..."
            className="flex-1 bg-white/10 border-white/20 text-white placeholder:text-white/40"
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
          />
          <Button
            onClick={handleSend}
            disabled={!newComment.trim() || sending}
            size="icon"
            className="shrink-0"
          >
            {sending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </Button>
        </div>
      )}
    </div>
  );
};

export default StoryComments;
