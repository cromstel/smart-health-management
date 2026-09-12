import { lazy, Suspense } from 'react';
import type { ReactNode, ComponentType } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { AuditProvider } from './contexts/AuditContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { NotificationProvider } from './contexts/NotificationContext';
import { useSessionTimeout } from './hooks/useSessionTimeout';
import { AppLayout } from './components/layout/AppLayout';
import { SuperAdminLayout } from './layouts/SuperAdminLayout';
import { SuperAdminRoute } from './components/SuperAdminRoute';
import { ErrorBoundary } from './components/common/ErrorBoundary';
import { ShortcutManager } from './components/ShortcutManager';
import { ApiDebugOverlay } from './components/common/ApiDebugOverlay';

// Lazy-loaded route components for optimized PWA code-splitting.
// timedLazy additionally records each chunk's fetch/eval time into the
// User Timing API (performance.measure) for Lighthouse/devtools visibility.
function timedLazy(name: string, load: () => Promise<{ default: ComponentType }>) {
  return lazy(() => {
    const startMark = `route:${name}:load-start`;
    if (typeof performance !== 'undefined') performance.mark(startMark);
    return load().then((mod) => {
      if (typeof performance !== 'undefined') {
        performance.mark(`route:${name}:load-end`);
        performance.measure(`route:${name}:load`, startMark, `route:${name}:load-end`);
      }
      return mod;
    });
  });
}

const LandingPage = timedLazy('landing', () => import('./pages/LandingPage'));
const RequestDemoPage = timedLazy('request-demo', () => import('./pages/RequestDemoPage'));
const LoginPage = timedLazy('login', () => import('./pages/LoginPage'));
const RegisterPage = timedLazy('register', () => import('./pages/RegisterPage'));
const ForgotPasswordPage = timedLazy('forgot-password', () => import('./pages/ForgotPasswordPage'));
const ResetPasswordPage = timedLazy('reset-password', () => import('./pages/ResetPasswordPage'));
const TwoFactorPage = timedLazy('two-factor', () => import('./pages/TwoFactorPage'));
const DashboardPage = timedLazy('dashboard', () => import('./pages/DashboardPage'));
const AiAssistantPage = timedLazy('ai-assistant', () => import('./pages/AiAssistantPage'));
const PatientsPage = timedLazy('patients', () => import('./pages/PatientsPage'));
const AppointmentsPage = timedLazy('appointments', () => import('./pages/AppointmentsPage'));
const HospitalsPage = timedLazy('hospitals', () => import('./pages/HospitalsPage'));
const StaffPage = timedLazy('staff', () => import('./pages/StaffPage'));
const CompanyStaffDashboardPage = timedLazy('company-staff-dashboard', () => import('./pages/CompanyStaffDashboardPage'));
const DocumentsPage = timedLazy('documents', () => import('./pages/DocumentsPage'));
const PharmacyPage = timedLazy('pharmacy', () => import('./pages/PharmacyPage'));
const PurchaseOrdersPage = timedLazy('purchase-orders', () => import('./pages/PurchaseOrdersPage'));
const InventoryReportsPage = timedLazy('inventory-reports', () => import('./pages/InventoryReportsPage'));
const PrescriptionFulfillmentPage = timedLazy('prescription-fulfillment', () => import('./pages/PrescriptionFulfillmentPage'));
const FinancialPage = timedLazy('financial', () => import('./pages/FinancialPage'));
const RolesPage = timedLazy('roles', () => import('./pages/RolesPage'));
const SettingsPage = timedLazy('settings', () => import('./pages/SettingsPage'));
const AuditLogsPage = timedLazy('audit-logs', () => import('./pages/AuditLogsPage'));
const SuperAdminLogin = timedLazy('super-admin-login', () => import('./pages/SuperAdminLogin'));
const SuperAdminDashboard = timedLazy('super-admin-dashboard', () => import('./pages/SuperAdminDashboard'));
const SuperAdminUsers = timedLazy('super-admin-users', () => import('./pages/SuperAdminUsers'));
const SuperAdminHospitals = timedLazy('super-admin-hospitals', () => import('./pages/SuperAdminHospitals'));
const SuperAdminAuditLogs = timedLazy('super-admin-audit-logs', () => import('./pages/SuperAdminAuditLogs'));
const SuperAdminSettings = timedLazy('super-admin-settings', () => import('./pages/SuperAdminSettings'));
const SuperAdminOperations = timedLazy('super-admin-operations', () => import('./pages/SuperAdminOperations'));
const SharedPatientSummaryPage = timedLazy('shared-patient-summary', () => import('./pages/SharedPatientSummaryPage'));

function PageLoader() {
  return (
    <div className="flex items-center justify-center min-h-[60vh] w-full" id="page-loader">
      <div className="flex flex-col items-center gap-3">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Loading Workstation...</p>
      </div>
    </div>
  );
}

function ProtectedRoute({ children }: { children: ReactNode }) {
  const { isAuthenticated, isAuthLoading } = useAuth();
  useSessionTimeout();
  if (isAuthLoading) return <PageLoader />;
  return isAuthenticated ? <>{children}</> : <Navigate to="/" replace />;
}

function AppRoutes() {
  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        {/* Public Landing Page */}
        <Route path="/" element={<LandingPage />} />
        <Route path="/landing" element={<LandingPage />} />
        <Route path="/request-demo" element={<RequestDemoPage />} />

        {/* Public Auth Routes */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/signup" element={<RegisterPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route path="/two-factor" element={<TwoFactorPage />} />
        <Route path="/shared/patient-summary/:token" element={<SharedPatientSummaryPage />} />
        
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
        
        {/* Regular App Routes (Protected — layout route, no path prefix) */}
        <Route
          element={
            <ProtectedRoute>
              <AppLayout />
            </ProtectedRoute>
          }
        >
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/ai-assistant" element={<AiAssistantPage />} />
          <Route path="/patients" element={<PatientsPage />} />
          <Route path="/appointments" element={<AppointmentsPage />} />
          <Route path="/hospitals" element={<HospitalsPage />} />
          <Route path="/staff" element={<StaffPage />} />
          <Route path="/staff-dashboard" element={<CompanyStaffDashboardPage />} />
          <Route path="/documents" element={<DocumentsPage />} />
          <Route path="/pharmacy" element={<PharmacyPage />} />
          <Route path="/purchase-orders" element={<PurchaseOrdersPage />} />
          <Route path="/inventory-reports" element={<InventoryReportsPage />} />
          <Route path="/prescriptions" element={<PrescriptionFulfillmentPage />} />
          <Route path="/financial" element={<FinancialPage />} />
          <Route path="/roles" element={<RolesPage />} />
          <Route path="/audit-logs" element={<AuditLogsPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}

function App() {
  return (
    <BrowserRouter>
      <ThemeProvider>
        <AuthProvider>
          <AuditProvider>
            <NotificationProvider>
              <ShortcutManager />
              <ErrorBoundary>
                <AppRoutes />
              </ErrorBoundary>
              <ApiDebugOverlay />
            </NotificationProvider>
          </AuditProvider>
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  );
}

export default App;
