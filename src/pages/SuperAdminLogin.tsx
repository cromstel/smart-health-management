import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
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
} from 'lucide-react';

const SuperAdminLogin = React.memo(() => {
  const [email, setEmail] = useState('superadmin@smarthealth.com');
  const [password, setPassword] = useState('password123');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { login, user } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await login(email, password);
      if (user && user.role !== 'super_admin' && user.role !== 'Super Admin') {
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
    setEmail('superadmin@smarthealth.com');
    setPassword('password123');
    setError('');
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background text-foreground p-4 sm:p-6">
      <div className="w-full max-w-md space-y-4">
        {/* Brand Header */}
        <div className="flex flex-col items-center justify-center text-center">
          <div className="h-12 w-12 rounded-xl bg-accent/15 border border-accent/30 flex items-center justify-center mb-2">
            <Activity className="h-6 w-6 text-accent" aria-hidden="true" />
          </div>
          <h1 className="text-xl font-bold text-foreground">Smart Health Manager</h1>
          <p className="text-xs text-muted-foreground">Super Administrator Infrastructure Portal</p>
        </div>

        {/* Security Warning Banner */}
        <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/25 text-amber-500 flex items-center gap-2.5 text-xs" role="alert">
          <Shield className="h-4 w-4 flex-shrink-0" aria-hidden="true" />
          <span className="font-medium">Restricted Terminal: Privileged Infrastructure & Multi-Tenant Root</span>
        </div>

        <Card className="border border-border bg-card shadow-lg">
          <CardHeader className="space-y-3 text-center pb-4 border-b border-border">
            <div className="flex justify-center">
              <div className="h-16 w-16 rounded-2xl bg-accent/15 border border-accent/30 flex items-center justify-center shadow-inner">
                <KeyRound className="h-8 w-8 text-accent" aria-hidden="true" />
              </div>
            </div>
            <div>
              <div className="flex items-center justify-center gap-2">
                <CardTitle className="text-2xl font-bold tracking-tight text-foreground">Super Admin Portal</CardTitle>
                <Badge variant="outline" className="text-[10px] border-accent/40 text-accent font-semibold">
                  ROOT
                </Badge>
              </div>
              <CardDescription className="text-xs text-muted-foreground mt-1">
                Multi-hospital governance, master audit logs & database provisioning
              </CardDescription>
            </div>
          </CardHeader>

          <CardContent className="pt-6 space-y-4">
            {error && (
              <div className="p-3 rounded-md bg-destructive/15 border border-destructive/30 flex items-start gap-2.5 text-destructive text-xs" role="alert" aria-live="assertive">
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" aria-hidden="true" />
                <span className="font-medium">{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
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
                  className="h-10 text-sm bg-background border-border"
                />
              </div>

              <div className="space-y-1.5">
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
                    className="h-10 pr-10 text-sm bg-background border-border"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    title={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" aria-hidden="true" /> : <Eye className="h-4 w-4" aria-hidden="true" />}
                  </button>
                </div>
              </div>

              <Button
                type="submit"
                className="w-full h-11 text-sm font-semibold bg-accent text-accent-foreground hover:bg-accent/90 transition-colors"
                disabled={loading}
              >
                {loading ? 'Verifying Privileges...' : 'Authenticate Master Session'}
              </Button>
            </form>

            {/* Quick Demo Helper */}
            <div className="pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleQuickFill}
                className="w-full text-xs gap-1.5 border-border text-muted-foreground hover:text-foreground"
              >
                <Server className="h-3.5 w-3.5 text-accent" aria-hidden="true" />
                <span>Autofill Super Admin Demo Credentials</span>
              </Button>
            </div>

            {/* Audit Advisory */}
            <div className="p-3 rounded-lg bg-muted/40 border border-border text-[11px] text-muted-foreground flex items-start gap-2">
              <FileCheck className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-0.5" aria-hidden="true" />
              <span>All authentication transactions and root-level commands are cryptographically signed and stored in immutable audit logs.</span>
            </div>
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
    </div>
  );
});

export default SuperAdminLogin;