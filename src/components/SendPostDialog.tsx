import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer';
import { Input } from '@/components/ui/input';
import { useIsMobile } from '@/hooks/use-mobile';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Search, Send, Loader2, BadgeCheck } from 'lucide-react';
import { toast } from 'sonner';

interface Profile {
  user_id: string;
  full_name: string | null;
  username: string | null;
  avatar_url: string | null;
  isPremium?: boolean;
}

interface SendPostDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  postId: string;
  postUrl: string;
  mediaUrl: string;
  mediaType: string;
  postAuthorId: string;
  postAuthorUsername: string | null;
  postAuthorAvatar: string | null;
}

const SendPostDialog = ({ 
  open, 
  onOpenChange, 
  postId, 
  postUrl, 
  mediaUrl, 
  mediaType,
  postAuthorId,
  postAuthorUsername,
  postAuthorAvatar
}: SendPostDialogProps) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [searchQuery, setSearchQuery] = useState('');
  const [users, setUsers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      fetchFollowingUsers();
    }
  }, [open]);

  const enrichWithPremium = async (profiles: Profile[]): Promise<Profile[]> => {
    if (profiles.length === 0) return profiles;
    const userIds = profiles.map(p => p.user_id);
    const { data: subs } = await supabase
      .from('user_subscriptions')
      .select('user_id')
      .in('user_id', userIds)
      .eq('plan_type', 'premium');
    const premiumIds = new Set((subs || []).map(s => s.user_id));
    return profiles.map(p => ({ ...p, isPremium: premiumIds.has(p.user_id) }));
  };

  const fetchFollowingUsers = async () => {
    if (!user) return;
    setLoading(true);

    try {
      // Get users the current user is following
      const { data: followingData } = await supabase
        .from('followers')
        .select('following_id')
        .eq('follower_id', user.id);

      if (followingData && followingData.length > 0) {
        const followingIds = followingData.map(f => f.following_id);
        
        const { data: profilesData } = await supabase
          .from('profiles')
          .select('user_id, full_name, username, avatar_url')
          .in('user_id', followingIds);

        const enriched = await enrichWithPremium(profilesData || []);
        setUsers(enriched);
      } else {
        // If not following anyone, show recent conversations
        const { data: convData } = await supabase
          .from('conversations')
          .select('participant_1, participant_2')
          .or(`participant_1.eq.${user.id},participant_2.eq.${user.id}`)
          .order('last_message_at', { ascending: false })
          .limit(20);

        if (convData && convData.length > 0) {
          const userIds = convData.map(c => 
            c.participant_1 === user.id ? c.participant_2 : c.participant_1
          );
          
          const { data: profilesData } = await supabase
            .from('profiles')
            .select('user_id, full_name, username, avatar_url')
            .in('user_id', userIds);

          const enriched = await enrichWithPremium(profilesData || []);
          setUsers(enriched);
        }
      }
    } catch (error) {
      console.error('Error fetching users:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredUsers = users.filter(u => {
    const query = searchQuery.toLowerCase();
    return (
      u.full_name?.toLowerCase().includes(query) ||
      u.username?.toLowerCase().includes(query)
    );
  });

  const handleSend = async (targetUserId: string) => {
    if (!user) return;
    setSending(targetUserId);

    try {
      // Check if conversation exists
      const { data: existingConv } = await supabase
        .from('conversations')
        .select('id')
        .or(`and(participant_1.eq.${user.id},participant_2.eq.${targetUserId}),and(participant_1.eq.${targetUserId},participant_2.eq.${user.id})`)
        .single();

      let conversationId: string;

      if (existingConv) {
        conversationId = existingConv.id;
      } else {
        // Create new conversation
        const { data: newConv, error: convError } = await supabase
          .from('conversations')
          .insert({
            participant_1: user.id,
            participant_2: targetUserId
          })
          .select('id')
          .single();

        if (convError) throw convError;
        conversationId = newConv.id;
      }

      // Send message with actual media content and original poster info
      const { error: msgError } = await supabase
        .from('messages')
        .insert({
          conversation_id: conversationId,
          sender_id: user.id,
          content: '',
          media_url: mediaUrl,
          media_type: mediaType,
          shared_post_id: postId,
          shared_from_user_id: postAuthorId,
          shared_from_username: postAuthorUsername,
          shared_from_avatar_url: postAuthorAvatar
        });

      if (msgError) throw msgError;

      // Update conversation last_message_at
      await supabase
        .from('conversations')
        .update({ last_message_at: new Date().toISOString() })
        .eq('id', conversationId);

      toast.success('Post sent!');
      onOpenChange(false);
      navigate(`/messages/${conversationId}`);
    } catch (error) {
      console.error('Error sending post:', error);
      toast.error('Failed to send post');
    } finally {
      setSending(null);
    }
  };

  const sendContent = (
    <>
      <div className="relative px-4">
        <Search className="absolute left-7 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Search..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9"
        />
      </div>

      <ScrollArea className="px-4 pb-4" style={{ maxHeight: '448px' }}>
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            {searchQuery ? 'No users found' : 'Follow users to send posts'}
          </div>
        ) : (
          <div className="space-y-2">
            {filteredUsers.map((profile) => (
              <div
                key={profile.user_id}
                className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <Avatar className="w-10 h-10">
                    <AvatarImage src={profile.avatar_url || undefined} />
                    <AvatarFallback className="bg-primary text-primary-foreground">
                      {profile.full_name?.charAt(0) || profile.username?.charAt(0) || 'U'}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-medium text-sm flex items-center gap-1">
                      {profile.full_name || profile.username || 'User'}
                      {profile.isPremium && (
                        <BadgeCheck className="w-4 h-4 text-primary fill-primary/20 flex-shrink-0" />
                      )}
                    </p>
                    {profile.username && profile.full_name && (
                      <p className="text-xs text-muted-foreground">@{profile.username}</p>
                    )}
                  </div>
                </div>
                <Button
                  size="sm"
                  onClick={() => handleSend(profile.user_id)}
                  disabled={sending === profile.user_id}
                  className="gradient-maroon text-primary-foreground"
                >
                  {sending === profile.user_id ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <Send className="w-4 h-4 mr-1" />
                      Send
                    </>
                  )}
                </Button>
              </div>
            ))}
          </div>
        )}
      </ScrollArea>
    </>
  );

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent className="flex flex-col max-h-[85vh]">
          <DrawerHeader className="pb-2">
            <DrawerTitle className="text-center">Send to</DrawerTitle>
          </DrawerHeader>
          {sendContent}
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[70vh] flex flex-col p-0">
        <DialogHeader className="p-4 pb-2">
          <DialogTitle className="text-center">Send to</DialogTitle>
        </DialogHeader>
        {sendContent}
      </DialogContent>
    </Dialog>
  );
};

export default SendPostDialog;
