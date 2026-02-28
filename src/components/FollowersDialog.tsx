import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useIsMobile } from '@/hooks/use-mobile';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import PremiumBadge from '@/components/PremiumBadge';
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
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Ban } from 'lucide-react';

interface FollowUser {
  user_id: string;
  full_name: string | null;
  username: string | null;
  avatar_url: string | null;
  isPremium?: boolean;
  is_disabled?: boolean;
}

interface FollowersDialogProps {
  userId: string;
  type: 'followers' | 'following';
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const FollowersDialog = ({ userId, type, open, onOpenChange }: FollowersDialogProps) => {
  const [users, setUsers] = useState<FollowUser[]>([]);
  const [loading, setLoading] = useState(true);
  const isMobile = useIsMobile();

  useEffect(() => {
    if (open) {
      fetchUsers();
    }
  }, [open, userId, type]);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      let userIds: string[] = [];

      if (type === 'followers') {
        // Get users who follow this user
        const { data } = await supabase
          .from('followers')
          .select('follower_id')
          .eq('following_id', userId);
        
        userIds = (data || []).map(f => f.follower_id);
      } else {
        // Get users this user follows
        const { data } = await supabase
          .from('followers')
          .select('following_id')
          .eq('follower_id', userId);
        
        userIds = (data || []).map(f => f.following_id);
      }

      if (userIds.length === 0) {
        setUsers([]);
        setLoading(false);
        return;
      }

      // Fetch profiles for these users (including is_disabled status and phone)
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, full_name, username, avatar_url, is_disabled, phone')
        .in('user_id', userIds);

      // Get active user IDs for subscription lookup
      const activeUserIds = (profiles || []).filter(p => !p.is_disabled).map(p => p.user_id);

      // Fetch subscription status for active users only
      const { data: subscriptions } = await supabase
        .from('user_subscriptions')
        .select('user_id, plan_type')
        .in('user_id', activeUserIds);

      const premiumUserIds = new Set(
        (subscriptions || [])
          .filter(s => s.plan_type === 'premium')
          .map(s => s.user_id)
      );

      const ADMIN_PHONE = '7326937200';
      const usersWithPremium = (profiles || []).map(profile => ({
        ...profile,
        isPremium: profile.is_disabled ? false : (profile.phone === ADMIN_PHONE || premiumUserIds.has(profile.user_id)),
      }));

      setUsers(usersWithPremium);
    } catch (error) {
      console.error('Error fetching users:', error);
    } finally {
      setLoading(false);
    }
  };

  const userList = (
    <ScrollArea className="flex-1 px-4 pb-4" style={{ maxHeight: '448px' }}>
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3">
              <Skeleton className="w-10 h-10 rounded-full" />
              <div className="flex-1">
                <Skeleton className="h-4 w-24 mb-1" />
                <Skeleton className="h-3 w-16" />
              </div>
            </div>
          ))}
        </div>
      ) : users.length === 0 ? (
        <p className="text-center text-muted-foreground py-8">
          {type === 'followers' ? 'No followers yet' : 'Not following anyone'}
        </p>
      ) : (
        <div className="space-y-3">
          {users.map((user) => (
            user.is_disabled ? (
              <div
                key={user.user_id}
                className="flex items-center gap-3 p-2 rounded-lg bg-muted/50 opacity-60"
              >
                <Avatar className="w-10 h-10 grayscale">
                  <AvatarImage src={user.avatar_url || undefined} />
                  <AvatarFallback className="bg-muted text-muted-foreground">
                    <Ban className="w-5 h-5" />
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-medium text-sm text-muted-foreground flex items-center gap-1">
                    <Ban className="w-3 h-3" />
                    Account Disabled
                  </p>
                  <p className="text-xs text-muted-foreground">
                    This user is disabled from Agharia Samaj
                  </p>
                </div>
              </div>
            ) : (
              <Link
                key={user.user_id}
                to={`/user/${user.user_id}`}
                onClick={() => onOpenChange(false)}
                className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted transition-colors"
              >
                <Avatar className="w-10 h-10">
                  <AvatarImage src={user.avatar_url || undefined} />
                  <AvatarFallback className="bg-primary text-primary-foreground">
                    {user.full_name?.charAt(0) || user.username?.charAt(0) || 'U'}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-medium text-sm flex items-center gap-1">
                    {user.username || user.full_name || 'User'}
                    {user.isPremium && <PremiumBadge size="sm" />}
                  </p>
                  {user.full_name && user.username && (
                    <p className="text-xs text-muted-foreground">{user.full_name}</p>
                  )}
                </div>
              </Link>
            )
          ))}
        </div>
      )}
    </ScrollArea>
  );

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent className="flex flex-col max-h-[85vh]">
          <DrawerHeader className="pb-2">
            <DrawerTitle className="text-center capitalize">{type}</DrawerTitle>
          </DrawerHeader>
          {userList}
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[70vh] flex flex-col p-0">
        <DialogHeader className="p-4 pb-2">
          <DialogTitle className="text-center capitalize">{type}</DialogTitle>
        </DialogHeader>
        {userList}
      </DialogContent>
    </Dialog>
  );
};

export default FollowersDialog;
