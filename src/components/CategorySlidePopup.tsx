import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronRight, X } from 'lucide-react';
import { cn } from '@/lib/utils';

const categories = [
  { id: 'education', name: 'Education', icon: '📚', color: 'bg-blue-500/10 text-blue-600' },
  { id: 'festival', name: 'Festival', icon: '🎉', color: 'bg-orange-500/10 text-orange-600' },
  { id: 'apps', name: 'Apps', icon: '📱', color: 'bg-emerald-500/10 text-emerald-600' },
];

const CategorySlidePopup = () => {
  const navigate = useNavigate();
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setIsVisible(true), 1000);
    return () => clearTimeout(timer);
  }, []);

  const handleCategoryClick = (categoryId: string) => {
    setIsVisible(false);
    setTimeout(() => navigate(`/category/${categoryId}`), 350);
  };

  return (
    <div
      className={cn(
        "fixed right-0 top-1/2 -translate-y-1/2 z-[55] transition-transform duration-500 ease-out",
        isVisible ? "translate-x-0" : "translate-x-full"
      )}
    >
      {/* Close tab */}
      <button
        onClick={() => setIsVisible(false)}
        className="absolute -left-7 top-1/2 -translate-y-1/2 w-7 h-14 bg-card border border-r-0 border-border rounded-l-lg flex items-center justify-center shadow-md hover:bg-muted transition-colors"
        aria-label="Close"
      >
        <X className="w-3.5 h-3.5 text-muted-foreground" />
      </button>

      {/* Panel */}
      <div className="bg-card border border-border rounded-l-xl shadow-xl w-48 py-2 px-2 space-y-1">
        {categories.map((cat) => (
          <button
            key={cat.id}
            onClick={() => handleCategoryClick(cat.id)}
            className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg hover:bg-muted active:scale-[0.97] transition-all duration-200 group"
          >
            <span className={cn("w-8 h-8 rounded-lg flex items-center justify-center text-base", cat.color)}>
              {cat.icon}
            </span>
            <span className="text-sm font-medium text-foreground flex-1 text-left">{cat.name}</span>
            <ChevronRight className="w-3.5 h-3.5 text-muted-foreground group-hover:translate-x-0.5 transition-transform" />
          </button>
        ))}
      </div>
    </div>
  );
};

export default CategorySlidePopup;
