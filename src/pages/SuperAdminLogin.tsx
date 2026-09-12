import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '@/contexts/AuthContext';
import { AuthLayout } from '@/components/auth';
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
  ArrowLeft,
  KeyRound,
  FileCheck,
  Server,
  Activity,
  Loader2,
} from 'lucide-react';

const DEMO_EMAIL = 'superadmin@smarthealth.com';
const DEMO_PASSWORD = 'April--2024!!!!';

const SuperAdminLogin = React.memo(() => {
  const [email, setEmail] = useState(() => (import.meta.env.DEV ? DEMO_EMAIL : ''));
  const [password, setPassword] = useState(() => (import.meta.env.DEV ? DEMO_PASSWORD : ''));
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { login } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await login(email, password);

      if (res.requiresMfa) {
        // The pending MFA session is now active in AuthContext; the standard
        // workstation sign-in page renders the TOTP step to complete it.
        navigate('/login');
        return;
      }

      if (res.user && res.user.role !== 'super_admin' && res.user.role !== 'Super Admin') {
        setError('Access denied. Privileged Super Administrator credentials required.');
        setLoading(false);
        return;
      }

      navigate('/super-admin/dashboard');
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : 'Invalid Super Admin credentials';
      setError(errMsg);
    } finally {
      setLoading(false);
    }
  };

  const handleQuickFill = () => {
    setEmail(DEMO_EMAIL);
    setPassword(DEMO_PASSWORD);
    setError('');
  };

  return (
    <AuthLayout showBranding={false}>
      <div className="space-y-6">
        {/* Header */}
        <motion.div
          className="flex flex-col items-center lg:items-start text-center lg:text-left"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <div className="flex items-center gap-3 mb-4">
            <motion.div
              className="h-11 w-11 rounded-xl bg-primary flex items-center justify-center shadow-lg shadow-primary/20"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <Activity className="h-5 w-5 text-primary-foreground" aria-hidden="true" />
            </motion.div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Smart Health</h1>
          </div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground mb-1">Super Admin Portal</h2>
          <p className="text-sm text-muted-foreground">Multi-hospital governance & database provisioning</p>
        </motion.div>

        {/* Security Warning Banner */}
        <motion.div
          className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/25 text-amber-500 flex items-center gap-2.5 text-xs"
          role="alert"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.1 }}
        >
          <Shield className="h-4 w-4 flex-shrink-0" aria-hidden="true" />
          <span className="font-medium">Restricted Terminal: Privileged Infrastructure Access</span>
        </motion.div>

        <Card className="border border-border bg-card shadow-lg shadow-border/50">
          <CardHeader className="space-y-4 text-center pb-4 border-b border-border">
            <motion.div
              className="flex justify-center"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', stiffness: 200, damping: 15, delay: 0.2 }}
            >
              <div className="h-16 w-16 rounded-2xl bg-accent/15 border border-accent/30 flex items-center justify-center shadow-inner">
                <KeyRound className="h-8 w-8 text-accent" aria-hidden="true" />
              </div>
            </motion.div>

            <div>
              <div className="flex items-center justify-center gap-2">
                <CardTitle className="text-xl font-bold tracking-tight text-foreground">Root Access</CardTitle>
                <Badge variant="outline" className="text-[10px] border-accent/40 text-accent font-semibold">
                  ROOT
                </Badge>
              </div>
              <CardDescription className="text-xs text-muted-foreground mt-1">
                Master database & infrastructure control panel
              </CardDescription>
            </div>
          </CardHeader>

          <CardContent className="pt-6 space-y-4">
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

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="admin-email" className="text-xs font-medium text-foreground flex items-center gap-1.5">
                  <Mail className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
                  Super Admin Email
                </Label>
                <Input
                  id="admin-email"
                  type="email"
                  placeholder="superadmin@smarthealth.com"
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
                  Master Password
                </Label>
                <div className="relative">
                  <Input
                    id="admin-password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Enter master password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    autoComplete="current-password"
                    className="h-10 pr-10 text-sm bg-background border-border transition-all duration-200 focus-visible:ring-accent"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    title={showPassword ? 'Hide password' : 'Show password'}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" aria-hidden="true" /> : <Eye className="h-4 w-4" aria-hidden="true" />}
                  </button>
                </div>
              </div>

              <Button
                type="submit"
                className="w-full h-11 text-sm font-semibold bg-accent text-accent-foreground hover:bg-accent/90 transition-all duration-200 shadow-lg shadow-accent/20 hover:shadow-xl hover:shadow-accent/30"
                disabled={loading}
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                    Verifying Privileges...
                  </span>
                ) : (
                  'Authenticate Master Session'
                )}
              </Button>
            </form>

            {/* Quick Demo Helper (development only) */}
            {import.meta.env.DEV && (
              <div className="pt-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleQuickFill}
                  className="w-full text-xs gap-1.5 border-border text-muted-foreground hover:text-foreground transition-colors"
                >
                  <Server className="h-3.5 w-3.5 text-accent" aria-hidden="true" />
                  <span>Autofill Super Admin Demo Credentials</span>
                </Button>
              </div>
            )}

            {/* Audit Advisory */}
            <motion.div
              className="p-3 rounded-lg bg-muted/40 border border-border text-[11px] text-muted-foreground flex items-start gap-2"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.3, delay: 0.3 }}
            >
              <FileCheck className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-0.5" aria-hidden="true" />
              <span>All authentication transactions and root-level commands are cryptographically signed and stored in immutable audit logs.</span>
            </motion.div>
          </CardContent>

          <CardFooter className="flex items-center justify-center border-t border-border pt-4 text-xs">
            <Link
              to="/login"
              className="text-muted-foreground hover:text-foreground flex items-center gap-1.5 font-medium transition-colors"
            >
              <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Return to Standard Staff Login</span>
            </Link>
          </CardFooter>
        </Card>
      </div>
    </AuthLayout>
  );
});

SuperAdminLogin.displayName = 'SuperAdminLogin';

export default SuperAdminLogin;
