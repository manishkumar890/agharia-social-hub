import { useParams, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { ArrowLeft, Play, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AspectRatio } from '@/components/ui/aspect-ratio';
import MobileNav from '@/components/MobileNav';
import { supabase } from '@/integrations/supabase/client';

const categoryInfo: Record<string, { title: string; description: string; icon: string }> = {
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
  nature: {
    title: 'Nature',
    description: 'Beautiful nature and landscape content',
    icon: '🌿',
  },
  education: {
    title: 'Education',
    description: 'Educational and learning resources',
    icon: '📚',
  },
};

interface CategorySetting {
  video_url: string | null;
  banner_url: string | null;
}

const Category = () => {
  const { categoryId } = useParams<{ categoryId: string }>();
  const navigate = useNavigate();
  const [setting, setSetting] = useState<CategorySetting | null>(null);
  const [loading, setLoading] = useState(true);
  
  const category = categoryId ? categoryInfo[categoryId] : null;

  useEffect(() => {
    const fetchCategorySetting = async () => {
      if (!categoryId) return;
      
      const { data } = await supabase
        .from('category_settings')
        .select('video_url, banner_url')
        .eq('category_id', categoryId)
        .maybeSingle();
      
      setSetting(data);
      setLoading(false);
    };

    fetchCategorySetting();
  }, [categoryId]);

  if (!category) {
    return (
      <div className="min-h-screen bg-background pt-14 pb-20">
        <div className="max-w-lg mx-auto px-4">
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
    <div className="min-h-screen bg-background pt-14 pb-20">
      <div className="max-w-lg mx-auto px-4">
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

        {/* Video Link */}
        {setting?.video_url && (
          <div className="mb-6">
            <a 
              href={setting.video_url} 
              target="_blank" 
              rel="noopener noreferrer"
              className="flex items-center gap-3 p-4 bg-card rounded-xl border border-border hover:bg-muted/50 transition-colors"
            >
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                <Play className="w-6 h-6 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm sm:text-base">Watch {category.title} Video</p>
                <p className="text-xs sm:text-sm text-muted-foreground truncate">
                  Open in Google Drive
                </p>
              </div>
              <ExternalLink className="w-5 h-5 text-muted-foreground flex-shrink-0" />
            </a>
          </div>
        )}

        {/* Content placeholder */}
        {loading ? (
          <div className="bg-card rounded-xl border border-border p-8 text-center">
            <p className="text-muted-foreground">Loading...</p>
          </div>
        ) : !setting?.banner_url && !setting?.video_url ? (
          <div className="bg-card rounded-xl border border-border p-8 text-center">
            <div className="text-6xl mb-4">{category.icon}</div>
            <h2 className="text-lg font-semibold mb-2">{category.title} Posts</h2>
            <p className="text-muted-foreground text-sm">
              Content for {category.title.toLowerCase()} category will appear here.
            </p>
          </div>
        ) : null}
      </div>
      <MobileNav />
    </div>
  );
};

export default Category;
