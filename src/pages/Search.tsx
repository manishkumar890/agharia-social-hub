import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import Header from '@/components/Header';
import MobileNav from '@/components/MobileNav';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Search as SearchIcon, Users, TrendingUp } from 'lucide-react';

interface User {
  id: string;
  user_id: string;
  full_name: string | null;
  username: string | null;
  avatar_url: string | null;
}

interface Post {
  id: string;
  image_url: string;
}

const Search = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [users, setUsers] = useState<User[]>([]);
  const [explorePosts, setExplorePosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchExplorePosts();
  }, []);

  useEffect(() => {
    if (searchTerm.length >= 2) {
      searchUsers();
    } else {
      setUsers([]);
    }
  }, [searchTerm]);

  const fetchExplorePosts = async () => {
    const { data } = await supabase
      .from('posts')
      .select('id, image_url')
      .order('created_at', { ascending: false })
      .limit(30);
    
    setExplorePosts(data || []);
  };

  const searchUsers = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('profiles')
      .select('id, user_id, full_name, username, avatar_url')
      .or(`full_name.ilike.%${searchTerm}%,username.ilike.%${searchTerm}%`)
      .limit(20);
    
    setUsers(data || []);
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main className="pt-[calc(4rem+3.5rem)] pb-20 md:pb-8">
        <div className="max-w-4xl mx-auto px-4 py-4">
          {/* Search Bar */}
          <div className="relative mb-6">
            <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <Input
              placeholder="Search users..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 h-12 text-base bg-muted"
            />
          </div>

          {/* Search Results */}
          {searchTerm.length >= 2 && (
            <div className="mb-6">
              <div className="flex items-center gap-2 mb-3">
                <Users className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm font-medium text-muted-foreground">Users</span>
              </div>
              
              {loading ? (
                <p className="text-muted-foreground text-center py-4">Searching...</p>
              ) : users.length === 0 ? (
                <p className="text-muted-foreground text-center py-4">No users found</p>
              ) : (
                <div className="space-y-2">
                  {users.map((user) => (
                    <Link
                      key={user.id}
                      to={`/user/${user.user_id}`}
                      className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted transition-colors"
                    >
                      <Avatar>
                        <AvatarImage src={user.avatar_url || undefined} />
                        <AvatarFallback className="bg-primary text-primary-foreground">
                          {user.full_name?.charAt(0) || 'U'}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium">{user.full_name || 'User'}</p>
                        {user.username && (
                          <p className="text-sm text-muted-foreground">@{user.username}</p>
                        )}
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Explore Grid */}
          {!searchTerm && (
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
                <div className="grid grid-cols-3 gap-1">
                  {explorePosts.map((post) => (
                    <Link
                      key={post.id}
                      to={`/post/${post.id}`}
                      className="aspect-square bg-muted overflow-hidden"
                    >
                      <img
                        src={post.image_url}
                        alt=""
                        className="w-full h-full object-cover hover:opacity-80 transition-opacity"
                      />
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
