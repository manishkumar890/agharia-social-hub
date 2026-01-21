import { Link, useLocation } from 'react-router-dom';
import { Home, Search, PlusSquare, Heart, User } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';

const MobileNav = () => {
  const location = useLocation();
  const { profile } = useAuth();

  const navItems = [
    { icon: Home, path: '/', label: 'Home' },
    { icon: Search, path: '/search', label: 'Search' },
    { icon: PlusSquare, path: '/create', label: 'Create' },
    { icon: Heart, path: '/notifications', label: 'Activity' },
  ];

  return (
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
        
        <Link
          to="/profile"
          className={cn(
            "flex flex-col items-center gap-0.5 px-3 py-1 transition-colors",
            location.pathname === '/profile' 
              ? "text-primary" 
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          <Avatar className={cn(
            "w-6 h-6 border-2",
            location.pathname === '/profile' ? "border-primary" : "border-transparent"
          )}>
            <AvatarImage src={profile?.avatar_url || undefined} />
            <AvatarFallback className="bg-muted text-muted-foreground text-xs">
              {profile?.full_name?.charAt(0) || 'U'}
            </AvatarFallback>
          </Avatar>
          <span className="text-[10px]">Profile</span>
        </Link>
      </div>
    </nav>
  );
};

export default MobileNav;
