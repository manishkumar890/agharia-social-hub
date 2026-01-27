import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import MobileNav from '@/components/MobileNav';

const categoryInfo: Record<string, { title: string; description: string; icon: string }> = {
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

const Category = () => {
  const { categoryId } = useParams<{ categoryId: string }>();
  const navigate = useNavigate();
  
  const category = categoryId ? categoryInfo[categoryId] : null;

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

        {/* Content placeholder */}
        <div className="bg-card rounded-xl border border-border p-8 text-center">
          <div className="text-6xl mb-4">{category.icon}</div>
          <h2 className="text-lg font-semibold mb-2">{category.title} Posts</h2>
          <p className="text-muted-foreground text-sm">
            Content for {category.title.toLowerCase()} category will appear here.
          </p>
        </div>
      </div>
      <MobileNav />
    </div>
  );
};

export default Category;
