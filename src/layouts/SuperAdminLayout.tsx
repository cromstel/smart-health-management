import { Outlet } from 'react-router-dom';
import { SuperAdminSidebar } from '@/components/super-admin/SuperAdminSidebar';
import { Footer } from '@/components/layout/Footer';

export function SuperAdminLayout() {
  return (
    <div className="flex h-screen bg-[#001F3F] relative">
      <SuperAdminSidebar />
      <main className="flex-1 overflow-y-auto">
        <Outlet />
      </main>
      <Footer />
    </div>
  );
}