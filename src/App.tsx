import { lazy, Suspense, useEffect } from 'react';
import type { ReactNode, ComponentType } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useReducedMotion } from 'motion/react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { AuditProvider } from './contexts/AuditContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { NotificationProvider } from './contexts/NotificationContext';
import { useSessionTimeout } from './hooks/useSessionTimeout';
import { AppLayout } from './components/layout/AppLayout';
import { PublicLayout } from './components/layout/PublicLayout';
import { SuperAdminLayout } from './layouts/SuperAdminLayout';
import { SuperAdminRoute } from './components/SuperAdminRoute';
import { ErrorBoundary } from './components/common/ErrorBoundary';
import { ScrollToTopButton } from './components/common/ScrollToTopButton';
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
const AboutUsPage = timedLazy('about-us', () => import('./pages/AboutUsPage'));
const ContactUsPage = timedLazy('contact-us', () => import('./pages/ContactUsPage'));
const FaqPage = timedLazy('faq', () => import('./pages/FaqPage'));
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
const SiteSuperAdminLogin = timedLazy('super-admin-login', () => import('./pages/SiteSuperAdminLogin'));
const SuperAdminForgotPasswordPage = timedLazy('super-admin-forgot-password', () => import('./pages/SuperAdminForgotPasswordPage'));
const SuperAdminResetPasswordPage = timedLazy('super-admin-reset-password', () => import('./pages/SuperAdminResetPasswordPage'));
const HospitalAdminLogin = timedLazy('admin-login', () => import('./pages/HospitalAdminLogin'));
const HospitalAdminForgotPasswordPage = timedLazy('admin-forgot-password', () => import('./pages/HospitalAdminForgotPasswordPage'));
const HospitalAdminResetPasswordPage = timedLazy('admin-reset-password', () => import('./pages/HospitalAdminResetPasswordPage'));
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

/**
 * Redirects a pre-migration auth path to its `/auth/*` equivalent while
 * carrying the query string and fragment across intact.
 *
 * Preserving them is the whole point. A password-reset link is
 * `/reset-password?token=...`; redirecting to the bare pathname drops the
 * token, so ResetPasswordPage reports "no active reset token" and the user's
 * only way out is to ask for another email. The token is single-use, so that
 * failure is not recoverable in place.
 */
function LegacyAuthRedirect({ to }: { to: string }) {
  const { search, hash } = useLocation();
  const target = `${to}${search}${hash}`;
  return <Navigate to={target} replace />;
}

function AppRoutes() {
  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        {/* Marketing routes share the responsive marketing header. */}
        <Route element={<PublicLayout />}>
          <Route path="/" element={<LandingPage />} />
          <Route path="/landing" element={<LandingPage />} />
          <Route path="/about-us/" element={<AboutUsPage />} />
          <Route path="/contact-us" element={<ContactUsPage />} />
          <Route path="/faq" element={<FaqPage />} />
          <Route path="/auth/request-demo" element={<RequestDemoPage />} />
        </Route>

        {/* Account and account-adjacent flows stay focused, without marketing navigation. */}
        <Route path="/auth/login" element={<LoginPage />} />
        <Route path="/auth/register" element={<RegisterPage />} />
        <Route path="/auth/signup" element={<RegisterPage />} />
        <Route path="/signup" element={<RegisterPage />} />
        <Route path="/auth/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/auth/reset-password" element={<ResetPasswordPage />} />
        <Route path="/auth/two-factor" element={<TwoFactorPage />} />
        <Route path="/request-demo" element={<LegacyAuthRedirect to="/auth/request-demo" />} />
        <Route path="/auth/super-admin/login" element={<SiteSuperAdminLogin />} />
        {/* Tenant administrator recovery lives on its own URLs. The site owner
            never lands in the clinical workstation's recovery flow, and the
            two audiences share no URL. */}
        <Route path="/auth/super-admin/forgot-password" element={<SuperAdminForgotPasswordPage />} />
        <Route path="/auth/super-admin/reset-password" element={<SuperAdminResetPasswordPage />} />
        <Route path="/auth/admin/login" element={<HospitalAdminLogin />} />
        {/* The tenant hospital administrator recovers on their own URLs, in their
            own portal. The clinical workforce, the hospital administrator and
            the platform site owner share no recovery page. */}
        <Route path="/auth/admin/forgot-password" element={<HospitalAdminForgotPasswordPage />} />
        <Route path="/auth/admin/reset-password" element={<HospitalAdminResetPasswordPage />} />

        {/* Compatibility redirects for the pre-migration auth paths.

            A password-reset email already in someone's inbox points at
            /reset-password?token=..., and a bare <Navigate to=...> sends it to
            the catch-all, which redirects to "/" and throws the token away. The
            user is left on the landing page with no error and no way forward,
            and the token is single-use, so a re-send is the only recovery.

            These have to carry the query string across, not just the path --
            preserving the pathname alone is what made the old
            /request-demo redirect lossy. */}
        <Route path="/reset-password" element={<LegacyAuthRedirect to="/auth/reset-password" />} />
        <Route path="/forgot-password" element={<LegacyAuthRedirect to="/auth/forgot-password" />} />
        <Route path="/login" element={<LegacyAuthRedirect to="/auth/login" />} />
        <Route path="/register" element={<LegacyAuthRedirect to="/auth/register" />} />
        <Route path="/two-factor" element={<LegacyAuthRedirect to="/auth/two-factor" />} />
        <Route path="/shared/patient-summary/:token" element={<SharedPatientSummaryPage />} />
        
        {/* Site Super Admin Auth Routes — site owner only (global scope) */}
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

/**
 * Restores the scroll position for a fragment target after a client-side
 * navigation.
 *
 * The footer and header link to landing-page sections from the company pages
 * (`/about-us/` -> `/#features`). Those are React Router navigations, and
 * declarative routing does not move the viewport the way a real page load does:
 * the URL updates and the newly mounted landing page is left wherever the
 * previous page happened to be. The visitor gets the right page at the wrong
 * offset, with no indication that the jump did not happen.
 *
 * Only acts when a hash is present. Routes without one keep whatever scroll
 * behaviour they already had; silently adding scroll-to-top everywhere would be
 * a separate, larger behaviour change.
 */
function ScrollToHash() {
  const { pathname, hash } = useLocation();
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    if (!hash) return;
    const id = decodeURIComponent(hash.slice(1));
    if (!id) return;

    // The destination is usually a lazily loaded route, so the target does not
    // exist on the first frame after navigation. Retry against a wall-clock
    // budget rather than a frame count: chunk load time is not tied to frame
    // rate, and on a slow connection 40 frames is well under a second.
    const deadline = performance.now() + 2000;
    let frame = requestAnimationFrame(function attempt() {
      const target = document.getElementById(id);
      if (target) {
        target.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
        return;
      }
      if (performance.now() < deadline) frame = requestAnimationFrame(attempt);
    });
    return () => cancelAnimationFrame(frame);
  }, [pathname, hash, reduceMotion]);

  return null;
}

function App() {
  return (
    <BrowserRouter>
      <ThemeProvider>
        <AuthProvider>
          <AuditProvider>
            <NotificationProvider>
              <ShortcutManager />
              <ScrollToHash />
              <ErrorBoundary>
                <AppRoutes />
              </ErrorBoundary>
              {/* One mount covers every public surface; the button withdraws for
                  authenticated sessions. */}
              <ScrollToTopButton />
              <ApiDebugOverlay />
            </NotificationProvider>
          </AuditProvider>
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  );
}

export default App;
