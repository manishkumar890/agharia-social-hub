import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { followApi, messagesApi, profileApi, uploadApi } from '@/lib/api';
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
  const { user, profile: myProfile } = useAuth();
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

  const fetchFollowingUsers = async () => {
    if (!user || !myProfile) return;
    setLoading(true);

    try {
      let allUsers: Profile[] = [];
      const COMMUNITY_USER_ID = 'b77ca098-1846-4cd2-961c-7776230485d1';
      const excludeIds = new Set<string>([myProfile.user_id, COMMUNITY_USER_ID]);

      // Get users the current user is following
      const followingData = await followApi.getFollowing(myProfile.user_id);

      if (followingData && followingData.length > 0) {
        const enriched = followingData
          .filter((f: any) => f.user_id !== COMMUNITY_USER_ID)
          .map((f: any) => ({
            ...f,
            avatar_url: f.avatar_url ? uploadApi.getFileUrl(f.avatar_url) : null
          }));
        
        allUsers = enriched;
        enriched.forEach((u: any) => excludeIds.add(u.user_id));
      }

      // If less than 20 users, fetch suggested users
      if (allUsers.length < 20) {
        const suggestedData = await profileApi.searchProfiles('', 20 - allUsers.length);
        
        if (suggestedData && suggestedData.length > 0) {
          const filtered = suggestedData
            .filter((u: any) => !excludeIds.has(u.user_id))
            .map((u: any) => ({
              ...u,
              avatar_url: u.avatar_url ? uploadApi.getFileUrl(u.avatar_url) : null
            }));
          
          allUsers = [...allUsers, ...filtered];
        }
      }

      setUsers(allUsers);
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
    if (!user || !myProfile) return;
    setSending(targetUserId);

    try {
      // Get or create conversation
      const conv = await messagesApi.getOrCreateConversation(targetUserId);

      // Send message with shared post
      await messagesApi.sendMessage(conv.id, {
        content: `Shared a post`,
        media_url: mediaUrl,
        media_type: mediaType,
        shared_post_id: postId,
      });

      toast.success('Post sent!');
      onOpenChange(false);
      navigate(`/messages/${conv.id}`);
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

      <div className="px-4 pb-4 overflow-y-auto" style={{ maxHeight: '448px' }}>
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
                      {profile.full_name || profile.username || 'Unknown'}
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
      </div>
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
