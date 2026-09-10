import { useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { Separator } from '@/components/ui/separator';
import { SuperAdminSidebar } from '@/components/super-admin/SuperAdminSidebar';
import { analyticsService } from '@/services/analytics';

export function SuperAdminLayout() {
  const location = useLocation();

  useEffect(() => {
    analyticsService.trackEvent('page_view', { path: location.pathname });
  }, [location]);

  return (
    <SidebarProvider defaultOpen>
      <div className="flex min-h-screen w-full bg-background">
        <SuperAdminSidebar />
        <div className="flex flex-1 flex-col min-w-0">
          <header className="sticky top-0 z-10 flex h-14 items-center gap-3 border-b border-border bg-card px-4 sm:px-6" role="banner">
            <SidebarTrigger aria-label="Toggle navigation menu" />
            <Separator orientation="vertical" className="h-5" />
            <h2 className="text-sm font-semibold text-foreground">Super Admin Console</h2>
          </header>
          <main className="flex-1 p-4 sm:p-6" id="super-admin-main" role="main">
            <Outlet />
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}