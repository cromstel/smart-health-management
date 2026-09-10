import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/ui/sidebar';
import {
  LayoutDashboard,
  Users,
  Building2,
  FileText,
  Settings,
  Wrench,
  LogOut,
  Shield,
} from 'lucide-react';

const navItems = [
  { to: '/super-admin/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/super-admin/users', icon: Users, label: 'Users' },
  { to: '/super-admin/hospitals', icon: Building2, label: 'Hospitals' },
  { to: '/super-admin/audit-logs', icon: FileText, label: 'Audit Logs' },
  { to: '/super-admin/settings', icon: Settings, label: 'Settings' },
  { to: '/super-admin/operations', icon: Wrench, label: 'Operations' },
];

export function SuperAdminSidebar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = () => {
    logout();
    navigate('/super-admin/login');
  };

  const isActive = (to: string) =>
    location.pathname === to || location.pathname.startsWith(`${to}/`);

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b border-sidebar-border p-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-accent/10 flex items-center justify-center shrink-0">
            <Shield className="h-6 w-6 text-accent" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <h1 className="text-lg font-bold text-sidebar-foreground leading-tight">Super Admin</h1>
            <p className="text-xs text-sidebar-foreground/60">System Portal</p>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => {
                const active = isActive(item.to);
                return (
                  <SidebarMenuItem key={item.to}>
                    <SidebarMenuButton
                      asChild
                      isActive={active}
                      aria-current={active ? 'page' : undefined}
                      className="w-full"
                    >
                      <Link to={item.to}>
                        <item.icon className="h-4 w-4" aria-hidden="true" />
                        <span>{item.label}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border p-4">
        <div className="mb-3 rounded-lg bg-sidebar-accent px-3 py-2">
          <p className="text-sm font-medium text-sidebar-foreground truncate">{user?.name}</p>
          <p className="text-xs text-sidebar-foreground/60 truncate">{user?.email}</p>
        </div>
        <Button
          onClick={handleLogout}
          variant="outline"
          size="sm"
          className="w-full justify-start gap-2 border-sidebar-border text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent"
        >
          <LogOut className="h-4 w-4" aria-hidden="true" />
          Logout
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
}