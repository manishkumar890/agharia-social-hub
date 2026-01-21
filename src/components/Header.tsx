import { Link, useNavigate } from 'react-router-dom';
import { Home, Search, PlusSquare, Heart, User, Settings, LogOut, Trash2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
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
import { Button } from '@/components/ui/button';

const Header = () => {
  const { user, profile, isAdmin, signOut } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate('/auth');
  };

  return (
    <header className="fixed top-0 left-0 right-0 z-50">
      {/* Sambalpuri Pattern Banner */}
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

      {/* Navigation Bar */}
      <nav className="bg-card border-b border-border px-4 py-2">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          {/* Logo/Home */}
          <Link to="/" className="font-display text-lg font-semibold text-primary hover:text-primary/80 transition-colors">
            अघरिया समाज
          </Link>

          {/* Navigation Icons */}
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" asChild className="text-foreground hover:text-primary hover:bg-muted">
              <Link to="/">
                <Home className="w-5 h-5" />
              </Link>
            </Button>

            <Button variant="ghost" size="icon" asChild className="text-foreground hover:text-primary hover:bg-muted">
              <Link to="/search">
                <Search className="w-5 h-5" />
              </Link>
            </Button>

            <Button variant="ghost" size="icon" asChild className="text-foreground hover:text-primary hover:bg-muted">
              <Link to="/create">
                <PlusSquare className="w-5 h-5" />
              </Link>
            </Button>

            <Button variant="ghost" size="icon" asChild className="text-foreground hover:text-primary hover:bg-muted">
              <Link to="/notifications">
                <Heart className="w-5 h-5" />
              </Link>
            </Button>

            {/* Profile Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="hover:bg-muted">
                  <Avatar className="w-7 h-7 border-2 border-primary/30">
                    <AvatarImage src={profile?.avatar_url || undefined} />
                    <AvatarFallback className="bg-primary text-primary-foreground text-xs">
                      {profile?.full_name?.charAt(0) || profile?.username?.charAt(0) || 'U'}
                    </AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem asChild>
                  <Link to="/profile" className="flex items-center gap-2 cursor-pointer">
                    <User className="w-4 h-4" />
                    Profile
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to="/settings" className="flex items-center gap-2 cursor-pointer">
                    <Settings className="w-4 h-4" />
                    Settings
                  </Link>
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
