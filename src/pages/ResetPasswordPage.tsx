import { useState, useMemo, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { motion } from 'motion/react';
import {
  Activity,
  CheckCircle2,
  AlertCircle,
  Lock,
  Eye,
  EyeOff,
  ArrowRight,
  ShieldCheck,
  KeyRound,
} from 'lucide-react';
import { AuthLayout, PasswordStrength, computePasswordStrength } from '@/components/auth';
import { api } from '@/services/api';

export default function ResetPasswordPage() {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  const rawToken = searchParams.get('token');
  const [token, setToken] = useState(rawToken || '');

  // Keep the token in sync if the URL changes while the page is mounted
  useEffect(() => {
    if (rawToken) {
      setToken(rawToken);
    }
  }, [rawToken]);

  const strength = useMemo(() => computePasswordStrength(password), [password]);

  const pageHeader = (
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
      <h2 className="text-2xl font-bold tracking-tight text-foreground mb-1">Set New Password</h2>
      <p className="text-sm text-muted-foreground">Create new workstation credentials</p>
    </motion.div>
  );

  if (user?.role === 'Super Admin' || user?.role === 'super_admin') {
    return (
      <AuthLayout>
        <div className="space-y-8">
          {pageHeader}
          <Card className="w-full border border-border bg-card">
            <CardHeader className="text-center space-y-2">
              <div className="h-12 w-12 rounded-xl bg-destructive/15 text-destructive border border-destructive/30 flex items-center justify-center mx-auto">
                <AlertCircle className="h-6 w-6" aria-hidden="true" />
              </div>
              <CardTitle className="text-xl font-bold text-foreground">Super Admin Restriction</CardTitle>
              <CardDescription className="text-xs text-muted-foreground">
                Super Admins cannot reset passwords via token. Please use the privileged console security settings.
              </CardDescription>
            </CardHeader>
            <CardFooter className="pt-2">
              <Button onClick={() => navigate('/super-admin/dashboard')} className="w-full bg-accent text-accent-foreground">
                Go to Super Admin Console
              </Button>
            </CardFooter>
          </Card>
        </div>
      </AuthLayout>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!password || !confirmPassword) {
      setError('Please provide and confirm your new password.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Password entries do not match.');
      return;
    }

    if (strength.score < 3) {
      setError('Please satisfy at least 3 password complexity standards.');
      return;
    }

    const effectiveToken = token || (import.meta.env.DEV ? 'demo-reset-token' : '');
    if (!effectiveToken) {
      setError('No active reset authorization was found. Please request a new reset link.');
      return;
    }

    setLoading(true);
    try {
      await api.resetPassword(effectiveToken, password);
      setSuccess(true);
      setTimeout(() => {
        navigate('/login');
      }, 2500);
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : 'Password reset failed. The token may be expired.';
      setError(errMsg);
    } finally {
      setLoading(false);
    }
  };

  if (!token && !rawToken) {
    return (
      <AuthLayout>
        <div className="space-y-8">
          {pageHeader}
          <Card className="w-full border border-border bg-card shadow-md">
            <CardHeader className="text-center space-y-2 pb-4 border-b border-border">
              <div className="h-14 w-14 rounded-2xl bg-amber-500/15 border border-amber-500/30 text-amber-500 flex items-center justify-center mx-auto">
                <KeyRound className="h-7 w-7" aria-hidden="true" />
              </div>
              <CardTitle className="text-xl font-bold text-foreground">Reset Authorization Required</CardTitle>
              <CardDescription className="text-xs text-muted-foreground">
                No active password reset token was detected in your browser URL.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-6 space-y-3">
              {import.meta.env.DEV && (
                <Button
                  type="button"
                  className="w-full bg-accent text-accent-foreground text-xs"
                  onClick={() => setToken('demo-token-hospital-2026')}
                >
                  Continue With Demo Reset Token
                </Button>
              )}
              <Button
                type="button"
                variant="outline"
                className="w-full text-xs border-border focus-visible:ring-accent"
                onClick={() => navigate('/forgot-password')}
              >
                Request New Reset Link
              </Button>
            </CardContent>
          </Card>
        </div>
      </AuthLayout>
    );
  }

  if (success) {
    return (
      <AuthLayout>
        <div className="space-y-8">
          {pageHeader}
          <Card className="w-full border border-border bg-card shadow-md text-center">
            <CardHeader className="space-y-3 pb-4">
              <div className="h-16 w-16 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-500 flex items-center justify-center mx-auto">
                <CheckCircle2 className="h-9 w-9" aria-hidden="true" />
              </div>
              <CardTitle className="text-2xl font-bold text-foreground">Password Updated!</CardTitle>
              <CardDescription className="text-xs text-muted-foreground">
                Your new password has been verified and saved to the hospital directory. Redirecting you to sign in...
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-2">
              <Button onClick={() => navigate('/login')} className="w-full gap-2 bg-accent text-accent-foreground">
                Sign In Now <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Button>
            </CardContent>
          </Card>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout>
      <div className="space-y-8">
        {pageHeader}

        <Card className="w-full border border-border bg-card shadow-md">
          <CardHeader className="space-y-1 pb-4 border-b border-border">
            <div className="flex items-center justify-between">
              <CardTitle className="text-xl font-bold text-foreground">Reset Password</CardTitle>
              <Badge variant="outline" className="text-xs border-accent/40 text-accent font-medium flex items-center gap-1">
                <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
                Secure Token
              </Badge>
            </div>
            <CardDescription className="text-xs text-muted-foreground">
              Create a secure password meeting hospital IT security standards
            </CardDescription>
          </CardHeader>

          <CardContent className="pt-6 space-y-4">
            {error && (
              <div className="p-3 rounded-lg bg-destructive/15 border border-destructive/30 flex items-start gap-2.5 text-destructive text-xs" role="alert" aria-live="assertive">
                <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" aria-hidden="true" />
                <span className="font-medium">{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="new-password" className="text-xs font-medium text-foreground flex items-center gap-1.5">
                  <Lock className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
                  New Password
                </Label>
                <div className="relative">
                  <Input
                    id="new-password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    autoFocus
                    autoComplete="new-password"
                    className="h-10 pr-10 text-sm bg-background border-border focus-visible:ring-accent"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    title={showPassword ? 'Hide' : 'Show'}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" aria-hidden="true" /> : <Eye className="h-4 w-4" aria-hidden="true" />}
                  </button>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="confirm-new-password" className="text-xs font-medium text-foreground flex items-center gap-1.5">
                  <Lock className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
                  Confirm New Password
                </Label>
                <div className="relative">
                  <Input
                    id="confirm-new-password"
                    type={showConfirmPassword ? 'text' : 'password'}
                    placeholder="••••••••"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    autoComplete="new-password"
                    className="h-10 pr-10 text-sm bg-background border-border focus-visible:ring-accent"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    title={showConfirmPassword ? 'Hide' : 'Show'}
                    aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                  >
                    {showConfirmPassword ? <EyeOff className="h-4 w-4" aria-hidden="true" /> : <Eye className="h-4 w-4" aria-hidden="true" />}
                  </button>
                </div>
              </div>

              {/* Live Password Checklist */}
              <PasswordStrength password={password} />

              <Button
                type="submit"
                className="w-full h-11 text-sm font-semibold bg-accent text-accent-foreground hover:bg-accent/90 transition-colors shadow-lg shadow-accent/20 hover:shadow-xl hover:shadow-accent/30"
                disabled={loading}
              >
                {loading ? 'Securing Credentials...' : 'Save New Password & Continue'}
              </Button>
            </form>
          </CardContent>

          <CardFooter className="flex items-center justify-center border-t border-border pt-4 text-xs">
            <Link to="/login" className="text-accent hover:text-accent/80 transition-colors">
              Cancel & Return to Sign In
            </Link>
          </CardFooter>
        </Card>
      </div>
    </AuthLayout>
  );
}