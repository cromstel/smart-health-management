import { lazy, Suspense } from 'react';
import type { ReactNode } from 'react';
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

// Lazy-loaded route components for optimized PWA code-splitting
const LandingPage = lazy(() => import('./pages/LandingPage'));
const RequestDemoPage = lazy(() => import('./pages/RequestDemoPage'));
const LoginPage = lazy(() => import('./pages/LoginPage'));
const RegisterPage = lazy(() => import('./pages/RegisterPage'));
const ForgotPasswordPage = lazy(() => import('./pages/ForgotPasswordPage'));
const ResetPasswordPage = lazy(() => import('./pages/ResetPasswordPage'));
const TwoFactorPage = lazy(() => import('./pages/TwoFactorPage'));
const DashboardPage = lazy(() => import('./pages/DashboardPage'));
const AiAssistantPage = lazy(() => import('./pages/AiAssistantPage'));
const PatientsPage = lazy(() => import('./pages/PatientsPage'));
const AppointmentsPage = lazy(() => import('./pages/AppointmentsPage'));
const HospitalsPage = lazy(() => import('./pages/HospitalsPage'));
const StaffPage = lazy(() => import('./pages/StaffPage'));
const CompanyStaffDashboardPage = lazy(() => import('./pages/CompanyStaffDashboardPage'));
const DocumentsPage = lazy(() => import('./pages/DocumentsPage'));
const PharmacyPage = lazy(() => import('./pages/PharmacyPage'));
const PurchaseOrdersPage = lazy(() => import('./pages/PurchaseOrdersPage'));
const InventoryReportsPage = lazy(() => import('./pages/InventoryReportsPage'));
const PrescriptionFulfillmentPage = lazy(() => import('./pages/PrescriptionFulfillmentPage'));
const FinancialPage = lazy(() => import('./pages/FinancialPage'));
const RolesPage = lazy(() => import('./pages/RolesPage'));
const SettingsPage = lazy(() => import('./pages/SettingsPage'));
const AuditLogsPage = lazy(() => import('./pages/AuditLogsPage'));
const SuperAdminLogin = lazy(() => import('./pages/SuperAdminLogin'));
const SuperAdminDashboard = lazy(() => import('./pages/SuperAdminDashboard'));
const SuperAdminUsers = lazy(() => import('./pages/SuperAdminUsers'));
const SuperAdminHospitals = lazy(() => import('./pages/SuperAdminHospitals'));
const SuperAdminAuditLogs = lazy(() => import('./pages/SuperAdminAuditLogs'));
const SuperAdminSettings = lazy(() => import('./pages/SuperAdminSettings'));
const SuperAdminOperations = lazy(() => import('./pages/SuperAdminOperations'));
const SharedPatientSummaryPage = lazy(() => import('./pages/SharedPatientSummaryPage'));

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
  const { isAuthenticated } = useAuth();
  useSessionTimeout();
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
