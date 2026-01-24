import { Link, useNavigate, useLocation } from 'react-router-dom';
import { User, Bookmark, Settings, LogOut, RefreshCw, MessageCircle, Bot, Moon, Sun } from 'lucide-react';
import { useTheme } from 'next-themes';
import { useAuth } from '@/contexts/AuthContext';
import { useSubscription } from '@/contexts/SubscriptionContext';
import sambalpuriPattern from '@/assets/sambalpuri-pattern.jpg';
import DeleteAccountDialog from '@/components/DeleteAccountDialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

const Header = () => {
  const { user, profile, isAdmin, signOut } = useAuth();
  const { isPremium } = useSubscription();
  const { theme, setTheme } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();

  const isAuthPage = location.pathname === '/auth';

  const handleSignOut = async () => {
    await signOut();
    navigate('/auth');
  };

  const handleRefresh = () => {
    window.location.reload();
  };

  return (
    <header className="fixed top-0 left-0 right-0 z-50">
      {/* Sambalpuri Pattern Banner - Only on Auth page */}
      {isAuthPage && (
        <div 
          className="h-16 w-full bg-cover bg-center relative"
          style={{ backgroundImage: `url(${sambalpuriPattern})` }}
        >
          <div className="absolute inset-0 bg-gradient-to-b from-transparent to-primary/60" />
          <div className="relative z-10 h-full flex items-center justify-center">
            <h1 className="text-2xl md:text-3xl font-display font-bold text-gold drop-shadow-lg tracking-wide">
              Agharia Samaj
            </h1>
          </div>
        </div>
      )}

      {/* Navigation Bar */}
      <nav className="bg-card border-b border-border px-4 py-2">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          {/* Logo/Home with Refresh */}
          <div className="flex items-center gap-2">
            <Link to="/" className="font-display text-lg font-semibold text-primary hover:text-primary/80 transition-colors">
              अघरिया समाज
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
              className="p-2 text-foreground hover:text-primary hover:bg-muted rounded-lg transition-colors"
            >
              <MessageCircle className="w-5 h-5" />
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
                    <Settings className="w-4 h-4" />
                    Settings
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
                <DropdownMenuSeparator />
                <DeleteAccountDialog />
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </nav>
    </header>
  );
};

export default Header;
