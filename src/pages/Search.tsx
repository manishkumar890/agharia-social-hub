import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import Header from '@/components/Header';
import MobileNav from '@/components/MobileNav';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Search as SearchIcon, Users, TrendingUp, Ban } from 'lucide-react';

interface User {
  id: string;
  user_id: string;
  full_name: string | null;
  username: string | null;
  avatar_url: string | null;
  is_disabled: boolean;
}

interface Post {
  id: string;
  image_url: string;
  thumbnail_url: string | null;
  media_type: string;
}

const Search = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [users, setUsers] = useState<User[]>([]);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [explorePosts, setExplorePosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);

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

  const fetchAllUsers = async () => {
    const { data } = await supabase
      .from('profiles')
      .select('id, user_id, full_name, username, avatar_url, is_disabled')
      .order('full_name', { ascending: true });
    
    setAllUsers(data || []);
  };

  const fetchExplorePosts = async () => {
    const { data } = await supabase
      .from('posts')
      .select('id, image_url, thumbnail_url, media_type')
      .order('created_at', { ascending: false })
      .limit(30);
    
    setExplorePosts(data || []);
  };

  const searchUsers = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('profiles')
      .select('id, user_id, full_name, username, avatar_url, is_disabled')
      .or(`full_name.ilike.%${searchTerm}%,username.ilike.%${searchTerm}%`)
      .order('full_name', { ascending: true })
      .limit(20);
    
    setUsers(data || []);
    setLoading(false);
  };

  const displayUsers = searchTerm.length >= 1 ? users : allUsers;

  const handleFocus = () => {
    setShowDropdown(true);
  };

  const handleBlur = () => {
    // Delay to allow click on dropdown items
    setTimeout(() => setShowDropdown(false), 200);
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
        className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted transition-colors"
      >
        <Avatar className="h-9 w-9">
          <AvatarImage src={user.avatar_url || undefined} />
          <AvatarFallback className="bg-primary text-primary-foreground text-sm">
            {user.full_name?.charAt(0) || 'U'}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0">
          <p className="font-medium text-sm truncate">{user.full_name || 'User'}</p>
          {user.username && (
            <p className="text-xs text-muted-foreground truncate">@{user.username}</p>
          )}
        </div>
      </Link>
    )
  );

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main className="pt-14 pb-20 md:pb-16">
        <div className="max-w-5xl mx-auto px-4 py-4">
          {/* Search Bar */}
          <div className="relative mb-6">
            <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <Input
              placeholder="Search users..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onFocus={handleFocus}
              onBlur={handleBlur}
              className="pl-10 h-12 text-base bg-muted"
            />

            {/* Dropdown List */}
            {showDropdown && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-popover border border-border rounded-lg shadow-lg z-50 overflow-hidden">
                <div className="flex items-center gap-2 px-3 py-2 border-b border-border">
                  <Users className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm font-medium text-muted-foreground">
                    {searchTerm ? 'Search Results' : 'All Users'}
                  </span>
                  <span className="text-xs text-muted-foreground ml-auto">
                    {displayUsers.length} users
                  </span>
                </div>
                <ScrollArea className="max-h-[300px]">
                  {loading ? (
                    <p className="text-muted-foreground text-center py-4 text-sm">Searching...</p>
                  ) : displayUsers.length === 0 ? (
                    <p className="text-muted-foreground text-center py-4 text-sm">No users found</p>
                  ) : (
                    <div className="p-1">
                      {displayUsers.map(renderUserItem)}
                    </div>
                  )}
                </ScrollArea>
              </div>
            )}
          </div>

          {/* Explore Grid */}
          {!showDropdown && (
            <>
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
            </>
          )}
        </div>
      </main>

      <MobileNav />
    </div>
  );
};

export default Search;