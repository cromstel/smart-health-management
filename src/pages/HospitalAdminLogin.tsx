import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '@/contexts/AuthContext';
import { postAuthRoute } from '@/lib/postAuthRoute';
import Logo from '@/components/Logo';
import SystemAuthorBadge from '@/components/auth/SystemAuthorBadge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Shield,
  AlertCircle,
  Lock,
  Mail,
  Eye,
  EyeOff,
  KeyRound,
  FileCheck,
  Fingerprint,
  ShieldCheck,
  Building2,
  Loader2,
} from 'lucide-react';

const DEMO_EMAIL = 'admin@smarthealth.com';
const DEMO_PASSWORD = 'Pass@135709';

const accessProtocol = [
  { icon: Fingerprint, label: 'Multi-factor enforced (TOTP required)' },
  { icon: ShieldCheck, label: 'RBAC scoped to your assigned hospital' },
  { icon: FileCheck, label: 'Immutable audit trail on every action' },
  { icon: Building2, label: 'Hospital operations & staff provisioning' },
];

function HospitalAdminLogin() {
  const [email, setEmail] = useState(() => (import.meta.env.DEV ? DEMO_EMAIL : ''));
  const [password, setPassword] = useState(() => (import.meta.env.DEV ? DEMO_PASSWORD : ''));
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { login, logout } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await login(email, password);

      if (res.requiresMfa) {
        // The pending MFA session is now active in AuthContext; the standard
        // workstation sign-in page renders the TOTP step to complete it.
        navigate('/auth/login');
        return;
      }

      const role = res.user?.role;
      const allowed = role === 'admin' || role === 'super_admin' || role === 'Super Admin';
      if (res.user && !allowed) {
        // Do not leave a denied account authenticated — clear the session
        // the mock/real provider just committed before surfacing the error.
        logout();
        setError('Access denied. Hospital administrator credentials required.');
        setLoading(false);
        return;
      }

      navigate(postAuthRoute(res.user));
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : 'Invalid hospital administrator credentials';
      setError(errMsg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid min-h-screen bg-background lg:grid-cols-[minmax(0,30%)_minmax(0,70%)]">
      {/* ── Left column: 30% form panel ─────────────────────────────────── */}
      <div className="relative flex flex-col justify-center px-4 py-6 sm:px-6 sm:py-8 lg:px-6 lg:py-6 xl:px-8 xl:py-8 2xl:px-10 [@media(max-height:860px)]:py-4">
        <div className="w-full max-w-md mx-auto space-y-4 sm:space-y-5 [@media(max-height:860px)]:space-y-3">
          {/* Header */}
          <motion.div
            className="flex flex-col items-center lg:items-start text-center lg:text-left"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
          >
            <Logo size="md" className="mb-4 [@media(max-height:860px)]:mb-2" />
            <h2 className="text-2xl font-bold tracking-tight text-foreground mb-1">Hospital Admin Portal</h2>
            <p className="text-sm text-muted-foreground">Authorised hospital administration & operations</p>
          </motion.div>

          {/* Security Warning Banner */}
          <motion.div
            className="p-3 rounded-xl bg-warning/10 border border-warning/25 text-warning flex items-center gap-2.5 text-xs"
            role="alert"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.1 }}
          >
            <Shield className="h-4 w-4 flex-shrink-0" aria-hidden="true" />
            <span className="font-medium">Restricted Portal: Privileged Hospital Administration</span>
          </motion.div>

          <Card className="border border-border bg-card shadow-lg shadow-border/50">
            <CardHeader className="space-y-3 sm:space-y-4 text-center pb-4 border-b border-border">
              <motion.div
                className="flex justify-center"
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', stiffness: 200, damping: 15, delay: 0.2 }}
              >
                <div className="h-14 w-14 rounded-2xl bg-accent/15 border border-accent/30 flex items-center justify-center shadow-inner sm:h-16 sm:w-16 [@media(max-height:860px)]:h-12 [@media(max-height:860px)]:w-12">
                  <KeyRound className="h-7 w-7 text-accent sm:h-8 sm:w-8 [@media(max-height:860px)]:h-6 [@media(max-height:860px)]:w-6" aria-hidden="true" />
                </div>
              </motion.div>

              <div>
                <div className="flex flex-wrap items-center justify-center gap-2">
                  <CardTitle className="text-lg font-bold tracking-tight text-foreground sm:text-xl">Hospital Admin Access</CardTitle>
                  <Badge variant="outline" className="text-[10px] border-accent/40 text-accent font-semibold">
                    ADMIN
                  </Badge>
                </div>
                <CardDescription className="text-xs text-muted-foreground mt-1">
                  Run your hospital facility within your RBAC scope
                </CardDescription>
              </div>
            </CardHeader>

            <CardContent className="pt-4 sm:pt-6 space-y-4 [@media(max-height:860px)]:space-y-3">
              {/* Error Alert */}
              <AnimatePresence>
                {error && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="p-3 rounded-md bg-destructive/15 border border-destructive/30 flex items-start gap-2.5 text-destructive text-xs"
                    role="alert"
                    aria-live="assertive"
                  >
                    <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" aria-hidden="true" />
                    <span className="font-medium">{error}</span>
                  </motion.div>
                )}
              </AnimatePresence>

              <form onSubmit={handleSubmit} className="space-y-3.5 sm:space-y-4 [@media(max-height:860px)]:space-y-3">
                <div className="space-y-2">
                  <Label htmlFor="admin-email" className="text-xs font-medium text-foreground flex items-center gap-1.5">
                    <Mail className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
                    Hospital Admin Email
                  </Label>
                  <Input
                    id="admin-email"
                    type="email"
                    placeholder="admin@smarthealth.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoComplete="username"
                    className="h-10 text-sm bg-background border-border transition-all duration-200 focus-visible:ring-accent"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="admin-password" className="text-xs font-medium text-foreground flex items-center gap-1.5">
                    <Lock className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
                    Hospital Password
                  </Label>
                  <div className="relative">
                    <Input
                      id="admin-password"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="Enter hospital administrator password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      autoComplete="current-password"
                      className="h-10 pr-10 text-sm bg-background border-border transition-all duration-200 focus-visible:ring-accent"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:text-foreground transition-colors"
                      title={showPassword ? 'Hide password' : 'Show password'}
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" aria-hidden="true" /> : <Eye className="h-4 w-4" aria-hidden="true" />}
                    </button>
                  </div>
                </div>

                <Button
                  type="submit"
                  className="w-full h-11 px-3 text-sm font-semibold bg-accent text-accent-foreground hover:bg-accent/90 transition-all duration-200 shadow-lg shadow-accent/20 hover:shadow-xl hover:shadow-accent/30"
                  disabled={loading}
                >
                  {loading ? (
                    <span className="flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                      Verifying Privileges...
                    </span>
                  ) : (
                    'Authenticate Hospital Session'
                  )}
                </Button>
              </form>

              {/* Audit Advisory */}
              <motion.div
                className="p-3 rounded-lg bg-muted/40 border border-border text-[11px] text-muted-foreground flex items-start gap-2"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.3, delay: 0.3 }}
              >
                <FileCheck className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-0.5" aria-hidden="true" />
                <span>All authentication transactions and administrative actions are cryptographically signed and stored in immutable audit logs.</span>
              </motion.div>
            </CardContent>

            <CardFooter className="flex-col gap-3 border-t border-border pt-4 text-xs text-muted-foreground font-mono">
              <div className="flex flex-wrap gap-x-3 gap-y-1 justify-center">
                <Link to="/auth/admin/login" className="hover:text-foreground">Hospital Portal</Link>
                <span>·</span>
                <Link to="/auth/login" className="hover:text-foreground">Public Sign In</Link>
              </div>
              <SystemAuthorBadge />
            </CardFooter>
          </Card>
        </div>
      </div>

      {/* ── Right column: 70% image panel (desktop only) ────────────────── */}
      <div className="relative hidden lg:block min-h-screen overflow-hidden">
        <img
          src="/images/admin-login-hospital.webp"
          alt="Front view of a modern African medical facility"
          className="absolute inset-0 h-full w-full object-cover object-center"
        />
        {/* Transparency overlay keeps text readable over the photograph */}
        <div className="absolute inset-0 bg-primary/60" aria-hidden="true" />

        <div className="absolute inset-0 z-10 flex flex-col justify-between gap-6 overflow-y-auto p-8 lg:p-10 xl:p-12 2xl:p-16 text-primary-foreground">
          {/* Status pill */}
          <div>
            <span className="inline-flex items-center gap-2 rounded-full bg-success/20 border border-success/30 px-3 py-1.5 text-sm font-semibold">
              <span className="h-2 w-2 rounded-full bg-success animate-pulse" aria-hidden="true" />
              System Operational
            </span>
          </div>

          {/* Value proposition */}
          <div className="max-w-xl space-y-6 xl:space-y-8">
            <div className="flex items-center gap-2 text-sm text-primary-foreground/70">
              <Building2 className="h-4 w-4" aria-hidden="true" />
              <span className="font-mono uppercase tracking-[0.2em] text-xs">Hospital administration</span>
            </div>
            <h2 className="font-display text-3xl lg:text-4xl xl:text-5xl font-semibold tracking-tight leading-[1.1]">
              One secure portal for every part of your hospital.
            </h2>
            <ul className="space-y-2.5 xl:space-y-3">
              {accessProtocol.map((item) => (
                <li key={item.label} className="flex items-center gap-3 text-sm text-primary-foreground/90">
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-foreground/10 border border-primary-foreground/20">
                    <item.icon className="h-4 w-4" aria-hidden="true" />
                  </span>
                  {item.label}
                </li>
              ))}
            </ul>
          </div>

          {/* Team strip + copyright */}
          <div className="flex items-center gap-4">
            <img
              src="/medicare-logo.webp"
              alt="Smart MediCare"
              className="h-20 w-28 object-contain"
            />
            <div className="text-sm">
              <p className="font-semibold">Your clinical team, empowered.</p>
              <p className="text-primary-foreground/70">&copy; 2026 Smart MediCare &middot; Powered by CITGROUP</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

HospitalAdminLogin.displayName = 'HospitalAdminLogin';

export default React.memo(HospitalAdminLogin);