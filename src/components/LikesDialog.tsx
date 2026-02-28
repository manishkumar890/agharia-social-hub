import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Search } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useIsMobile } from '@/hooks/use-mobile';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
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

interface LikeUser {
  user_id: string;
  username: string | null;
  full_name: string | null;
  avatar_url: string | null;
}

interface LikesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  postId: string;
}

const LikesDialog = ({ open, onOpenChange, postId }: LikesDialogProps) => {
  const { user } = useAuth();
  const isMobile = useIsMobile();
  const [users, setUsers] = useState<LikeUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [followingIds, setFollowingIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (open) {
      fetchLikedUsers();
      if (user) fetchFollowing();
    } else {
      setSearch('');
    }
  }, [open, postId]);

  const fetchLikedUsers = async () => {
    setLoading(true);
    const { data: likes } = await supabase
      .from('likes')
      .select('user_id')
      .eq('post_id', postId)
      .order('created_at', { ascending: false });

    if (!likes || likes.length === 0) {
      setUsers([]);
      setLoading(false);
      return;
    }

    const userIds = likes.map(l => l.user_id);
    const { data: profiles } = await supabase
      .from('profiles')
      .select('user_id, username, full_name, avatar_url')
      .in('user_id', userIds);

    const profileMap = new Map(profiles?.map(p => [p.user_id, p]) || []);
    setUsers(userIds.map(id => profileMap.get(id) || { user_id: id, username: null, full_name: null, avatar_url: null }));
    setLoading(false);
  };

  const fetchFollowing = async () => {
    if (!user) return;
    const { data } = await supabase
      .from('followers')
      .select('following_id')
      .eq('follower_id', user.id);
    setFollowingIds(new Set(data?.map(f => f.following_id) || []));
  };

  const handleFollow = async (targetId: string) => {
    if (!user) return;
    if (followingIds.has(targetId)) {
      await supabase.from('followers').delete().eq('follower_id', user.id).eq('following_id', targetId);
      setFollowingIds(prev => { const s = new Set(prev); s.delete(targetId); return s; });
    } else {
      await supabase.from('followers').insert({ follower_id: user.id, following_id: targetId });
      setFollowingIds(prev => new Set(prev).add(targetId));
    }
  };

  const filtered = users.filter(u => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (u.username?.toLowerCase().includes(q) || u.full_name?.toLowerCase().includes(q));
  });

  const content = (
    <>
      <div className="px-4 pb-2">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>
      <ScrollArea className="flex-1 px-4 pb-4" style={{ maxHeight: '448px' }}>
        {loading ? (
          <div className="space-y-3">
            {[1,2,3].map(i => (
              <div key={i} className="flex items-center gap-3 animate-pulse">
                <div className="w-11 h-11 rounded-full bg-muted" />
                <div className="flex-1 space-y-1">
                  <div className="h-3 w-24 bg-muted rounded" />
                  <div className="h-3 w-16 bg-muted rounded" />
                </div>
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <p className="text-center text-sm text-muted-foreground py-8">No likes yet</p>
        ) : (
          <div className="space-y-3">
            {filtered.map(u => (
              <div key={u.user_id} className="flex items-center gap-3">
                <Link to={`/user/${u.user_id}`} onClick={() => onOpenChange(false)}>
                  <Avatar className="w-11 h-11">
                    <AvatarImage src={u.avatar_url || undefined} />
                    <AvatarFallback className="bg-primary text-primary-foreground text-sm">
                      {u.full_name?.charAt(0) || u.username?.charAt(0) || 'U'}
                    </AvatarFallback>
                  </Avatar>
                </Link>
                <Link to={`/user/${u.user_id}`} onClick={() => onOpenChange(false)} className="flex-1 min-w-0">
                  <p className="font-semibold text-sm truncate">{u.username || u.full_name || 'Unknown'}</p>
                  {u.full_name && <p className="text-xs text-muted-foreground truncate">{u.full_name}</p>}
                </Link>
                {user && u.user_id !== user.id && (
                  <Button
                    size="sm"
                    variant={followingIds.has(u.user_id) ? 'outline' : 'default'}
                    className="text-xs h-8 px-4"
                    onClick={() => handleFollow(u.user_id)}
                  >
                    {followingIds.has(u.user_id) ? 'Following' : 'Follow'}
                  </Button>
                )}
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
            <DrawerTitle className="text-center">Likes</DrawerTitle>
          </DrawerHeader>
          {content}
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[70vh] flex flex-col p-0">
        <DialogHeader className="p-4 pb-2">
          <DialogTitle className="text-center">Likes</DialogTitle>
        </DialogHeader>
        {content}
      </DialogContent>
    </Dialog>
  );
};

export default LikesDialog;
