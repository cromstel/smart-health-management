import { Outlet } from 'react-router-dom';
import { SuperAdminSidebar } from '@/components/super-admin/SuperAdminSidebar';

export function SuperAdminLayout() {
  return (
    <div className="flex h-screen bg-[#001F3F]">
      <SuperAdminSidebar />
      <main className="flex-1 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  );
}