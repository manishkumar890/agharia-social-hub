import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import Header from '@/components/Header';
import CategorySlidePopup from '@/components/CategorySlidePopup';
import MobileNav from '@/components/MobileNav';
import { useIsMobile } from '@/hooks/use-mobile';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import PremiumBadge from '@/components/PremiumBadge';
import { Search as SearchIcon, Users, TrendingUp, Ban } from 'lucide-react';
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

interface User {
  id: string;
  user_id: string;
  full_name: string | null;
  username: string | null;
  avatar_url: string | null;
  phone: string;
  is_disabled: boolean;
  isPremium?: boolean;
}

interface Post {
  id: string;
  user_id: string;
  image_url: string;
  thumbnail_url: string | null;
  media_type: string;
}

const Search = () => {
  const isMobile = useIsMobile();
  const [searchTerm, setSearchTerm] = useState('');
  const [users, setUsers] = useState<User[]>([]);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [explorePosts, setExplorePosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(false);
  const [showUsers, setShowUsers] = useState(false);

  useEffect(() => {
    fetchExplorePosts();
    fetchAllUsers();
  }, []);

  useEffect(() => {
    if (searchTerm.length >= 1) {
      searchUsers();
    } else {
      setUsers([]);
    }
  }, [searchTerm]);

  const ADMIN_PHONE = '7326937200';

  const enrichWithPremium = async (profiles: User[]): Promise<User[]> => {
    const activeUserIds = profiles.filter(p => !p.is_disabled).map(p => p.user_id);
    if (activeUserIds.length === 0) return profiles;

    const { data: subscriptions } = await supabase
      .from('user_subscriptions')
      .select('user_id, plan_type')
      .in('user_id', activeUserIds);

    const premiumUserIds = new Set(
      (subscriptions || []).filter(s => s.plan_type === 'premium').map(s => s.user_id)
    );

    return profiles.map(p => ({
      ...p,
      isPremium: p.is_disabled ? false : (p.phone === ADMIN_PHONE || premiumUserIds.has(p.user_id)),
    }));
  };

  const fetchAllUsers = async () => {
    const { data } = await supabase
      .from('profiles')
      .select('id, user_id, full_name, username, avatar_url, is_disabled, phone')
      .order('full_name', { ascending: true });
    
    const enriched = await enrichWithPremium(data || []);
    setAllUsers(enriched);
  };

  const fetchExplorePosts = async () => {
    const { data } = await supabase
      .from('posts')
      .select('id, user_id, image_url, thumbnail_url, media_type')
      .order('created_at', { ascending: false })
      .limit(30);
    
    setExplorePosts(data || []);
  };

  const searchUsers = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('profiles')
      .select('id, user_id, full_name, username, avatar_url, is_disabled, phone')
      .or(`full_name.ilike.%${searchTerm}%,username.ilike.%${searchTerm}%`)
      .order('full_name', { ascending: true })
      .limit(20);
    
    const enriched = await enrichWithPremium(data || []);
    setUsers(enriched);
    setLoading(false);
  };

  const displayUsers = searchTerm.length >= 1 ? users : allUsers;

  const handleSearchClick = () => {
    setShowUsers(true);
  };

  const renderUserItem = (user: User) => (
    user.is_disabled ? (
      <div
        key={user.id}
        className="flex items-center gap-3 p-3 rounded-lg bg-destructive/10 border border-destructive/30"
      >
        <Avatar className="opacity-50 h-9 w-9">
          <AvatarImage src={user.avatar_url || undefined} />
          <AvatarFallback className="bg-muted text-muted-foreground">
            <Ban className="w-4 h-4" />
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="font-medium text-sm text-muted-foreground line-through truncate">
              {user.full_name || 'User'}
            </p>
            <Badge variant="destructive" className="text-[10px] px-1.5 py-0">
              <Ban className="w-2.5 h-2.5 mr-0.5" />
              Disabled
            </Badge>
          </div>
          <p className="text-xs text-destructive truncate">
            This user is disabled
          </p>
        </div>
      </div>
    ) : (
      <Link
        key={user.id}
        to={`/user/${user.user_id}`}
        onClick={() => setShowUsers(false)}
        className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted transition-colors"
      >
        <Avatar className="h-9 w-9">
          <AvatarImage src={user.avatar_url || undefined} />
          <AvatarFallback className="bg-primary text-primary-foreground text-sm">
            {user.full_name?.charAt(0) || 'U'}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0">
          <p className="font-medium text-sm truncate flex items-center gap-1">
            {user.full_name || 'User'}
            {user.isPremium && <PremiumBadge size="sm" />}
          </p>
          {user.username && (
            <p className="text-xs text-muted-foreground truncate">@{user.username}</p>
          )}
        </div>
      </Link>
    )
  );

  const usersContent = (
    <>
      <div className="px-4 pb-2">
        <div className="relative">
          <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search users..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
            autoFocus
          />
        </div>
      </div>
      <div className="flex items-center gap-2 px-4 py-1">
        <Users className="w-4 h-4 text-muted-foreground" />
        <span className="text-xs text-muted-foreground">
          {searchTerm ? 'Search Results' : 'All Users'}
        </span>
        <span className="text-xs text-muted-foreground ml-auto">
          {displayUsers.length} users
        </span>
      </div>
      <ScrollArea className="flex-1 px-2 pb-4" style={{ maxHeight: '448px' }}>
        {loading ? (
          <div className="space-y-2 p-2">
            {[1,2,3].map(i => (
              <div key={i} className="flex items-center gap-3 animate-pulse p-3">
                <div className="w-9 h-9 rounded-full bg-muted" />
                <div className="flex-1 space-y-1">
                  <div className="h-3 w-24 bg-muted rounded" />
                  <div className="h-3 w-16 bg-muted rounded" />
                </div>
              </div>
            ))}
          </div>
        ) : displayUsers.length === 0 ? (
          <p className="text-center text-sm text-muted-foreground py-8">No users found</p>
        ) : (
          <div className="space-y-0.5">
            {displayUsers.map(renderUserItem)}
          </div>
        )}
      </ScrollArea>
    </>
  );

  const usersDialog = isMobile ? (
    <Drawer open={showUsers} onOpenChange={setShowUsers}>
      <DrawerContent className="flex flex-col max-h-[85vh]">
        <DrawerHeader className="pb-2">
          <DrawerTitle className="text-center">Users</DrawerTitle>
        </DrawerHeader>
        {usersContent}
      </DrawerContent>
    </Drawer>
  ) : (
    <Dialog open={showUsers} onOpenChange={setShowUsers}>
      <DialogContent className="sm:max-w-md max-h-[70vh] flex flex-col p-0">
        <DialogHeader className="p-4 pb-2">
          <DialogTitle className="text-center">Users</DialogTitle>
        </DialogHeader>
        {usersContent}
      </DialogContent>
    </Dialog>
  );

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main className="pt-14 pb-20 md:pb-16">
        <div className="max-w-5xl mx-auto px-4 py-4">
          {/* Search Bar - opens drawer/dialog */}
          <div className="relative mb-6" onClick={handleSearchClick}>
            <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <Input
              placeholder="Search users..."
              readOnly
              className="pl-10 h-12 text-base bg-muted cursor-pointer"
            />
          </div>

          {/* Explore Grid */}
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm font-medium text-muted-foreground">Explore</span>
          </div>

          {explorePosts.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground">No posts to explore yet</p>
            </div>
          ) : (
            <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-1">
              {explorePosts.map((post) => (
                <Link
                  key={post.id}
                  to={`/post/${post.id}`}
                  state={{ userId: post.user_id }}
                  className="aspect-square bg-muted overflow-hidden relative"
                >
                  <img
                    src={post.media_type === 'video' && post.thumbnail_url 
                      ? post.thumbnail_url 
                      : post.image_url}
                    alt=""
                    className="w-full h-full object-cover hover:opacity-80 transition-opacity"
                  />
                  {post.media_type === 'video' && (
                    <div className="absolute top-1 right-1 bg-black/60 rounded px-1">
                      <span className="text-white text-xs">▶</span>
                    </div>
                  )}
                </Link>
              ))}
            </div>
          )}
        </div>
      </main>

      {usersDialog}
      <MobileNav />
      <CategorySlidePopup />
    </div>
  );
};

export default Search;