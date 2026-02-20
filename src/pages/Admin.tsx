import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import Header from '@/components/Header';
import MobileNav from '@/components/MobileNav';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
  CheckCircle,
  FolderOpen,
  Video,
  Image,
  Loader2,
  Save,
  Headphones,
  Phone
} from 'lucide-react';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';

const ADMIN_PHONE = '7326937200';

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

interface CategorySetting {
  id: string;
  category_id: string;
  video_url: string | null;
  banner_url: string | null;
}

interface CategoryVideo {
  id: string;
  category_id: string;
  video_url: string;
  thumbnail_url: string;
  created_at: string;
}

interface ContactQuery {
  id: string;
  user_id: string;
  full_name: string | null;
  username: string | null;
  email: string | null;
  phone: string | null;
  query: string;
  status: string;
  created_at: string;
}

const CATEGORIES = [
  { id: 'news', name: 'News', icon: '📰' },
  { id: 'devotional', name: 'Devotional', icon: '🙏' },
  { id: 'movie', name: 'Movie', icon: '🎬' },
  { id: 'festival', name: 'Festival', icon: '🎉' },
  { id: 'education', name: 'Education', icon: '📚' },
  { id: 'videos', name: 'Videos', icon: '🎥' },
];

const MAX_BANNER_SIZE = 3 * 1024 * 1024; // 3MB

