import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Search } from 'lucide-react';
import { postsApi, followApi, uploadApi } from '@/lib/api';
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
  const { user, profile } = useAuth();
  const isMobile = useIsMobile();
  const [users, setUsers] = useState<LikeUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [followingIds, setFollowingIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (open) {
      fetchLikedUsers();
      if (profile?.user_id) fetchFollowing();
    } else {
      setSearch('');
    }
  }, [open, postId, profile?.user_id]);

  const fetchLikedUsers = async () => {
    setLoading(true);
    try {
      const likes = await postsApi.getLikes(postId);
      
      // Transform avatar URLs
      const transformedUsers = likes.map((u: any) => ({
        ...u,
        avatar_url: u.avatar_url ? uploadApi.getFileUrl(u.avatar_url) : null
      }));
      
      setUsers(transformedUsers);
    } catch (error) {
      console.error('Error fetching likes:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchFollowing = async () => {
    if (!profile?.user_id) return;
    try {
      const following = await followApi.getFollowing(profile.user_id);
      setFollowingIds(new Set(following.map((f: any) => f.user_id)));
    } catch (error) {
      console.error('Error fetching following:', error);
    }
  };

  const handleFollow = async (targetId: string) => {
    if (!profile?.user_id) return;
    try {
      const result = await followApi.toggleFollow(targetId);
      if (result.following) {
        setFollowingIds(prev => new Set(prev).add(targetId));
      } else {
        setFollowingIds(prev => { const s = new Set(prev); s.delete(targetId); return s; });
      }
    } catch (error) {
      console.error('Error toggling follow:', error);
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
                {profile && u.user_id !== profile.user_id && (
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
