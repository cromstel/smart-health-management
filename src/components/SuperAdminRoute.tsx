import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useSessionTimeout } from '@/hooks/useSessionTimeout';
import { Loader2 } from 'lucide-react';

export function SuperAdminRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isAuthLoading, user } = useAuth();
  useSessionTimeout();

  // AuthContext restores an existing session asynchronously on mount. Wait for
  // that request to finish so direct navigation never flashes a redirect.
  if (isAuthLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background" role="status" aria-live="polite">
        <div className="flex flex-col items-center gap-3 text-muted-foreground">
          <Loader2 className="h-8 w-8 animate-spin text-accent" aria-hidden="true" />
          <p className="text-sm font-medium">Restoring session...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/super-admin/login" replace />;
  }

  if (user?.role !== 'Super Admin' && user?.role !== 'super_admin') {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}
