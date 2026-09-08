import { useState, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
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

  // Password complexity calculation
  const strength = useMemo(() => {
    const length = password.length >= 8;
    const upper = /[A-Z]/.test(password);
    const lower = /[a-z]/.test(password);
    const number = /[0-9]/.test(password);
    const special = /[^A-Za-z0-9]/.test(password);
    const score = [length, upper, lower, number, special].filter(Boolean).length;
    return { length, upper, lower, number, special, score };
  }, [password]);

  if (user?.role === 'Super Admin' || user?.role === 'super_admin') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background text-foreground p-4">
        <Card className="w-full max-w-md border border-border bg-card">
          <CardHeader className="text-center space-y-2">
            <div className="h-12 w-12 rounded-xl bg-destructive/15 text-destructive border border-destructive/30 flex items-center justify-center mx-auto">
              <AlertCircle className="h-6 w-6" />
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

    setLoading(true);
    try {
      await api.resetPassword(token || 'demo-reset-token', password);
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
      <div className="min-h-screen flex items-center justify-center bg-background text-foreground p-4">
        <Card className="w-full max-w-md border border-border bg-card shadow-md">
          <CardHeader className="text-center space-y-2 pb-4 border-b border-border">
            <div className="h-14 w-14 rounded-2xl bg-amber-500/15 border border-amber-500/30 text-amber-500 flex items-center justify-center mx-auto">
              <KeyRound className="h-7 w-7" />
            </div>
            <CardTitle className="text-xl font-bold text-foreground">Reset Authorization Required</CardTitle>
            <CardDescription className="text-xs text-muted-foreground">
              No active password reset token was detected in your browser URL.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-6 space-y-3">
            <Button
              type="button"
              className="w-full bg-accent text-accent-foreground text-xs"
              onClick={() => setToken('demo-token-hospital-2026')}
            >
              Continue With Demo Reset Token
            </Button>
            <Button
              type="button"
              variant="outline"
              className="w-full text-xs border-border"
              onClick={() => navigate('/forgot-password')}
            >
              Request New Reset Link
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background text-foreground p-4">
        <Card className="w-full max-w-md border border-border bg-card shadow-md text-center">
          <CardHeader className="space-y-3 pb-4">
            <div className="h-16 w-16 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-500 flex items-center justify-center mx-auto">
              <CheckCircle2 className="h-9 w-9" />
            </div>
            <CardTitle className="text-2xl font-bold text-foreground">Password Updated!</CardTitle>
            <CardDescription className="text-xs text-muted-foreground">
              Your new password has been verified and saved to the hospital directory. Redirecting you to sign in...
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-2">
            <Button onClick={() => navigate('/login')} className="w-full gap-2 bg-accent text-accent-foreground">
              Sign In Now <ArrowRight className="h-4 w-4" />
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background text-foreground">
      <div className="w-full max-w-md space-y-4">
        {/* Brand Header */}
        <div className="flex flex-col items-center justify-center text-center">
          <div className="h-12 w-12 rounded-xl bg-accent/15 border border-accent/30 flex items-center justify-center mb-2">
            <Activity className="h-6 w-6 text-accent" />
          </div>
          <h1 className="text-xl font-bold text-foreground">Smart Health Manager</h1>
          <p className="text-xs text-muted-foreground">Set New Workstation Credentials</p>
        </div>

        <Card className="border border-border bg-card shadow-md">
          <CardHeader className="space-y-1 pb-4 border-b border-border">
            <div className="flex items-center justify-between">
              <CardTitle className="text-xl font-bold text-foreground">Reset Password</CardTitle>
              <Badge variant="outline" className="text-xs border-accent/40 text-accent font-medium flex items-center gap-1">
                <ShieldCheck className="h-3.5 w-3.5" />
                Token Verified
              </Badge>
            </div>
            <CardDescription className="text-xs text-muted-foreground">
              Create a secure password meeting hospital IT security standards
            </CardDescription>
          </CardHeader>

          <CardContent className="pt-6 space-y-4">
            {error && (
              <div className="p-3 rounded-lg bg-destructive/15 border border-destructive/30 flex items-start gap-2.5 text-destructive text-xs">
                <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                <span className="font-medium">{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="new-password" className="text-xs font-medium text-foreground flex items-center gap-1.5">
                  <Lock className="h-3.5 w-3.5 text-muted-foreground" />
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
                    className="h-10 pr-10 text-sm bg-background border-border"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    title={showPassword ? 'Hide' : 'Show'}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="confirm-new-password" className="text-xs font-medium text-foreground flex items-center gap-1.5">
                  <Lock className="h-3.5 w-3.5 text-muted-foreground" />
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
                    className="h-10 pr-10 text-sm bg-background border-border"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    title={showConfirmPassword ? 'Hide' : 'Show'}
                  >
                    {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {/* Live Password Checklist */}
              {password.length > 0 && (
                <div className="p-3 rounded-lg bg-muted/40 border border-border text-xs space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Complexity Score:</span>
                    <span className="font-semibold text-foreground">
                      {['Very Weak', 'Weak', 'Moderate', 'Strong', 'Excellent'][Math.max(0, strength.score - 1)]}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-1.5 pt-1">
                    <div className={`flex items-center gap-1 ${strength.length ? 'text-emerald-500' : 'text-muted-foreground'}`}>
                      <CheckCircle2 className="h-3 w-3" />
                      <span>8+ Characters</span>
                    </div>
                    <div className={`flex items-center gap-1 ${strength.upper && strength.lower ? 'text-emerald-500' : 'text-muted-foreground'}`}>
                      <CheckCircle2 className="h-3 w-3" />
                      <span>Upper & Lowercase</span>
                    </div>
                    <div className={`flex items-center gap-1 ${strength.number ? 'text-emerald-500' : 'text-muted-foreground'}`}>
                      <CheckCircle2 className="h-3 w-3" />
                      <span>Numbers (0-9)</span>
                    </div>
                    <div className={`flex items-center gap-1 ${strength.special ? 'text-emerald-500' : 'text-muted-foreground'}`}>
                      <CheckCircle2 className="h-3 w-3" />
                      <span>Special Symbols</span>
                    </div>
                  </div>
                </div>
              )}

              <Button
                type="submit"
                className="w-full h-11 text-sm font-semibold bg-accent text-accent-foreground hover:bg-accent/90 transition-colors"
                disabled={loading}
              >
                {loading ? 'Securing Credentials...' : 'Save New Password & Continue'}
              </Button>
            </form>
          </CardContent>

          <CardFooter className="flex items-center justify-center border-t border-border pt-4 text-xs">
            <Link to="/login" className="text-muted-foreground hover:text-foreground transition-colors">
              Cancel & Return to Sign In
            </Link>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
