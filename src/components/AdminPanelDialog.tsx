import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { 
  Users, 
  FileImage, 
  MessageSquare, 
  Shield, 
  Trash2, 
  Search,
  ChevronRight,
  Settings
} from 'lucide-react';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import { DropdownMenuItem } from '@/components/ui/dropdown-menu';
import { ScrollArea } from '@/components/ui/scroll-area';

interface User {
  id: string;
  user_id: string;
  phone: string;
  full_name: string | null;
  username: string | null;
  avatar_url: string | null;
  created_at: string;
}

interface Post {
  id: string;
  user_id: string;
  image_url: string;
  caption: string | null;
  created_at: string;
  profiles?: {
    full_name: string | null;
    username: string | null;
  };
}

interface Comment {
  id: string;
  user_id: string;
  post_id: string;
  content: string;
  created_at: string;
  profiles?: {
    full_name: string | null;
  };
}

const AdminPanelDialog = () => {
  const { isAdmin } = useAuth();
  const [open, setOpen] = useState(false);
  const [users, setUsers] = useState<User[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [comments, setComments] = useState<Comment[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ users: 0, posts: 0, comments: 0 });

  useEffect(() => {
    if (open && isAdmin) {
      fetchData();
    }
  }, [open, isAdmin]);

  const fetchData = async () => {
    try {
      setLoading(true);
      
      // Fetch users
      const { data: usersData, count: usersCount } = await supabase
        .from('profiles')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false })
        .limit(100);
      
      setUsers(usersData || []);

      // Fetch posts
      const { data: postsData, count: postsCount } = await supabase
        .from('posts')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false })
        .limit(100);
      
      const postsWithProfiles = await Promise.all(
        (postsData || []).map(async (post) => {
          const { data: profile } = await supabase
            .from('profiles')
            .select('full_name, username')
            .eq('user_id', post.user_id)
            .single();
          return { ...post, profiles: profile };
        })
      );
      setPosts(postsWithProfiles as Post[]);

      // Fetch comments
      const { data: commentsData, count: commentsCount } = await supabase
        .from('comments')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false })
        .limit(100);
      
      const commentsWithProfiles = await Promise.all(
        (commentsData || []).map(async (comment) => {
          const { data: profile } = await supabase
            .from('profiles')
            .select('full_name')
            .eq('user_id', comment.user_id)
            .single();
          return { ...comment, profiles: profile };
        })
      );
      setComments(commentsWithProfiles as Comment[]);

      setStats({
        users: usersCount || 0,
        posts: postsCount || 0,
        comments: commentsCount || 0,
      });
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDeletePost = async (postId: string) => {
    if (!confirm('Are you sure you want to delete this post?')) return;

    const { error } = await supabase.from('posts').delete().eq('id', postId);
    
    if (error) {
      toast.error('Failed to delete post');
    } else {
      toast.success('Post deleted');
      setPosts(posts.filter(p => p.id !== postId));
      setStats(prev => ({ ...prev, posts: prev.posts - 1 }));
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    if (!confirm('Are you sure you want to delete this comment?')) return;

    const { error } = await supabase.from('comments').delete().eq('id', commentId);
    
    if (error) {
      toast.error('Failed to delete comment');
    } else {
      toast.success('Comment deleted');
      setComments(comments.filter(c => c.id !== commentId));
      setStats(prev => ({ ...prev, comments: prev.comments - 1 }));
    }
  };

  const filteredUsers = users.filter(u => 
    u.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.username?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.phone.includes(searchTerm)
  );

  if (!isAdmin) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <DropdownMenuItem 
          className="flex items-center gap-2 cursor-pointer text-primary font-medium"
          onSelect={(e) => e.preventDefault()}
        >
          <Shield className="w-4 h-4" />
          Admin Panel
        </DropdownMenuItem>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl font-display">
            <Shield className="w-5 h-5 text-primary" />
            Admin Panel
          </DialogTitle>
        </DialogHeader>
        
        <ScrollArea className="h-[calc(85vh-100px)]">
          <div className="pr-4 space-y-6">
            {/* Stats Cards */}
            <div className="grid grid-cols-3 gap-3">
              <Card>
                <CardContent className="flex items-center gap-3 p-4">
                  <div className="p-2 rounded-full bg-primary/10">
                    <Users className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-xl font-bold">{stats.users}</p>
                    <p className="text-xs text-muted-foreground">Users</p>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="flex items-center gap-3 p-4">
                  <div className="p-2 rounded-full bg-secondary/50">
                    <FileImage className="w-5 h-5 text-secondary-foreground" />
                  </div>
                  <div>
                    <p className="text-xl font-bold">{stats.posts}</p>
                    <p className="text-xs text-muted-foreground">Posts</p>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="flex items-center gap-3 p-4">
                  <div className="p-2 rounded-full bg-muted">
                    <MessageSquare className="w-5 h-5 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="text-xl font-bold">{stats.comments}</p>
                    <p className="text-xs text-muted-foreground">Comments</p>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Management Tabs */}
            <Tabs defaultValue="users" className="w-full">
              <TabsList className="mb-4">
                <TabsTrigger value="users" className="flex items-center gap-2">
                  <Users className="w-4 h-4" />
                  Users
                </TabsTrigger>
                <TabsTrigger value="posts" className="flex items-center gap-2">
                  <FileImage className="w-4 h-4" />
                  Posts
                </TabsTrigger>
                <TabsTrigger value="comments" className="flex items-center gap-2">
                  <MessageSquare className="w-4 h-4" />
                  Comments
                </TabsTrigger>
              </TabsList>

              {/* Users Tab */}
              <TabsContent value="users">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Registered Users</CardTitle>
                    <div className="relative mt-2">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        placeholder="Search by name, username, or phone..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-10"
                      />
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2 max-h-[300px] overflow-y-auto">
                      {loading ? (
                        <p className="text-muted-foreground text-center py-6">Loading...</p>
                      ) : filteredUsers.length === 0 ? (
                        <p className="text-muted-foreground text-center py-6">No users found</p>
                      ) : (
                        filteredUsers.map((user) => (
                          <div 
                            key={user.id} 
                            className="flex items-center justify-between p-2 rounded-lg border border-border hover:bg-muted/50 transition-colors"
                          >
                            <div className="flex items-center gap-2">
                              <Avatar className="w-8 h-8">
                                <AvatarImage src={user.avatar_url || undefined} />
                                <AvatarFallback className="bg-primary text-primary-foreground text-xs">
                                  {user.full_name?.charAt(0) || 'U'}
                                </AvatarFallback>
                              </Avatar>
                              <div>
                                <p className="font-medium text-sm">{user.full_name || 'No name'}</p>
                                <p className="text-xs text-muted-foreground">
                                  {user.username ? `@${user.username}` : user.phone}
                                </p>
                              </div>
                            </div>
                            <Badge variant="secondary" className="text-xs">
                              {formatDistanceToNow(new Date(user.created_at), { addSuffix: true })}
                            </Badge>
                          </div>
                        ))
                      )}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Posts Tab */}
              <TabsContent value="posts">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">All Posts</CardTitle>
                    <CardDescription>Manage community posts</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-3 md:grid-cols-4 gap-2 max-h-[300px] overflow-y-auto">
                      {loading ? (
                        <p className="text-muted-foreground text-center py-6 col-span-full">Loading...</p>
                      ) : posts.length === 0 ? (
                        <p className="text-muted-foreground text-center py-6 col-span-full">No posts yet</p>
                      ) : (
                        posts.map((post) => (
                          <div key={post.id} className="relative group">
                            <img
                              src={post.image_url}
                              alt={post.caption || ''}
                              className="aspect-square object-cover rounded-lg"
                            />
                            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center">
                              <Button
                                variant="destructive"
                                size="icon"
                                className="w-8 h-8"
                                onClick={() => handleDeletePost(post.id)}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                            <p className="text-xs text-muted-foreground mt-1 truncate">
                              {post.profiles?.full_name || 'Unknown'}
                            </p>
                          </div>
                        ))
                      )}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Comments Tab */}
              <TabsContent value="comments">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Recent Comments</CardTitle>
                    <CardDescription>Moderate community comments</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2 max-h-[300px] overflow-y-auto">
                      {loading ? (
                        <p className="text-muted-foreground text-center py-6">Loading...</p>
                      ) : comments.length === 0 ? (
                        <p className="text-muted-foreground text-center py-6">No comments yet</p>
                      ) : (
                        comments.map((comment) => (
                          <div 
                            key={comment.id}
                            className="flex items-start justify-between p-2 rounded-lg border border-border"
                          >
                            <div className="flex-1">
                              <p className="font-medium text-xs">{comment.profiles?.full_name || 'Unknown'}</p>
                              <p className="text-sm text-foreground">{comment.content}</p>
                              <p className="text-xs text-muted-foreground mt-1">
                                {formatDistanceToNow(new Date(comment.created_at), { addSuffix: true })}
                              </p>
                            </div>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-destructive hover:text-destructive w-8 h-8"
                              onClick={() => handleDeleteComment(comment.id)}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        ))
                      )}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};

export default AdminPanelDialog;