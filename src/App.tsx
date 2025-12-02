import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Suspense, lazy } from 'react';

// Loading component for lazy-loaded routes
const PageLoader = () => (
  <div className="min-h-screen flex items-center justify-center">
    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
  </div>
);
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { AuditProvider } from './contexts/AuditContext';
import { useSessionTimeout } from './hooks/useSessionTimeout';

// Lazy load all page components for code splitting
const LoginPage = lazy(() => import('./pages/LoginPage'));
const RegisterPage = lazy(() => import('./pages/RegisterPage'));
const ForgotPasswordPage = lazy(() => import('./pages/ForgotPasswordPage'));
const ResetPasswordPage = lazy(() => import('./pages/ResetPasswordPage'));
const TwoFactorPage = lazy(() => import('./pages/TwoFactorPage'));
const DashboardPage = lazy(() => import('./pages/DashboardPage'));
const PatientsPage = lazy(() => import('./pages/PatientsPage'));
const AppointmentsPage = lazy(() => import('./pages/AppointmentsPage'));
const HospitalsPage = lazy(() => import('./pages/HospitalsPage'));
const StaffPage = lazy(() => import('./pages/StaffPage'));
const DocumentsPage = lazy(() => import('./pages/DocumentsPage'));
const PharmacyPage = lazy(() => import('./pages/PharmacyPage'));
const PurchaseOrdersPage = lazy(() => import('./pages/PurchaseOrdersPage'));
const InventoryReportsPage = lazy(() => import('./pages/InventoryReportsPage'));
const PrescriptionFulfillmentPage = lazy(() => import('./pages/PrescriptionFulfillmentPage'));
const FinancialPage = lazy(() => import('./pages/FinancialPage'));
const RolesPage = lazy(() => import('./pages/RolesPage'));
const SettingsPage = lazy(() => import('./pages/SettingsPage'));
const AuditLogsPage = lazy(() => import('./pages/AuditLogsPage'));

// Super Admin pages - separate chunk
const SuperAdminLogin = lazy(() => import('./pages/SuperAdminLogin'));
const SuperAdminDashboard = lazy(() => import('./pages/SuperAdminDashboard'));
const SuperAdminUsers = lazy(() => import('./pages/SuperAdminUsers'));
const SuperAdminHospitals = lazy(() => import('./pages/SuperAdminHospitals'));
const SuperAdminAuditLogs = lazy(() => import('./pages/SuperAdminAuditLogs'));
const SuperAdminSettings = lazy(() => import('./pages/SuperAdminSettings'));
const SuperAdminOperations = lazy(() => import('./pages/SuperAdminOperations'));

// Layout components - loaded immediately as they're needed for routing
import { AppLayout } from './components/layout/AppLayout';
import { AuthLayout } from './components/layout/AuthLayout';
import { SuperAdminLayout } from './layouts/SuperAdminLayout';
import { SuperAdminRoute } from './components/SuperAdminRoute';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth();
  useSessionTimeout(); // Enable session timeout for protected routes
  return isAuthenticated ? <>{children}</> : <Navigate to="/login" replace />;
}

function AppRoutes() {
  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        {/* Regular Login Routes */}
        <Route path="/login" element={<AuthLayout><LoginPage /></AuthLayout>} />
        <Route path="/register" element={<AuthLayout><RegisterPage /></AuthLayout>} />
        <Route path="/forgot-password" element={<AuthLayout><ForgotPasswordPage /></AuthLayout>} />
        <Route path="/reset-password" element={<AuthLayout><ResetPasswordPage /></AuthLayout>} />
        <Route path="/two-factor" element={<AuthLayout><TwoFactorPage /></AuthLayout>} />

        {/* Super Admin Routes */}
        <Route path="/super-admin/login" element={<SuperAdminLogin />} />
        <Route
          path="/super-admin"
          element={
            <SuperAdminRoute>
              <SuperAdminLayout />
            </SuperAdminRoute>
          }
        >
          <Route index element={<Navigate to="/super-admin/dashboard" replace />} />
          <Route path="dashboard" element={<SuperAdminDashboard />} />
          <Route path="users" element={<SuperAdminUsers />} />
          <Route path="hospitals" element={<SuperAdminHospitals />} />
          <Route path="audit-logs" element={<SuperAdminAuditLogs />} />
          <Route path="settings" element={<SuperAdminSettings />} />
          <Route path="operations" element={<SuperAdminOperations />} />
        </Route>

        {/* Regular App Routes */}
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <AppLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<DashboardPage />} />
          <Route path="patients" element={<PatientsPage />} />
          <Route path="appointments" element={<AppointmentsPage />} />
          <Route path="hospitals" element={<HospitalsPage />} />
          <Route path="staff" element={<StaffPage />} />
          <Route path="documents" element={<DocumentsPage />} />
          <Route path="pharmacy" element={<PharmacyPage />} />
          <Route path="purchase-orders" element={<PurchaseOrdersPage />} />
          <Route path="inventory-reports" element={<InventoryReportsPage />} />
          <Route path="prescriptions" element={<PrescriptionFulfillmentPage />} />
          <Route path="financial" element={<FinancialPage />} />
          <Route path="roles" element={<RolesPage />} />
          <Route path="audit-logs" element={<AuditLogsPage />} />
          <Route path="settings" element={<SettingsPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </Suspense>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AuditProvider>
          <div className="dark">
            <AppRoutes />
          </div>
        </AuditProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;