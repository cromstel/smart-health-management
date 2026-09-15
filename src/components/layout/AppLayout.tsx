import { useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { SidebarProvider } from '@/components/ui/sidebar';
import { AppSidebar } from './AppSidebar';
import { Header } from './Header';
import { PasswordChangeModal } from '@/components/security/PasswordChangeModal';
import { OfflineIndicator } from '@/components/OfflineIndicator';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { Button } from '@/components/ui/button';
import { Sparkles, RefreshCw, X } from 'lucide-react';
import { analyticsService } from '@/services/analytics';

export function AppLayout() {
  const location = useLocation();
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegistered(r) {
      console.log('Service Worker registered successfully:', r);
    },
    onRegisterError(_e) {
      // Non-fatal: SW blocked by Playwright or unsupported environment
    }
  });

  useEffect(() => {
    analyticsService.trackEvent('page_view', { path: location.pathname });
  }, [location]);

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

        {/* SW Update Toast Prompt */}
        {needRefresh && (
          <div className="fixed bottom-6 right-6 z-50 max-w-md p-4 rounded-xl border border-primary/20 bg-background shadow-2xl animate-in slide-in-from-bottom-5 duration-300 flex items-start gap-4">
            <div className="h-10 w-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center flex-shrink-0 mt-0.5">
              <Sparkles className="h-5 w-5" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-semibold text-foreground">Updates Available</h3>
              <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                A new and improved version of Smart Health workstation is ready for your clinical session.
              </p>
              <div className="flex items-center gap-2 mt-3">
                <Button
                  size="sm"
                  className="text-xs h-8 px-3 flex items-center gap-1.5"
                  onClick={() => updateServiceWorker(true)}
                >
                  <RefreshCw className="h-3.5 w-3.5 animate-spin" style={{ animationDuration: '3s' }} />
                  Reload Workstation
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-xs h-8 px-2 text-muted-foreground hover:text-foreground"
                  onClick={() => setNeedRefresh(false)}
                >
                  <X className="h-3.5 w-3.5 mr-1" />
                  Dismiss
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </SidebarProvider>
  );
}
