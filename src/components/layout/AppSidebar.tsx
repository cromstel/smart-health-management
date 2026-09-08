import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
} from '@/components/ui/sidebar';
import {
  LayoutDashboard,
  Users,
  Calendar,
  Hospital,
  UserCog,
  FileText,
  Pill,
  DollarSign,
  Settings,
  Activity,
  Shield,
  FileCheck,
  ClipboardList,
  BarChart3,
  ClipboardCheck,
  Sparkles,
} from 'lucide-react';

const menuItems = [
  { title: 'Dashboard', icon: LayoutDashboard, path: '/dashboard' },
  { title: 'Clinical AI', icon: Sparkles, path: '/ai-assistant' },
  { title: 'Patients', icon: Users, path: '/patients' },
  { title: 'Appointments', icon: Calendar, path: '/appointments' },
  { title: 'Hospitals', icon: Hospital, path: '/hospitals' },
  { title: 'Staff', icon: UserCog, path: '/staff' },
  { title: 'Documents', icon: FileText, path: '/documents' },
  { title: 'Pharmacy', icon: Pill, path: '/pharmacy' },
  { title: 'Purchase Orders', icon: ClipboardList, path: '/purchase-orders' },
  { title: 'Inventory Reports', icon: BarChart3, path: '/inventory-reports' },
  { title: 'Prescription', icon: ClipboardCheck, path: '/prescriptions' },
  { title: 'Financial', icon: DollarSign, path: '/financial' },
];

const adminItems = [
  { title: 'Roles & Permissions', icon: Shield, path: '/roles' },
  { title: 'Audit Logs', icon: FileCheck, path: '/audit-logs' },
  { title: 'System Settings', icon: Settings, path: '/settings' },
];

export function AppSidebar() {
  const location = useLocation();
  const { hasPermission } = useAuth();

  const moduleForPath = (path: string) => {
    if (path.startsWith('/dashboard')) return 'dashboard';
    if (path.startsWith('/ai-assistant')) return 'dashboard';
    if (path.startsWith('/patients')) return 'patients';
    if (path.startsWith('/appointments')) return 'appointments';
    if (path.startsWith('/hospitals')) return 'hospital';
    if (path.startsWith('/staff')) return 'staff';
    if (path.startsWith('/documents')) return 'documents';
    if (path.startsWith('/pharmacy')) return 'pharmacy';
    if (path.startsWith('/purchase-orders')) return 'purchaseOrder';
    if (path.startsWith('/inventory-reports')) return 'pharmacy';
    if (path.startsWith('/prescriptions')) return 'pharmacy';
    if (path.startsWith('/financial')) return 'financial';
    if (path.startsWith('/roles')) return 'role';
    if (path.startsWith('/audit-logs')) return 'superAdmin';
    if (path.startsWith('/settings')) return 'settings';
    return '';
  };

  return (
    <Sidebar>
      <SidebarHeader className="border-b border-sidebar-border p-4">
        <div className="flex items-center gap-2">
          <Activity className="h-6 w-6 text-sidebar-primary" />
          <span className="text-lg font-bold text-sidebar-foreground">Health Manager</span>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Main Menu</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {menuItems.filter(mi => {
                const m = moduleForPath(mi.path);
                return m && hasPermission(`${m}:view`);
              }).map((item) => (
                <SidebarMenuItem key={item.path}>
                  <SidebarMenuButton
                    asChild
                    isActive={location.pathname === item.path}
                  >
                    <Link to={item.path}>
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        <SidebarGroup>
          <SidebarGroupLabel>Administration</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {adminItems.filter(ai => {
                const m = moduleForPath(ai.path);
                return m && hasPermission(`${m}:view`);
              }).map((item) => (
                <SidebarMenuItem key={item.path}>
                  <SidebarMenuButton
                    asChild
                    isActive={location.pathname === item.path}
                  >
                    <Link to={item.path}>
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="border-t border-sidebar-border p-4">
        <p className="text-xs text-sidebar-foreground/60">© 2024 Smart Health Manager</p>
      </SidebarFooter>
    </Sidebar>
  );
}
