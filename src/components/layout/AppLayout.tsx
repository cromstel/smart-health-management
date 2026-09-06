import { Outlet } from 'react-router-dom';
import { SidebarProvider } from '@/components/ui/sidebar';
import { AppSidebar } from './AppSidebar';
import { Header } from './Header';
import { PasswordChangeModal } from '@/components/security/PasswordChangeModal';

export function AppLayout() {
  return (
    <SidebarProvider defaultOpen>
      <div className="flex min-h-screen w-full bg-background">
        <AppSidebar />
        <div className="flex flex-1 flex-col">
          <Header />
          <main className="flex-1 p-6">
            <PasswordChangeModal />
            <Outlet />
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}