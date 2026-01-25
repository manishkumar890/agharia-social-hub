import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import Header from '@/components/Header';
import MobileNav from '@/components/MobileNav';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Users, 
  FileImage, 
  MessageSquare, 
  Shield, 
  Trash2, 
  Search,
  ArrowLeft,
  Crown,
  XCircle,
  Ban,
  CheckCircle
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
  is_disabled: boolean;
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

interface PremiumUser {
  id: string;
  user_id: string;
  plan_type: string;
  payment_id: string | null;
  amount: number | null;
  purchased_at: string | null;
  profile?: {
    full_name: string | null;
    username: string | null;
    avatar_url: string | null;
    phone: string;
  };
}

const Admin = () => {
  const navigate = useNavigate();
  const { isAdmin, loading: authLoading } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [comments, setComments] = useState<Comment[]>([]);
  const [premiumUsers, setPremiumUsers] = useState<PremiumUser[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ users: 0, posts: 0, comments: 0, premium: 0 });

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
            .maybeSingle();
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
            .maybeSingle();
          return { ...comment, profiles: profile };
        })
      );
      setComments(commentsWithProfiles as Comment[]);

      // Fetch premium users
      const { data: subscriptionsData, count: premiumCount } = await supabase
        .from('user_subscriptions')
        .select('*', { count: 'exact' })
        .eq('plan_type', 'premium')
        .order('purchased_at', { ascending: false });

      const premiumWithProfiles = await Promise.all(
        (subscriptionsData || []).map(async (sub) => {
          const { data: profile } = await supabase
            .from('profiles')
            .select('full_name, username, avatar_url, phone')
            .eq('user_id', sub.user_id)
            .maybeSingle();
          return { ...sub, profile };
        })
      );
      setPremiumUsers(premiumWithProfiles as PremiumUser[]);

      setStats({
        users: usersCount || 0,
        posts: postsCount || 0,
        comments: commentsCount || 0,
        premium: premiumCount || 0,
      });
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleDisabled = async (userId: string, currentStatus: boolean) => {
    const newStatus = !currentStatus;
    const { error } = await supabase
      .from('profiles')
      .update({ is_disabled: newStatus })
      .eq('id', userId);

    if (error) {
      toast.error('Failed to update user status');
    } else {
      toast.success(newStatus ? 'User disabled' : 'User enabled');
      setUsers(users.map(u => u.id === userId ? { ...u, is_disabled: newStatus } : u));
    }
  };

  const handleRemovePremium = async (subscriptionId: string, userId: string) => {
    if (!confirm('Are you sure you want to remove premium from this user?')) return;

    const { error } = await supabase
      .from('user_subscriptions')
      .update({ plan_type: 'free' })
      .eq('id', subscriptionId);
    
    if (error) {
      toast.error('Failed to remove premium');
    } else {
      toast.success('Premium removed successfully');
      setPremiumUsers(premiumUsers.filter(p => p.id !== subscriptionId));
      setStats(prev => ({ ...prev, premium: prev.premium - 1 }));
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
      
      <main className="pt-14 pb-20 md:pb-8">
        <div className="max-w-6xl mx-auto px-2 sm:px-4 py-4 sm:py-6">
          {/* Header */}
          <div className="flex items-center gap-3 sm:gap-4 mb-4 sm:mb-6">
            <Button variant="ghost" size="icon" onClick={() => navigate('/')}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div className="min-w-0 flex-1">
              <h1 className="text-lg sm:text-2xl font-display font-bold flex items-center gap-2">
                <Shield className="w-5 h-5 sm:w-6 sm:h-6 text-primary flex-shrink-0" />
                <span className="truncate">Admin Panel</span>
              </h1>
              <p className="text-muted-foreground text-xs sm:text-sm">Manage your community</p>
            </div>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-2 gap-2 sm:gap-4 mb-4 sm:mb-8">
            <Card>
              <CardContent className="flex items-center gap-2 sm:gap-4 p-3 sm:p-6">
                <div className="p-2 sm:p-3 rounded-full bg-primary/10 flex-shrink-0">
                  <Users className="w-4 h-4 sm:w-6 sm:h-6 text-primary" />
                </div>
                <div className="min-w-0">
                  <p className="text-lg sm:text-2xl font-bold">{stats.users}</p>
                  <p className="text-xs sm:text-sm text-muted-foreground truncate">Users</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="flex items-center gap-2 sm:gap-4 p-3 sm:p-6">
                <div className="p-2 sm:p-3 rounded-full bg-secondary/50 flex-shrink-0">
                  <FileImage className="w-4 h-4 sm:w-6 sm:h-6 text-secondary-foreground" />
                </div>
                <div className="min-w-0">
                  <p className="text-lg sm:text-2xl font-bold">{stats.posts}</p>
                  <p className="text-xs sm:text-sm text-muted-foreground truncate">Posts</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="flex items-center gap-2 sm:gap-4 p-3 sm:p-6">
                <div className="p-2 sm:p-3 rounded-full bg-muted flex-shrink-0">
                  <MessageSquare className="w-4 h-4 sm:w-6 sm:h-6 text-muted-foreground" />
                </div>
                <div className="min-w-0">
                  <p className="text-lg sm:text-2xl font-bold">{stats.comments}</p>
                  <p className="text-xs sm:text-sm text-muted-foreground truncate">Comments</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="flex items-center gap-2 sm:gap-4 p-3 sm:p-6">
                <div className="p-2 sm:p-3 rounded-full bg-amber-500/10 flex-shrink-0">
                  <Crown className="w-4 h-4 sm:w-6 sm:h-6 text-amber-500" />
                </div>
                <div className="min-w-0">
                  <p className="text-lg sm:text-2xl font-bold">{stats.premium}</p>
                  <p className="text-xs sm:text-sm text-muted-foreground truncate">Premium</p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Management Tabs */}
          <Tabs defaultValue="users" className="w-full">
            <ScrollArea className="w-full">
              <TabsList className="mb-4 sm:mb-6 w-max">
                <TabsTrigger value="users" className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm px-2 sm:px-4">
                  <Users className="w-3 h-3 sm:w-4 sm:h-4" />
                  <span className="hidden sm:inline">Users</span>
                </TabsTrigger>
                <TabsTrigger value="posts" className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm px-2 sm:px-4">
                  <FileImage className="w-3 h-3 sm:w-4 sm:h-4" />
                  <span className="hidden sm:inline">Posts</span>
                </TabsTrigger>
                <TabsTrigger value="comments" className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm px-2 sm:px-4">
                  <MessageSquare className="w-3 h-3 sm:w-4 sm:h-4" />
                  <span className="hidden sm:inline">Comments</span>
                </TabsTrigger>
                <TabsTrigger value="premium" className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm px-2 sm:px-4">
                  <Crown className="w-3 h-3 sm:w-4 sm:h-4" />
                  <span className="hidden sm:inline">Premium</span>
                </TabsTrigger>
              </TabsList>
            </ScrollArea>

            {/* Users Tab */}
            <TabsContent value="users">
              <Card>
                <CardHeader className="p-4 sm:p-6">
                  <CardTitle className="text-base sm:text-lg">Registered Users</CardTitle>
                  <CardDescription>
                    <div className="relative mt-2">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        placeholder="Search users..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-10 text-sm"
                      />
                    </div>
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-2 sm:p-6 pt-0 sm:pt-0">
                  <div className="space-y-2 sm:space-y-3">
                    {loading ? (
                      <p className="text-muted-foreground text-center py-8">Loading...</p>
                    ) : filteredUsers.length === 0 ? (
                      <p className="text-muted-foreground text-center py-8">No users found</p>
                    ) : (
                      filteredUsers.map((user) => (
                        <div 
                          key={user.id} 
                          className={`flex flex-col sm:flex-row sm:items-center justify-between p-3 rounded-lg border transition-colors gap-3 ${
                            user.is_disabled ? 'bg-destructive/10 border-destructive/30' : 'border-border hover:bg-muted/50'
                          }`}
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <Avatar className="w-10 h-10 flex-shrink-0">
                              <AvatarImage src={user.avatar_url || undefined} />
                              <AvatarFallback className="bg-primary text-primary-foreground">
                                {user.full_name?.charAt(0) || 'U'}
                              </AvatarFallback>
                            </Avatar>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <p className="font-medium text-sm sm:text-base truncate">
                                  {user.full_name || 'No name'}
                                </p>
                                {user.is_disabled && (
                                  <Badge variant="destructive" className="text-xs">
                                    <Ban className="w-3 h-3 mr-1" />
                                    Disabled
                                  </Badge>
                                )}
                              </div>
                              <p className="text-xs sm:text-sm text-muted-foreground truncate">
                                {user.username ? `@${user.username}` : user.phone}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 sm:gap-3 justify-between sm:justify-end">
                            <Badge variant="secondary" className="text-xs">
                              {formatDistanceToNow(new Date(user.created_at), { addSuffix: true })}
                            </Badge>
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-muted-foreground hidden sm:inline">
                                {user.is_disabled ? 'Disabled' : 'Active'}
                              </span>
                              <Switch
                                checked={!user.is_disabled}
                                onCheckedChange={() => handleToggleDisabled(user.id, user.is_disabled)}
                              />
                            </div>
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
                <CardHeader className="p-4 sm:p-6">
                  <CardTitle className="text-base sm:text-lg">All Posts</CardTitle>
                  <CardDescription>Manage community posts</CardDescription>
                </CardHeader>
                <CardContent className="p-2 sm:p-6 pt-0 sm:pt-0">
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-1 sm:gap-4">
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
                            className="aspect-square object-cover rounded-lg w-full"
                          />
                          <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center">
                            <Button
                              variant="destructive"
                              size="icon"
                              className="w-8 h-8 sm:w-10 sm:h-10"
                              onClick={() => handleDeletePost(post.id)}
                            >
                              <Trash2 className="w-3 h-3 sm:w-4 sm:h-4" />
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
                <CardHeader className="p-4 sm:p-6">
                  <CardTitle className="text-base sm:text-lg">Recent Comments</CardTitle>
                  <CardDescription>Moderate community comments</CardDescription>
                </CardHeader>
                <CardContent className="p-2 sm:p-6 pt-0 sm:pt-0">
                  <div className="space-y-2 sm:space-y-3">
                    {loading ? (
                      <p className="text-muted-foreground text-center py-8">Loading...</p>
                    ) : comments.length === 0 ? (
                      <p className="text-muted-foreground text-center py-8">No comments yet</p>
                    ) : (
                      comments.map((comment) => (
                        <div 
                          key={comment.id}
                          className="flex items-start justify-between p-3 rounded-lg border border-border gap-2"
                        >
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-xs sm:text-sm">{comment.profiles?.full_name || 'Unknown'}</p>
                            <p className="text-xs sm:text-sm text-foreground line-clamp-2">{comment.content}</p>
                            <p className="text-xs text-muted-foreground mt-1">
                              {formatDistanceToNow(new Date(comment.created_at), { addSuffix: true })}
                            </p>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-destructive hover:text-destructive flex-shrink-0 w-8 h-8"
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

            {/* Premium Users Tab */}
            <TabsContent value="premium">
              <Card>
                <CardHeader className="p-4 sm:p-6">
                  <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                    <Crown className="w-4 h-4 sm:w-5 sm:h-5 text-amber-500" />
                    Premium Users
                  </CardTitle>
                  <CardDescription>Manage premium subscriptions</CardDescription>
                </CardHeader>
                <CardContent className="p-2 sm:p-6 pt-0 sm:pt-0">
                  <div className="space-y-2 sm:space-y-3">
                    {loading ? (
                      <p className="text-muted-foreground text-center py-8">Loading...</p>
                    ) : premiumUsers.length === 0 ? (
                      <p className="text-muted-foreground text-center py-8">No premium users yet</p>
                    ) : (
                      premiumUsers.map((sub) => (
                        <div 
                          key={sub.id}
                          className="flex flex-col sm:flex-row sm:items-center justify-between p-3 sm:p-4 rounded-lg border border-border hover:bg-muted/50 transition-colors gap-3"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <Avatar className="w-10 h-10 flex-shrink-0">
                              <AvatarImage src={sub.profile?.avatar_url || undefined} />
                              <AvatarFallback className="bg-amber-500 text-white">
                                {sub.profile?.full_name?.charAt(0) || 'P'}
                              </AvatarFallback>
                            </Avatar>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <p className="font-medium text-sm sm:text-base truncate">{sub.profile?.full_name || 'No name'}</p>
                                <Badge className="bg-amber-500 text-white text-xs">Premium</Badge>
                              </div>
                              <p className="text-xs sm:text-sm text-muted-foreground truncate">
                                {sub.profile?.username ? `@${sub.profile.username}` : sub.profile?.phone}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                ₹{sub.amount} • {sub.purchased_at ? formatDistanceToNow(new Date(sub.purchased_at), { addSuffix: true }) : 'N/A'}
                              </p>
                            </div>
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-destructive border-destructive hover:bg-destructive hover:text-destructive-foreground w-full sm:w-auto"
                            onClick={() => handleRemovePremium(sub.id, sub.user_id)}
                          >
                            <XCircle className="w-4 h-4 mr-1" />
                            Remove
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

      <MobileNav />
    </div>
  );
};

export default Admin;