const Admin = () => {
  const navigate = useNavigate();
  const { isAdmin, loading: authLoading } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [comments, setComments] = useState<Comment[]>([]);
  const [premiumUsers, setPremiumUsers] = useState<PremiumUser[]>([]);
  const [categorySettings, setCategorySettings] = useState<CategorySetting[]>([]);
  const [categoryVideos, setCategoryVideos] = useState<CategoryVideo[]>([]);
  const [contactQueries, setContactQueries] = useState<ContactQuery[]>([]);
  const [categoryVideoUrls, setCategoryVideoUrls] = useState<Record<string, string>>({});
  const [categoryThumbnails, setCategoryThumbnails] = useState<Record<string, File | null>>({});
  const [categoryThumbnailPreviews, setCategoryThumbnailPreviews] = useState<Record<string, string>>({});
  const [savingCategory, setSavingCategory] = useState<string | null>(null);
  const [deletingVideo, setDeletingVideo] = useState<string | null>(null);
  const [uploadingBanner, setUploadingBanner] = useState<string | null>(null);
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const thumbnailInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ users: 0, posts: 0, comments: 0, premium: 0 });
  const [voiceCallEnabled, setVoiceCallEnabled] = useState(true);
  const [videoCallEnabled, setVideoCallEnabled] = useState(true);

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

  // Realtime subscription for new premium users
  useEffect(() => {
    if (!isAdmin) return;

    const channel = supabase
      .channel('admin-subscriptions')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'user_subscriptions',
        },
        async (payload) => {
          if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
            const sub = payload.new as any;
            if (sub.plan_type === 'premium') {
              const { data: profile } = await supabase
                .from('profiles')
                .select('full_name, username, avatar_url, phone')
                .eq('user_id', sub.user_id)
                .maybeSingle();
              const newPremium = { ...sub, profile } as PremiumUser;
              setPremiumUsers(prev => {
                const filtered = prev.filter(p => p.user_id !== sub.user_id);
                return [newPremium, ...filtered];
              });
              setStats(prev => ({ ...prev, premium: prev.premium + (payload.eventType === 'INSERT' ? 1 : 0) }));
            } else {
              // Plan changed away from premium (e.g. revoked)
              setPremiumUsers(prev => prev.filter(p => p.user_id !== sub.user_id));
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
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

      // Fetch category settings
      const { data: catSettings } = await supabase
        .from('category_settings')
        .select('*');
      
      setCategorySettings(catSettings || []);
      
      // Fetch category videos
      const { data: catVideos } = await supabase
        .from('category_videos')
        .select('*')
        .order('created_at', { ascending: false });
      
      setCategoryVideos(catVideos || []);
      
      // Initialize empty video URLs (for input fields)
      const videoUrls: Record<string, string> = {};
      CATEGORIES.forEach(cat => {
        videoUrls[cat.id] = '';
      });
      setCategoryVideoUrls(videoUrls);

      // Fetch contact queries
      const { data: queriesData } = await supabase
        .from('contact_queries')
        .select('*')
        .order('created_at', { ascending: false });
      
      setContactQueries((queriesData as ContactQuery[]) || []);

      // Fetch app settings for call controls
      const { data: appSettings } = await supabase
        .from('app_settings')
        .select('key, value');
      
      if (appSettings) {
        appSettings.forEach((s: { key: string; value: string }) => {
          if (s.key === 'voice_call_enabled') setVoiceCallEnabled(s.value === 'true');
          if (s.key === 'video_call_enabled') setVideoCallEnabled(s.value === 'true');
        });
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleDisabled = async (profileId: string, userIdAuth: string, currentStatus: boolean) => {
    const newStatus = !currentStatus;
    const { error } = await supabase
      .from('profiles')
      .update({ is_disabled: newStatus })
      .eq('user_id', userIdAuth);

    if (error) {
      toast.error('Failed to update user status');
    } else {
      toast.success(newStatus ? 'User disabled' : 'User enabled');
      setUsers(users.map(u => u.id === profileId ? { ...u, is_disabled: newStatus } : u));
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

  const handleThumbnailSelect = (categoryId: string, file: File) => {
    if (file.size > MAX_BANNER_SIZE) {
      toast.error('Thumbnail must be less than 3MB');
      return;
    }
    
    setCategoryThumbnails(prev => ({ ...prev, [categoryId]: file }));
    
    // Create preview URL
    const previewUrl = URL.createObjectURL(file);
    setCategoryThumbnailPreviews(prev => ({ ...prev, [categoryId]: previewUrl }));
  };

  const handleSaveCategoryVideo = async (categoryId: string) => {
    const videoUrl = categoryVideoUrls[categoryId]?.trim();
    const thumbnailFile = categoryThumbnails[categoryId];
    
    if (!videoUrl) {
      toast.error('Please enter a video URL');
      return;
    }
    
    if (!thumbnailFile) {
      toast.error('Please select a thumbnail image');
      return;
    }
    
    setSavingCategory(categoryId);
    
    try {
      // Upload thumbnail to storage
      const fileExt = thumbnailFile.name.split('.').pop();
      const fileName = `${categoryId}-${Date.now()}.${fileExt}`;
      
      const { error: uploadError } = await supabase.storage
        .from('category-banners')
        .upload(`thumbnails/${fileName}`, thumbnailFile, { upsert: true });
      
      if (uploadError) throw uploadError;
      
      // Get public URL for thumbnail
      const { data: urlData } = supabase.storage
        .from('category-banners')
        .getPublicUrl(`thumbnails/${fileName}`);
      
      const thumbnailUrl = urlData.publicUrl;
      
      // Insert into category_videos table with thumbnail
      const { data, error } = await supabase
        .from('category_videos')
        .insert({ 
          category_id: categoryId, 
          video_url: videoUrl,
          thumbnail_url: thumbnailUrl
        })
        .select()
        .single();
      
      if (error) throw error;
      
      // Add to local state
      if (data) {
        setCategoryVideos(prev => [data, ...prev]);
      }
      
      // Clear the input fields
      setCategoryVideoUrls(prev => ({ ...prev, [categoryId]: '' }));
      setCategoryThumbnails(prev => ({ ...prev, [categoryId]: null }));
      setCategoryThumbnailPreviews(prev => ({ ...prev, [categoryId]: '' }));
      
      toast.success('Video added successfully');
    } catch (error) {
      console.error('Error saving video:', error);
      toast.error('Failed to add video');
    } finally {
      setSavingCategory(null);
    }
  };

  const handleDeleteCategoryVideo = async (videoId: string, thumbnailUrl: string) => {
    if (!confirm('Are you sure you want to delete this video?')) return;
    
    setDeletingVideo(videoId);
    
    try {
      // Delete thumbnail from storage
      if (thumbnailUrl) {
        const fileName = thumbnailUrl.split('/').pop();
        if (fileName) {
          await supabase.storage.from('category-banners').remove([`thumbnails/${fileName}`]);
        }
      }
      
      const { error } = await supabase
        .from('category_videos')
        .delete()
        .eq('id', videoId);
      
      if (error) throw error;
      
      setCategoryVideos(prev => prev.filter(v => v.id !== videoId));
      toast.success('Video deleted');
    } catch (error) {
      console.error('Error deleting video:', error);
      toast.error('Failed to delete video');
    } finally {
      setDeletingVideo(null);
    }
  };

  const getCategoryVideos = (categoryId: string) => {
    return categoryVideos.filter(v => v.category_id === categoryId);
  };

  const handleBannerUpload = async (categoryId: string, file: File) => {
    if (file.size > MAX_BANNER_SIZE) {
      toast.error('Banner image must be less than 3MB');
      return;
    }

    setUploadingBanner(categoryId);
    
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${categoryId}-${Date.now()}.${fileExt}`;
      
      // Upload to storage
      const { error: uploadError } = await supabase.storage
        .from('category-banners')
        .upload(fileName, file, { upsert: true });
      
      if (uploadError) throw uploadError;
      
      // Get public URL
      const { data: urlData } = supabase.storage
        .from('category-banners')
        .getPublicUrl(fileName);
      
      const bannerUrl = urlData.publicUrl;
      
      // Save to database
      const existingSetting = categorySettings.find(cs => cs.category_id === categoryId);
      
      if (existingSetting) {
        const { error } = await supabase
          .from('category_settings')
          .update({ banner_url: bannerUrl })
          .eq('category_id', categoryId);
        
        if (error) throw error;
        
        setCategorySettings(prev => 
          prev.map(cs => cs.category_id === categoryId ? { ...cs, banner_url: bannerUrl } : cs)
        );
      } else {
        const { data, error } = await supabase
          .from('category_settings')
          .insert({ category_id: categoryId, banner_url: bannerUrl })
          .select()
          .single();
        
        if (error) throw error;
        if (data) setCategorySettings(prev => [...prev, data]);
      }
      
      toast.success('Banner uploaded');
    } catch (error) {
      console.error('Error uploading banner:', error);
      toast.error('Failed to upload banner');
    } finally {
      setUploadingBanner(null);
    }
  };

  const handleDeleteCategory = async (categoryId: string) => {
    if (!confirm('Are you sure you want to delete this category\'s video and banner permanently?')) return;

    try {
      const setting = categorySettings.find(cs => cs.category_id === categoryId);
      
      if (!setting) {
        toast.error('No settings found for this category');
        return;
      }

      // Delete banner from storage if exists
      if (setting.banner_url) {
        const fileName = setting.banner_url.split('/').pop();
        if (fileName) {
          await supabase.storage.from('category-banners').remove([fileName]);
        }
      }

      // Delete from database
      const { error } = await supabase
        .from('category_settings')
        .delete()
        .eq('category_id', categoryId);

      if (error) throw error;

      // Update local state
      setCategorySettings(prev => prev.filter(cs => cs.category_id !== categoryId));
      setCategoryVideoUrls(prev => {
        const updated = { ...prev };
        delete updated[categoryId];
        return updated;
      });

      toast.success('Category settings deleted');
    } catch (error) {
      console.error('Error deleting category:', error);
      toast.error('Failed to delete category settings');
    }
  };

  const getCategorySetting = (categoryId: string) => {
    return categorySettings.find(cs => cs.category_id === categoryId);
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
      
      <main className="pt-14 pb-20 md:pb-16">
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
                <TabsTrigger value="categories" className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm px-2 sm:px-4">
                  <FolderOpen className="w-3 h-3 sm:w-4 sm:h-4" />
                  <span className="hidden sm:inline">Categories</span>
                </TabsTrigger>
                <TabsTrigger value="support" className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm px-2 sm:px-4">
                  <Headphones className="w-3 h-3 sm:w-4 sm:h-4" />
                  <span className="hidden sm:inline">Support</span>
                </TabsTrigger>
                <TabsTrigger value="settings" className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm px-2 sm:px-4">
                  <Phone className="w-3 h-3 sm:w-4 sm:h-4" />
                  <span className="hidden sm:inline">Calls</span>
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
                            {user.phone === ADMIN_PHONE ? (
                              <Badge variant="outline" className="text-xs">
                                <Shield className="w-3 h-3 mr-1" />
                                Admin
                              </Badge>
                            ) : (
                              <div className="flex items-center gap-2">
                                <span className="text-xs text-muted-foreground hidden sm:inline">
                                  {user.is_disabled ? 'Disabled' : 'Active'}
                                </span>
                                <Switch
                                  checked={!user.is_disabled}
                                  onCheckedChange={() => handleToggleDisabled(user.id, user.user_id, user.is_disabled)}
                                />
                              </div>
                            )}
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

            {/* Categories Tab */}
            <TabsContent value="categories">
              <Card>
                <CardHeader className="p-4 sm:p-6">
                  <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                    <FolderOpen className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
                    Category Settings
                  </CardTitle>
                  <CardDescription>Add video links (Google Drive) and banner images for each category</CardDescription>
                </CardHeader>
                <CardContent className="p-2 sm:p-6 pt-0 sm:pt-0">
                  <div className="space-y-4 sm:space-y-6">
                    {CATEGORIES.map((category) => {
                      const setting = getCategorySetting(category.id);
                      return (
                        <div 
                          key={category.id}
                          className="p-4 rounded-lg border border-border"
                        >
                          <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-2">
                              <span className="text-2xl">{category.icon}</span>
                              <h3 className="font-semibold text-lg">{category.name}</h3>
                            </div>
                            {setting && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="text-destructive hover:text-destructive hover:bg-destructive/10"
                                onClick={() => handleDeleteCategory(category.id)}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            )}
                          </div>
                          
                          {/* Video URL Input */}
                          <div className="space-y-3 mb-4">
                            <Label className="flex items-center gap-2 text-sm">
                              <Video className="w-4 h-4" />
                              Add Video (URL + Thumbnail Required)
                            </Label>
                            
                            {/* Thumbnail Upload */}
                            <div className="flex items-center gap-3">
                              <input
                                type="file"
                                accept="image/*"
                                className="hidden"
                                ref={(el) => { thumbnailInputRefs.current[category.id] = el; }}
                                onChange={(e) => {
                                  const file = e.target.files?.[0];
                                  if (file) handleThumbnailSelect(category.id, file);
                                }}
                              />
                              {categoryThumbnailPreviews[category.id] ? (
                                <img 
                                  src={categoryThumbnailPreviews[category.id]} 
                                  alt="Thumbnail preview"
                                  className="w-20 h-12 object-cover rounded border"
                                />
                              ) : (
                                <div className="w-20 h-12 bg-muted rounded border flex items-center justify-center">
                                  <Image className="w-5 h-5 text-muted-foreground" />
                                </div>
                              )}
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => thumbnailInputRefs.current[category.id]?.click()}
                              >
                                <Image className="w-4 h-4 mr-1" />
                                {categoryThumbnails[category.id] ? 'Change' : 'Thumbnail'}
                              </Button>
                            </div>
                            
                            <div className="flex gap-2">
                              <Input
                                placeholder="https://drive.google.com/..."
                                value={categoryVideoUrls[category.id] || ''}
                                onChange={(e) => setCategoryVideoUrls(prev => ({
                                  ...prev,
                                  [category.id]: e.target.value
                                }))}
                                className="flex-1"
                              />
                              <Button
                                size="sm"
                                onClick={() => handleSaveCategoryVideo(category.id)}
                                disabled={savingCategory === category.id || !categoryVideoUrls[category.id]?.trim() || !categoryThumbnails[category.id]}
                              >
                                {savingCategory === category.id ? (
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                  <>
                                    <Save className="w-4 h-4 mr-1" />
                                    Add
                                  </>
                                )}
                              </Button>
                            </div>
                            
                            {/* Previously Added Videos */}
                            {getCategoryVideos(category.id).length > 0 && (
                              <div className="mt-3 space-y-2">
                                <p className="text-xs text-muted-foreground font-medium">Previously Added Videos:</p>
                                <div className="space-y-2 max-h-60 overflow-y-auto">
                                  {getCategoryVideos(category.id).map((video) => (
                                    <div 
                                      key={video.id}
                                      className="flex items-center gap-3 p-2 bg-muted/50 rounded-lg border"
                                    >
                                      {/* Thumbnail Preview */}
                                      <div className="w-16 h-10 rounded overflow-hidden flex-shrink-0 bg-muted">
                                        {video.thumbnail_url ? (
                                          <img 
                                            src={video.thumbnail_url} 
                                            alt="Thumbnail" 
                                            className="w-full h-full object-cover"
                                          />
                                        ) : (
                                          <div className="w-full h-full flex items-center justify-center">
                                            <Video className="w-4 h-4 text-muted-foreground" />
                                          </div>
                                        )}
                                      </div>
                                      <a 
                                        href={video.video_url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-xs text-primary truncate flex-1 hover:underline"
                                      >
                                        {video.video_url}
                                      </a>
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-6 w-6 text-destructive hover:text-destructive hover:bg-destructive/10 flex-shrink-0"
                                        onClick={() => handleDeleteCategoryVideo(video.id, video.thumbnail_url)}
                                        disabled={deletingVideo === video.id}
                                      >
                                        {deletingVideo === video.id ? (
                                          <Loader2 className="w-3 h-3 animate-spin" />
                                        ) : (
                                          <Trash2 className="w-3 h-3" />
                                        )}
                                      </Button>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                          
                          {/* Banner Image Upload */}
                          <div className="space-y-2">
                            <Label className="flex items-center gap-2 text-sm">
                              <Image className="w-4 h-4" />
                              Banner Image (Max 3MB)
                            </Label>
                            <div className="flex items-center gap-3">
                              {setting?.banner_url ? (
                                <img 
                                  src={setting.banner_url} 
                                  alt={`${category.name} banner`}
                                  className="w-24 h-14 object-cover rounded-lg border"
                                />
                              ) : (
                                <div className="w-24 h-14 bg-muted rounded-lg border flex items-center justify-center">
                                  <Image className="w-6 h-6 text-muted-foreground" />
                                </div>
                              )}
                              <input
                                type="file"
                                accept="image/*"
                                className="hidden"
                                ref={(el) => { fileInputRefs.current[category.id] = el; }}
                                onChange={(e) => {
                                  const file = e.target.files?.[0];
                                  if (file) handleBannerUpload(category.id, file);
                                }}
                              />
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => fileInputRefs.current[category.id]?.click()}
                                disabled={uploadingBanner === category.id}
                              >
                                {uploadingBanner === category.id ? (
                                  <>
                                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                                    Uploading...
                                  </>
                                ) : (
                                  <>
                                    <FileImage className="w-4 h-4 mr-2" />
                                    {setting?.banner_url ? 'Change' : 'Upload'}
                                  </>
                                )}
                              </Button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Support Queries Tab */}
            <TabsContent value="support">
              <Card>
                <CardHeader className="p-4 sm:p-6">
                  <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                    <Headphones className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
                    Support Queries
                  </CardTitle>
                  <CardDescription>Premium user support requests</CardDescription>
                </CardHeader>
                <CardContent className="p-2 sm:p-6 pt-0 sm:pt-0">
                  <div className="space-y-2 sm:space-y-3">
                    {loading ? (
                      <p className="text-muted-foreground text-center py-8">Loading...</p>
                    ) : contactQueries.length === 0 ? (
                      <p className="text-muted-foreground text-center py-8">No support queries yet</p>
                    ) : (
                      contactQueries.map((q) => (
                        <div 
                          key={q.id}
                          className="p-3 sm:p-4 rounded-lg border border-border hover:bg-muted/50 transition-colors"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap mb-1">
                                <p className="font-medium text-sm sm:text-base">{q.full_name || 'No name'}</p>
                                {q.username && (
                                  <span className="text-xs text-muted-foreground">@{q.username}</span>
                                )}
                                <Badge variant={q.status === 'pending' ? 'secondary' : 'outline'} className="text-xs">
                                  {q.status}
                                </Badge>
                              </div>
                              <div className="text-xs text-muted-foreground space-y-0.5 mb-2">
                                {q.email && <p>📧 {q.email}</p>}
                                {q.phone && <p>📱 {q.phone}</p>}
                              </div>
                              <p className="text-sm text-foreground bg-muted/50 p-2 rounded">{q.query}</p>
                              <p className="text-xs text-muted-foreground mt-2">
                                {formatDistanceToNow(new Date(q.created_at), { addSuffix: true })}
                              </p>
                            </div>
                            <div className="flex gap-1 flex-shrink-0">
                              {q.status === 'pending' && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="w-8 h-8 text-primary hover:text-primary"
                                  onClick={async () => {
                                    const { error } = await supabase
                                      .from('contact_queries')
                                      .update({ status: 'resolved' })
                                      .eq('id', q.id);
                                    if (!error) {
                                      setContactQueries(prev => prev.map(cq => cq.id === q.id ? { ...cq, status: 'resolved' } : cq));
                                      toast.success('Marked as resolved');
                                    }
                                  }}
                                >
                                  <CheckCircle className="w-4 h-4" />
                                </Button>
                              )}
                              <Button
                                variant="ghost"
                                size="icon"
                                className="w-8 h-8 text-destructive hover:text-destructive"
                                onClick={async () => {
                                  if (!confirm('Delete this query?')) return;
                                  const { error } = await supabase
                                    .from('contact_queries')
                                    .delete()
                                    .eq('id', q.id);
                                  if (!error) {
                                    setContactQueries(prev => prev.filter(cq => cq.id !== q.id));
                                    toast.success('Query deleted');
                                  }
                                }}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Call Settings Tab */}
            <TabsContent value="settings">
              <Card>
                <CardHeader className="p-4 sm:p-6">
                  <CardTitle className="text-base sm:text-lg">Call Settings</CardTitle>
                  <CardDescription>Enable or disable voice and video calling for all users</CardDescription>
                </CardHeader>
                <CardContent className="p-4 sm:p-6 pt-0 sm:pt-0 space-y-4">
                  <div className="flex items-center justify-between p-4 rounded-lg border border-border">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-full bg-primary/10">
                        <Phone className="w-5 h-5 text-primary" />
                      </div>
                      <div>
                        <p className="font-medium text-sm">Voice Calls</p>
                        <p className="text-xs text-muted-foreground">Allow users to make voice calls</p>
                      </div>
                    </div>
                    <Switch
                      checked={voiceCallEnabled}
                      onCheckedChange={async (checked) => {
                        const { error } = await supabase
                          .from('app_settings')
                          .update({ value: checked ? 'true' : 'false', updated_at: new Date().toISOString() })
                          .eq('key', 'voice_call_enabled');
                        if (!error) {
                          setVoiceCallEnabled(checked);
                          toast.success(checked ? 'Voice calls enabled' : 'Voice calls disabled');
                        } else {
                          toast.error('Failed to update setting');
                        }
                      }}
                    />
                  </div>
                  <div className="flex items-center justify-between p-4 rounded-lg border border-border">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-full bg-primary/10">
                        <Video className="w-5 h-5 text-primary" />
                      </div>
                      <div>
                        <p className="font-medium text-sm">Video Calls</p>
                        <p className="text-xs text-muted-foreground">Allow users to make video calls</p>
                      </div>
                    </div>
                    <Switch
                      checked={videoCallEnabled}
                      onCheckedChange={async (checked) => {
                        const { error } = await supabase
                          .from('app_settings')
                          .update({ value: checked ? 'true' : 'false', updated_at: new Date().toISOString() })
                          .eq('key', 'video_call_enabled');
                        if (!error) {
                          setVideoCallEnabled(checked);
                          toast.success(checked ? 'Video calls enabled' : 'Video calls disabled');
                        } else {
                          toast.error('Failed to update setting');
                        }
                      }}
                    />
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