import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronRight, X } from 'lucide-react';
import { cn } from '@/lib/utils';

const categories = [
  { id: 'education', name: 'Education', icon: '📚', gradient: 'from-blue-500 to-indigo-500' },
  { id: 'festival', name: 'Festival', icon: '🎉', gradient: 'from-orange-400 to-pink-500' },
  { id: 'apps', name: 'Apps', icon: '📱', gradient: 'from-emerald-400 to-teal-500' },
];

const CategorySlidePopup = () => {
  const navigate = useNavigate();
  const [isVisible, setIsVisible] = useState(false);
  const [isClosing, setIsClosing] = useState(false);

  useEffect(() => {
    const hasSeenPopup = sessionStorage.getItem('category-popup-seen');
    if (!hasSeenPopup) {
      const timer = setTimeout(() => setIsVisible(true), 800);
      return () => clearTimeout(timer);
    }
  }, []);

  const handleClose = () => {
    setIsClosing(true);
    setTimeout(() => {
      setIsVisible(false);
      setIsClosing(false);
      sessionStorage.setItem('category-popup-seen', 'true');
    }, 400);
  };

  const handleCategoryClick = (categoryId: string) => {
    handleClose();
    setTimeout(() => navigate(`/category/${categoryId}`), 450);
  };

  if (!isVisible) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className={cn(
          "fixed inset-0 z-[60] bg-black/40 backdrop-blur-sm transition-opacity duration-400",
          isClosing ? "opacity-0" : "opacity-100 animate-fade-in"
        )}
        onClick={handleClose}
      />

      {/* Slide-in panel */}
      <div
        className={cn(
          "fixed right-0 top-0 bottom-0 z-[61] w-72 sm:w-80 bg-card border-l border-border shadow-2xl flex flex-col",
          isClosing ? "animate-slide-out-right" : "animate-slide-in-right"
        )}
      >
        {/* Close button */}
        <button
          onClick={handleClose}
          className="absolute top-4 left-4 w-9 h-9 rounded-full bg-muted flex items-center justify-center hover:bg-muted/80 transition-colors group"
          aria-label="Close"
        >
          <X className="w-5 h-5 text-foreground group-hover:rotate-90 transition-transform duration-300" />
        </button>

        {/* Header */}
        <div className="pt-16 px-5 pb-4">
          <h2 className="text-lg font-bold text-foreground">Explore</h2>
          <p className="text-xs text-muted-foreground mt-1">Discover categories</p>
        </div>

        {/* Category cards */}
        <div className="flex-1 px-5 space-y-3 overflow-y-auto">
          {categories.map((cat, index) => (
            <button
              key={cat.id}
              onClick={() => handleCategoryClick(cat.id)}
              className={cn(
                "w-full group rounded-2xl p-4 flex items-center gap-4 text-left transition-all duration-300",
                "bg-gradient-to-r hover:shadow-lg hover:scale-[1.02] active:scale-[0.98]",
                cat.gradient,
                "opacity-0"
              )}
              style={{
                animation: isClosing
                  ? undefined
                  : `fade-in 0.4s ease-out ${0.3 + index * 0.12}s forwards`,
              }}
            >
              <span className="text-3xl drop-shadow-md">{cat.icon}</span>
              <div className="flex-1 min-w-0">
                <span className="text-white font-semibold text-base block">{cat.name}</span>
                <span className="text-white/70 text-xs">Tap to explore</span>
              </div>
              <ChevronRight className="w-5 h-5 text-white/80 group-hover:translate-x-1 transition-transform duration-200" />
            </button>
          ))}
        </div>

        {/* Footer decoration */}
        <div className="px-5 py-6 text-center">
          <p className="text-[11px] text-muted-foreground">Agharia Samaj</p>
        </div>
      </div>
    </>
  );
};

export default CategorySlidePopup;
