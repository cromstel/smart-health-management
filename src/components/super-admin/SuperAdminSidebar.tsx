import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import {
  LayoutDashboard,
  Users,
  Building2,
  FileText,
  Settings,
  Wrench,
  LogOut,
  Shield
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

  const handleLogout = () => {
    logout();
    navigate('/super-admin/login');
  };

  return (
    <aside className="w-64 bg-[#001F3F] border-r border-gray-800 flex flex-col">
      {/* Header */}
      <div className="p-6 border-b border-gray-800">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-[#00BFFF]/10 flex items-center justify-center">
            <Shield className="w-6 h-6 text-[#00BFFF]" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-white">Super Admin</h1>
            <p className="text-xs text-gray-400">System Portal</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-1">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                isActive
                  ? 'bg-[#00BFFF]/10 text-[#00BFFF]'
                  : 'text-gray-400 hover:bg-gray-800/50 hover:text-white'
              }`
            }
          >
            <item.icon className="w-5 h-5" />
            <span className="font-medium">{item.label}</span>
          </NavLink>
        ))}
      </nav>

      {/* User Profile & Logout */}
      <div className="p-4 border-t border-gray-800">
        <div className="mb-3 px-4 py-2 rounded-lg bg-gray-800/50">
          <p className="text-sm font-medium text-white">{user?.name}</p>
          <p className="text-xs text-gray-400">{user?.email}</p>
        </div>
        <Button
          onClick={handleLogout}
          variant="outline"
          className="w-full justify-start gap-2 border-gray-700 text-gray-400 hover:text-white hover:bg-gray-800"
        >
          <LogOut className="w-4 h-4" />
          Logout
        </Button>
      </div>
    </aside>
  );
}