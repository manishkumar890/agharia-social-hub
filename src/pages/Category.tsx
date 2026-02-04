import { useParams, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { ArrowLeft, Play, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AspectRatio } from '@/components/ui/aspect-ratio';
import MobileNav from '@/components/MobileNav';
import { supabase } from '@/integrations/supabase/client';

const categoryInfo: Record<string, { title: string; description: string; icon: string; comingSoon?: boolean; special?: boolean }> = {
  apps: {
    title: 'Apps',
    description: 'Exciting apps coming soon for Agharia Samaj',
    icon: '📱',
    comingSoon: true,
  },
  news: {
    title: 'News',
    description: 'Latest news and updates from Agharia Samaj',
    icon: '📰',
  },
  devotional: {
    title: 'Devotional',
    description: 'Spiritual and religious content from Agharia Samaj',
    icon: '🙏',
  },
  movie: {
    title: 'Movie',
    description: 'Movies and entertainment content',
    icon: '🎬',
  },
  festival: {
    title: 'Festival',
    description: 'Festival celebrations and cultural events',
    icon: '🎉',
  },
  education: {
    title: 'Education',
    description: 'Educational and learning resources',
    icon: '📚',
    special: true,
  },
  videos: {
    title: 'Videos',
    description: 'Video content from Agharia Samaj',
    icon: '🎥',
  },
};

interface CategorySetting {
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

const Category = () => {
  const { categoryId } = useParams<{ categoryId: string }>();
  const navigate = useNavigate();
  const [setting, setSetting] = useState<CategorySetting | null>(null);
  const [videos, setVideos] = useState<CategoryVideo[]>([]);
  const [loading, setLoading] = useState(true);
  
  const category = categoryId ? categoryInfo[categoryId] : null;

  useEffect(() => {
    const fetchCategoryData = async () => {
      if (!categoryId) return;
      
      // Fetch category settings
      const { data: settingData } = await supabase
        .from('category_settings')
        .select('video_url, banner_url')
        .eq('category_id', categoryId)
        .maybeSingle();
      
      setSetting(settingData);
      
      // Fetch category videos
      const { data: videosData } = await supabase
        .from('category_videos')
        .select('*')
        .eq('category_id', categoryId)
        .order('created_at', { ascending: false });
      
      setVideos(videosData || []);
      setLoading(false);
    };

    fetchCategoryData();
  }, [categoryId]);

  if (!category) {
    return (
      <div className="min-h-screen bg-background pb-20">
        <div className="max-w-lg mx-auto px-4 pt-4">
          <div className="text-center py-12">
            <p className="text-muted-foreground">Category not found</p>
            <Button onClick={() => navigate('/')} className="mt-4">
              Go Home
            </Button>
          </div>
        </div>
        <MobileNav />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="max-w-lg mx-auto px-4 pt-4">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate(-1)}
            className="shrink-0"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-xl font-bold flex items-center gap-2">
              <span>{category.icon}</span>
              {category.title}
            </h1>
            <p className="text-sm text-muted-foreground">{category.description}</p>
          </div>
        </div>

        {/* Coming Soon for Apps */}
        {category.comingSoon ? (
          <div className="bg-gradient-to-br from-primary/10 via-primary/5 to-background rounded-2xl border border-primary/20 p-8 text-center">
            <div className="w-20 h-20 mx-auto mb-4 bg-primary/10 rounded-full flex items-center justify-center">
              <span className="text-4xl">🚀</span>
            </div>
            <h2 className="text-2xl font-bold mb-2 bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
              Coming Soon!
            </h2>
            <p className="text-muted-foreground mb-4">
              We're working hard to bring you amazing apps for Agharia Samaj.
            </p>
            <p className="text-sm text-muted-foreground/80">
              Stay tuned for updates!
            </p>
          </div>
        ) : category.special ? (
          <div className="bg-gradient-to-br from-blue-500/10 via-indigo-500/5 to-background rounded-2xl border border-blue-500/20 p-8 text-center">
            <div className="w-20 h-20 mx-auto mb-4 bg-blue-500/10 rounded-full flex items-center justify-center">
              <span className="text-4xl">{category.icon}</span>
            </div>
            <h2 className="text-2xl font-bold mb-3 bg-gradient-to-r from-blue-500 to-indigo-500 bg-clip-text text-transparent">
              {category.title}
            </h2>
            <p className="text-muted-foreground mb-6">
              {category.description}
            </p>
            <Button 
              className="bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 text-white px-8 py-3 rounded-full font-semibold shadow-lg"
              onClick={() => {
                const firstVideo = videos[0];
                if (firstVideo) window.open(firstVideo.video_url, '_blank');
              }}
              disabled={videos.length === 0}
            >
              <Play className="w-5 h-5 mr-2" />
              Watch Now
            </Button>
            {videos.length === 0 && (
              <p className="text-sm text-muted-foreground/60 mt-3">
                Video coming soon
              </p>
            )}
          </div>
        ) : (
          <>
            {/* Banner Image */}
            {setting?.banner_url && (
              <div className="mb-6 rounded-xl overflow-hidden border border-border">
                <AspectRatio ratio={16 / 9}>
                  <img 
                    src={setting.banner_url} 
                    alt={`${category.title} banner`}
                    className="w-full h-full object-cover"
                  />
                </AspectRatio>
              </div>
            )}

            {/* Video Grid with YouTube-style Thumbnails */}
            {videos.length > 0 && (
              <div className="space-y-4">
                <h2 className="text-lg font-semibold">{category.title} Videos</h2>
                <div className="grid grid-cols-1 gap-4">
                  {videos.map((video) => (
                    <a
                      key={video.id}
                      href={video.video_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block group"
                    >
                      <div className="relative rounded-xl overflow-hidden border border-border">
                        <AspectRatio ratio={16 / 9}>
                          <img 
                            src={video.thumbnail_url} 
                            alt="Video thumbnail"
                            className="w-full h-full object-cover transition-transform group-hover:scale-105"
                          />
                          {/* Play button overlay */}
                          <div className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                            <div className="w-16 h-16 rounded-full bg-primary/90 flex items-center justify-center">
                              <Play className="w-8 h-8 text-primary-foreground ml-1" />
                            </div>
                          </div>
                          {/* Center play icon (always visible) */}
                          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                            <div className="w-14 h-14 rounded-full bg-black/60 flex items-center justify-center group-hover:bg-primary/90 transition-colors">
                              <Play className="w-7 h-7 text-white ml-1" />
                            </div>
                          </div>
                        </AspectRatio>
                      </div>
                    </a>
                  ))}
                </div>
              </div>
            )}

            {/* Content placeholder */}
            {loading ? (
              <div className="bg-card rounded-xl border border-border p-8 text-center">
                <p className="text-muted-foreground">Loading...</p>
              </div>
            ) : !setting?.banner_url && videos.length === 0 ? (
              <div className="bg-card rounded-xl border border-border p-8 text-center">
                <div className="text-6xl mb-4">{category.icon}</div>
                <h2 className="text-lg font-semibold mb-2">{category.title} Posts</h2>
                <p className="text-muted-foreground text-sm">
                  Content for {category.title.toLowerCase()} category will appear here.
                </p>
              </div>
            ) : null}
          </>
        )}
      </div>
      <MobileNav />
    </div>
  );
};

export default Category;
