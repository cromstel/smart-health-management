import { useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { SidebarProvider } from '@/components/ui/sidebar';
import { AppSidebar } from './AppSidebar';
import { Header } from './Header';
import { PasswordChangeModal } from '@/components/security/PasswordChangeModal';
import { OfflineIndicator } from '@/components/OfflineIndicator';
import { ScrollProgress } from '@/components/common/ScrollProgress';
import { TwoFactorReminder } from '@/components/TwoFactorReminder';

import { analyticsService } from '@/services/analytics';


export function AppLayout() {
  const location = useLocation();

  useEffect(() => {
    // User Timing: first post-auth render + per-navigation marks.
    if (typeof performance !== 'undefined') {
      performance.mark(`nav:${location.pathname}`);
      performance.measure('app:ready', 'app:bootstrap');
    }
    analyticsService.trackEvent('page_view', { path: location.pathname });
  }, [location]);

  return (
    <>
      <ScrollProgress />
      <SidebarProvider defaultOpen>
      <div className="flex min-h-screen w-full bg-background transition-colors duration-300 ease-in-out">
        <div className="transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] flex-shrink-0">
          <AppSidebar />
        </div>
        <div className="flex flex-1 flex-col min-w-0 transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]">
          <Header />
          <main className="flex-1 p-6 transition-all duration-300 ease-in-out" id="main-content" role="main">
            <PasswordChangeModal />
            <OfflineIndicator />
            <TwoFactorReminder />
            <Outlet />
          </main>
        </div>


      </div>
    </SidebarProvider>
    </>
  );
}