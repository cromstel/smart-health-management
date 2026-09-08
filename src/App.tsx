import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { AuditProvider } from './contexts/AuditContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { NotificationProvider } from './contexts/NotificationContext';
import { useSessionTimeout } from './hooks/useSessionTimeout';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import ForgotPasswordPage from './pages/ForgotPasswordPage';
import ResetPasswordPage from './pages/ResetPasswordPage';
import TwoFactorPage from './pages/TwoFactorPage';
import DashboardPage from './pages/DashboardPage';
import AiAssistantPage from './pages/AiAssistantPage';
import PatientsPage from './pages/PatientsPage';
import AppointmentsPage from './pages/AppointmentsPage';
import HospitalsPage from './pages/HospitalsPage';
import StaffPage from './pages/StaffPage';
import DocumentsPage from './pages/DocumentsPage';
import PharmacyPage from './pages/PharmacyPage';
import PurchaseOrdersPage from './pages/PurchaseOrdersPage';
import InventoryReportsPage from './pages/InventoryReportsPage';
import PrescriptionFulfillmentPage from './pages/PrescriptionFulfillmentPage';
import FinancialPage from './pages/FinancialPage';
import RolesPage from './pages/RolesPage';
import SettingsPage from './pages/SettingsPage';
import AuditLogsPage from './pages/AuditLogsPage';
import { AppLayout } from './components/layout/AppLayout';
import SuperAdminLogin from './pages/SuperAdminLogin';
import SuperAdminDashboard from './pages/SuperAdminDashboard';
import SuperAdminUsers from './pages/SuperAdminUsers';
import SuperAdminHospitals from './pages/SuperAdminHospitals';
import SuperAdminAuditLogs from './pages/SuperAdminAuditLogs';
import SuperAdminSettings from './pages/SuperAdminSettings';
import SuperAdminOperations from './pages/SuperAdminOperations';
import { SuperAdminLayout } from './layouts/SuperAdminLayout';
import { SuperAdminRoute } from './components/SuperAdminRoute';
import SharedPatientSummaryPage from './pages/SharedPatientSummaryPage';

import { ShortcutManager } from './components/ShortcutManager';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth();
  useSessionTimeout(); // Enable session timeout for protected routes
  return isAuthenticated ? <>{children}</> : <Navigate to="/login" replace />;
}

function AppRoutes() {
  return (
    <Routes>
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
        <Route path="ai-assistant" element={<AiAssistantPage />} />
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
              <AppRoutes />
            </NotificationProvider>
          </AuditProvider>
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  );
}

export default App;