import { useAuth } from '@/contexts/AuthContext';
import { Navigate } from 'react-router-dom';
import type { ReactNode } from 'react';

const CLINICAL_ROLES = new Set([
  'doctor', 'Doctor',
  'nurse', 'Nurse',
  'pharmacist', 'Pharmacist',
  'front_desk', 'Front Desk', 'frontdesk', 'Frontdesk',
]);

export function ClinicalRoute({ children }: { children: ReactNode }) {
  const { user, isAuthenticated, isAuthLoading } = useAuth();
  if (isAuthLoading) return <div className="min-h-screen flex items-center justify-center">Loading…</div>;
  if (!isAuthenticated || !user) return <Navigate to="/auth/login" replace />;
  if (user.role && CLINICAL_ROLES.has(user.role)) return <>{children}</>;
  // Redirect admins/staff to staff dashboard, patients to portal, super admin to console
  if (user.role === 'super_admin' || user.role === 'Super Admin') return <Navigate to="/super-admin/dashboard" replace />;
  if (user.role === 'admin' || user.role === 'Admin' || user.role === 'staff' || user.role === 'Staff') return <Navigate to="/staff-dashboard" replace />;
  if (user.role === 'patient' || user.role === 'Patient') return <Navigate to="/patient-portal" replace />;
  return <Navigate to="/dashboard" replace />;
}
