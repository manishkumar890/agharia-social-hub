import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { User, Bookmark, UserPen, Settings, LogOut, RefreshCw, MessageCircle, Bot, Moon, Sun, Headphones } from 'lucide-react';
import { useTheme } from 'next-themes';
import { useAuth } from '@/contexts/AuthContext';
import { useSubscription } from '@/contexts/SubscriptionContext';
import { useMessages } from '@/contexts/MessageContext';
import sambalpuriPattern from '@/assets/sambalpuri-pattern.jpg';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import ContactUsDialog from '@/components/ContactUsDialog';

const TITLES = [
  { text: 'अघरिया समाज', lang: 'Hindi' },
  { text: 'ଅଘରିଆ ସମାଜ', lang: 'Odia' },
  { text: 'Agharia Samaj', lang: 'English' },
];

// Module-level state to persist across route changes
let globalTitleIndex = 0;
let globalIntervalId: ReturnType<typeof setInterval> | null = null;

const Header = () => {
  const { user, profile, isAdmin, signOut } = useAuth();
  const { isPremium } = useSubscription();
  const { unreadMessageCount } = useMessages();
  const { theme, setTheme } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const [titleIndex, setTitleIndex] = useState(globalTitleIndex);
  const [contactOpen, setContactOpen] = useState(false);

  const isAuthPage = location.pathname === '/auth';

  useEffect(() => {
    // Sync with global state on mount
    setTitleIndex(globalTitleIndex);

    // Only start one global interval (singleton pattern)
    if (!globalIntervalId) {
      globalIntervalId = setInterval(() => {
        globalTitleIndex = (globalTitleIndex + 1) % TITLES.length;
      }, 15000);
    }

    // Set up a local sync interval to update component state from global
    const syncInterval = setInterval(() => {
      setTitleIndex(globalTitleIndex);
    }, 100);

    return () => {
      clearInterval(syncInterval);
    };
  }, []);

  const handleSignOut = async () => {
    await signOut();
    navigate('/auth');
  };

  const handleRefresh = () => {
    window.location.reload();
  };

  return (
    <>
    <header className="fixed top-0 left-0 right-0 z-50">
      {/* Sambalpuri Pattern Banner - Only on Auth page */}
      {isAuthPage && (
        <div 
          className="h-16 w-full bg-cover bg-center relative"
          style={{ backgroundImage: `url(${sambalpuriPattern})` }}
        >
          <div className="absolute inset-0 bg-gradient-to-b from-transparent to-primary/60" />
          <div className="relative z-10 h-full flex items-center justify-center">
            <h1 className="text-2xl md:text-3xl font-display font-bold text-secondary tracking-wide">
              Agharia Samaj
            </h1>
          </div>
        </div>
      )}

      {/* Navigation Bar */}
      <nav className="bg-card border-b border-border px-4 py-2">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          {/* Logo/Home with Refresh */}
          <div className="flex items-center gap-2">
            <Link 
              to="/" 
              className="font-display text-lg font-semibold text-primary hover:text-primary/80 transition-all duration-500"
              key={titleIndex}
            >
              {TITLES[titleIndex].text}
            </Link>
            <button 
              onClick={handleRefresh}
              className="p-1.5 text-muted-foreground hover:text-primary hover:bg-muted rounded-lg transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>

          {/* Navigation Icons */}
          <div className="flex items-center gap-2">
            {/* AI Bot Button */}
            <Link
              to="/ai-chat"
              className="p-2 text-foreground hover:text-primary hover:bg-muted rounded-lg transition-colors"
            >
              <Bot className="w-5 h-5" />
            </Link>

            {/* Messages Button */}
            <Link
              to="/messages"
              className="p-2 text-foreground hover:text-primary transition-colors"
            >
              <div className="relative">
                <MessageCircle className="w-5 h-5" />
                {unreadMessageCount > 0 && (
                  <Badge 
                    variant="destructive" 
                    className="absolute -top-2 -right-2 h-4 min-w-4 px-1 flex items-center justify-center text-[10px] font-bold"
                  >
                    {unreadMessageCount > 99 ? '99+' : unreadMessageCount}
                  </Badge>
                )}
              </div>
            </Link>

            {/* Profile Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="p-1 hover:bg-muted rounded-lg transition-colors">
                  <Avatar className="w-7 h-7 border-2 border-primary/30">
                    <AvatarImage src={profile?.avatar_url || undefined} />
                    <AvatarFallback className="bg-primary text-primary-foreground text-xs">
                      {profile?.full_name?.charAt(0) || profile?.username?.charAt(0) || 'U'}
                    </AvatarFallback>
                  </Avatar>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem asChild>
                  <Link to="/profile" className="flex items-center gap-2 cursor-pointer">
                    <User className="w-4 h-4" />
                    Profile
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to="/saved" className="flex items-center gap-2 cursor-pointer">
                    <Bookmark className="w-4 h-4" />
                    Saved
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to="/settings" className="flex items-center gap-2 cursor-pointer">
                    <UserPen className="w-4 h-4" />
                    Edit Profile
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem 
                  onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                  className="flex items-center gap-2 cursor-pointer"
                >
                  {theme === 'dark' ? (
                    <>
                      <Sun className="w-4 h-4" />
                      Light Mode
                    </>
                  ) : (
                    <>
                      <Moon className="w-4 h-4" />
                      Dark Mode
                    </>
                  )}
                </DropdownMenuItem>
                {isPremium && (
                  <DropdownMenuItem 
                    onClick={() => setContactOpen(true)}
                    className="flex items-center gap-2 cursor-pointer"
                  >
                    <Headphones className="w-4 h-4" />
                    Contact Us
                  </DropdownMenuItem>
                )}
                {isAdmin && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem asChild>
                      <Link to="/admin" className="flex items-center gap-2 cursor-pointer text-primary font-medium">
                        <Settings className="w-4 h-4" />
                        Admin Panel
                      </Link>
                    </DropdownMenuItem>
                  </>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleSignOut} className="flex items-center gap-2 cursor-pointer text-destructive">
                  <LogOut className="w-4 h-4" />
                  Sign Out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </nav>
    </header>

    <ContactUsDialog open={contactOpen} onOpenChange={setContactOpen} />
    </>
  );
};

export default Header;
