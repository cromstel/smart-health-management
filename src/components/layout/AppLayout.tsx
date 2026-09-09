import { Outlet } from 'react-router-dom';
import { SidebarProvider } from '@/components/ui/sidebar';
import { AppSidebar } from './AppSidebar';
import { Header } from './Header';
import { PasswordChangeModal } from '@/components/security/PasswordChangeModal';
import { OfflineIndicator } from '@/components/OfflineIndicator';

export function AppLayout() {
  return (
    <SidebarProvider defaultOpen>
      <div className="flex min-h-screen w-full bg-background transition-colors duration-300 ease-in-out">
        <div className="transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] flex-shrink-0">
          <AppSidebar />
        </div>
        <div className="flex flex-1 flex-col min-w-0 transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]">
          <Header />
          <main className="flex-1 p-6 transition-all duration-300 ease-in-out">
            <PasswordChangeModal />
            <OfflineIndicator />
            <Outlet />
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}