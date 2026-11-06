import { useAuth } from '@/contexts/AuthContext';
import { Navigate } from 'react-router-dom';
import type { ReactNode } from 'react';

export function PatientPortalRoute({ children }: { children: ReactNode }) {
  const { user, isAuthenticated, isAuthLoading } = useAuth();
  if (isAuthLoading) return <div className="min-h-screen flex items-center justify-center">Loading…</div>;
  if (!isAuthenticated) return <Navigate to="/auth/login" replace />;
  if (user?.role === 'patient' || user?.role === 'Patient') return <>{children}</>;
  // Redirect clinical/admin users back to their own dashboard
  if (user?.role === 'super_admin' || user?.role === 'Super Admin') return <Navigate to="/super-admin/dashboard" replace />;
  if (user?.role === 'admin' || user?.role === 'Admin' || user?.role === 'staff' || user?.role === 'Staff') return <Navigate to="/staff-dashboard" replace />;
  return <Navigate to="/dashboard" replace />;
}
