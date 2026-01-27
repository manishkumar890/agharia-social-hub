import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Home, Search, PlusSquare, Heart, Menu, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetClose,
} from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';

const categories = [
  { id: 'news', name: 'News', icon: '📰' },
  { id: 'devotional', name: 'Devotional', icon: '🙏' },
  { id: 'movie', name: 'Movie', icon: '🎬' },
  { id: 'songs', name: 'Songs', icon: '🎵' },
  { id: 'sports', name: 'Sports', icon: '⚽' },
  { id: 'festival', name: 'Festival', icon: '🎉' },
  { id: 'nature', name: 'Nature', icon: '🌿' },
  { id: 'education', name: 'Education', icon: '📚' },
  { id: 'knowledge', name: 'Knowledge', icon: '💡' },
  { id: 'history', name: 'History', icon: '📜' },
];

const MobileNav = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const navItems = [
    { icon: Home, path: '/', label: 'Home' },
    { icon: Search, path: '/search', label: 'Search' },
    { icon: PlusSquare, path: '/create', label: 'Create' },
    { icon: Heart, path: '/notifications', label: 'Activity' },
  ];

  const handleCategoryClick = (categoryId: string) => {
    setIsMenuOpen(false);
    navigate(`/category/${categoryId}`);
  };

  return (
    <>
      <nav className="fixed bottom-0 left-0 right-0 z-50 bg-card border-t border-border md:hidden">
        <div className="flex items-center justify-around py-2">
          {navItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className={cn(
                "flex flex-col items-center gap-0.5 px-3 py-1 transition-colors",
                location.pathname === item.path 
                  ? "text-primary" 
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <item.icon className="w-6 h-6" />
              <span className="text-[10px]">{item.label}</span>
            </Link>
          ))}
          
          <button
            onClick={() => setIsMenuOpen(true)}
            className={cn(
              "flex flex-col items-center gap-0.5 px-3 py-1 transition-colors",
              isMenuOpen 
                ? "text-primary" 
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Menu className="w-6 h-6" />
            <span className="text-[10px]">Menu</span>
          </button>
        </div>
      </nav>

      <Sheet open={isMenuOpen} onOpenChange={setIsMenuOpen}>
        <SheetContent side="right" className="w-72 p-0">
          <SheetHeader className="p-4 border-b border-border">
            <SheetTitle className="text-left">Categories</SheetTitle>
          </SheetHeader>
          <ScrollArea className="h-[calc(100vh-60px)]">
            <div className="p-4 space-y-2">
              {categories.map((category) => (
                <button
                  key={category.id}
                  onClick={() => handleCategoryClick(category.id)}
                  className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-muted transition-colors text-left"
                >
                  <span className="text-2xl">{category.icon}</span>
                  <span className="font-medium">{category.name}</span>
                </button>
              ))}
            </div>
          </ScrollArea>
        </SheetContent>
      </Sheet>
    </>
  );
};

export default MobileNav;
