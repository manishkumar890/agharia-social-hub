import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import Header from '@/components/Header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { 
  Users, 
  FileImage, 
  MessageSquare, 
  Shield, 
  Trash2, 
  Search,
  ArrowLeft,
  ChevronRight
} from 'lucide-react';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';

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

const Admin = () => {
  const navigate = useNavigate();
  const { isAdmin, loading: authLoading } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [comments, setComments] = useState<Comment[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ users: 0, posts: 0, comments: 0 });

  useEffect(() => {
    if (!authLoading && !isAdmin) {
      navigate('/');
      toast.error('Access denied');
    }
  }, [isAdmin, authLoading, navigate]);

  useEffect(() => {
    if (isAdmin) {
      fetchData();
    }
  }, [isAdmin]);

  const fetchData = async () => {
    try {
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

  if (authLoading || !isAdmin) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main className="pt-[calc(4rem+3.5rem)] pb-8">
        <div className="max-w-6xl mx-auto px-4 py-6">
          {/* Header */}
          <div className="flex items-center gap-4 mb-6">
            <Button variant="ghost" size="icon" onClick={() => navigate('/')}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-display font-bold flex items-center gap-2">
                <Shield className="w-6 h-6 text-primary" />
                Admin Panel
              </h1>
              <p className="text-muted-foreground text-sm">Manage your community</p>
            </div>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
            <Card>
              <CardContent className="flex items-center gap-4 p-6">
                <div className="p-3 rounded-full bg-primary/10">
                  <Users className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.users}</p>
                  <p className="text-sm text-muted-foreground">Total Users</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="flex items-center gap-4 p-6">
                <div className="p-3 rounded-full bg-secondary/50">
                  <FileImage className="w-6 h-6 text-secondary-foreground" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.posts}</p>
                  <p className="text-sm text-muted-foreground">Total Posts</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="flex items-center gap-4 p-6">
                <div className="p-3 rounded-full bg-muted">
                  <MessageSquare className="w-6 h-6 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.comments}</p>
                  <p className="text-sm text-muted-foreground">Total Comments</p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Management Tabs */}
          <Tabs defaultValue="users" className="w-full">
            <TabsList className="mb-6">
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
                <CardHeader>
                  <CardTitle>Registered Users</CardTitle>
                  <CardDescription>
                    <div className="relative mt-2">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        placeholder="Search by name, username, or phone..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-10"
                      />
                    </div>
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {loading ? (
                      <p className="text-muted-foreground text-center py-8">Loading...</p>
                    ) : filteredUsers.length === 0 ? (
                      <p className="text-muted-foreground text-center py-8">No users found</p>
                    ) : (
                      filteredUsers.map((user) => (
                        <div 
                          key={user.id} 
                          className="flex items-center justify-between p-3 rounded-lg border border-border hover:bg-muted/50 transition-colors"
                        >
                          <div className="flex items-center gap-3">
                            <Avatar>
                              <AvatarImage src={user.avatar_url || undefined} />
                              <AvatarFallback className="bg-primary text-primary-foreground">
                                {user.full_name?.charAt(0) || 'U'}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <p className="font-medium">{user.full_name || 'No name'}</p>
                              <p className="text-sm text-muted-foreground">
                                {user.username ? `@${user.username}` : user.phone}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant="secondary" className="text-xs">
                              {formatDistanceToNow(new Date(user.created_at), { addSuffix: true })}
                            </Badge>
                            <ChevronRight className="w-4 h-4 text-muted-foreground" />
                          </div>
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
                <CardHeader>
                  <CardTitle>All Posts</CardTitle>
                  <CardDescription>Manage community posts</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {loading ? (
                      <p className="text-muted-foreground text-center py-8 col-span-full">Loading...</p>
                    ) : posts.length === 0 ? (
                      <p className="text-muted-foreground text-center py-8 col-span-full">No posts yet</p>
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
                <CardHeader>
                  <CardTitle>Recent Comments</CardTitle>
                  <CardDescription>Moderate community comments</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {loading ? (
                      <p className="text-muted-foreground text-center py-8">Loading...</p>
                    ) : comments.length === 0 ? (
                      <p className="text-muted-foreground text-center py-8">No comments yet</p>
                    ) : (
                      comments.map((comment) => (
                        <div 
                          key={comment.id}
                          className="flex items-start justify-between p-3 rounded-lg border border-border"
                        >
                          <div className="flex-1">
                            <p className="font-medium text-sm">{comment.profiles?.full_name || 'Unknown'}</p>
                            <p className="text-sm text-foreground">{comment.content}</p>
                            <p className="text-xs text-muted-foreground mt-1">
                              {formatDistanceToNow(new Date(comment.created_at), { addSuffix: true })}
                            </p>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-destructive hover:text-destructive"
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
      </main>
    </div>
  );
};

export default Admin;
