import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { LogOut, Settings, Sun, Moon } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { GlobalSearch } from '@/components/search/GlobalSearch';
import { NotificationDropdown } from './NotificationDropdown';
import { PWAInstallButton } from '@/components/PWAInstallButton';
import { OfflineStatusBadge } from './OfflineStatusBadge';
import { VoiceNavigationButton } from '@/components/voice/VoiceNavigationButton';

export function Header() {
  const { user, logout } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <header className="sticky top-0 z-10 flex h-16 items-center gap-1.5 sm:gap-4 border-b border-border bg-card px-2 sm:px-6" role="banner">
      <SidebarTrigger aria-label="Toggle navigation menu" />
      <div className="min-w-0 flex-1 max-w-lg sm:mx-0">
        <GlobalSearch />
      </div>
      <div className="hidden flex-1 sm:block" />

      {/* Visual Offline Status Badge (PWA Service Worker State) */}
      <div className="hidden md:block"><OfflineStatusBadge /></div>

      {/* Global Voice Command Navigation */}
      <div className="hidden md:block"><VoiceNavigationButton /></div>

      {/* PWA In-App Install Prompt */}
      <div className="hidden md:block"><PWAInstallButton /></div>

      {/* Theme Toggle Button */}
      <Button
        variant="ghost"
        size="icon"
        onClick={toggleTheme}
        aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
        className="shrink-0 text-foreground hover:text-accent hover:bg-secondary"
        title={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
      >
        {isDark ? (
          <Sun className="h-5 w-5 text-amber-400" aria-hidden="true" />
        ) : (
          <Moon className="h-5 w-5 text-slate-700" aria-hidden="true" />
        )}
      </Button>

      {/* Notification Bell Dropdown */}
      <NotificationDropdown />

      {/* Standalone Logout Button */}
      <Button
        variant="ghost"
        size="sm"
        onClick={handleLogout}
        className="shrink-0 gap-2 text-destructive hover:text-destructive hover:bg-destructive/10 border border-transparent hover:border-destructive/20 font-medium"
        title="Sign out of system workstation"
      >
        <LogOut className="h-4 w-4" aria-hidden="true" />
        <span className="hidden md:inline">Logout</span>
      </Button>

      {/* User Profile Menu */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="relative h-10 w-10 shrink-0 rounded-full" aria-label="User menu">
            <Avatar>
              <AvatarFallback className="bg-primary text-primary-foreground">
                {user?.name?.split(' ').map((n) => n[0]).join('') || 'U'}
              </AvatarFallback>
            </Avatar>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel>
            <div className="flex flex-col space-y-1">
              <p className="text-sm font-medium">{user?.name}</p>
              <p className="text-xs text-muted-foreground">{user?.email}</p>
              <p className="text-xs text-accent font-semibold">{user?.role}</p>
            </div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => navigate('/settings')}>
            <Settings className="mr-2 h-4 w-4" aria-hidden="true" />
            System Settings
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={handleLogout} className="text-destructive focus:text-destructive">
            <LogOut className="mr-2 h-4 w-4" aria-hidden="true" />
            Logout
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}
