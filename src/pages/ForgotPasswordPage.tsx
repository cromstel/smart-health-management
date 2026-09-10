import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Activity,
  ArrowLeft,
  Mail,
  AlertCircle,
  KeyRound,
  ShieldCheck,
  RotateCw,
  ExternalLink,
} from 'lucide-react';
import { api } from '@/services/api';

export default function ForgotPasswordPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    if (cooldown > 0) {
      timer = setTimeout(() => setCooldown(cooldown - 1), 1000);
    }
    return () => clearTimeout(timer);
  }, [cooldown]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!email.trim()) {
      setError('Please provide your registered work email address.');
      return;
    }

    setLoading(true);
    try {
      await api.forgotPassword(email);
      setSent(true);
      setCooldown(60);
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : 'Unable to dispatch recovery link. Please verify your email.';
      setError(errMsg);
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (cooldown > 0) return;
    setLoading(true);
    try {
      await api.forgotPassword(email);
      setCooldown(60);
    } catch {
      // Handled silently
    } finally {
      setLoading(false);
    }
  };

  if (user?.role === 'Super Admin' || user?.role === 'super_admin') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background text-foreground p-4">
        <Card className="w-full max-w-md border border-border bg-card">
          <CardHeader className="text-center space-y-2">
            <div className="h-12 w-12 rounded-xl bg-destructive/15 text-destructive border border-destructive/30 flex items-center justify-center mx-auto">
              <AlertCircle className="h-6 w-6" aria-hidden="true" />
            </div>
            <CardTitle className="text-xl font-bold text-foreground">Super Admin Restriction</CardTitle>
            <CardDescription className="text-xs text-muted-foreground">
              Super Admin credentials cannot be reset via public self-service recovery. Use the console security prompt or contact root sysadmin.
            </CardDescription>
          </CardHeader>
          <CardFooter className="pt-2">
            <Button onClick={() => navigate('/super-admin/login')} className="w-full bg-accent text-accent-foreground">
              Return to Super Admin Portal
            </Button>
          </CardFooter>
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
            <Activity className="h-6 w-6 text-accent" aria-hidden="true" />
          </div>
          <h1 className="text-xl font-bold text-foreground">Smart Health Manager</h1>
          <p className="text-xs text-muted-foreground">Self-Service Credential Recovery</p>
        </div>

        <Card className="border border-border bg-card shadow-md">
          {sent ? (
            <>
              <CardHeader className="space-y-3 text-center pb-4 border-b border-border">
                <div className="flex justify-center">
                  <div className="h-14 w-14 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-500 flex items-center justify-center shadow-inner">
                    <Mail className="h-7 w-7" aria-hidden="true" />
                  </div>
                </div>
                <div>
                  <CardTitle className="text-xl font-bold text-foreground">Check Your Work Email</CardTitle>
                  <CardDescription className="text-xs text-muted-foreground mt-1">
                    We've dispatched password recovery instructions to:
                  </CardDescription>
                  <Badge variant="secondary" className="mt-2 text-xs font-mono font-normal">
                    {email}
                  </Badge>
                </div>
              </CardHeader>

              <CardContent className="pt-6 space-y-4">
                <div className="p-3 rounded-lg bg-muted/40 border border-border text-xs text-muted-foreground space-y-2">
                  <div className="flex items-center gap-2 text-foreground font-medium">
                    <ShieldCheck className="h-4 w-4 text-accent" aria-hidden="true" />
                    <span>Security Verification Details</span>
                  </div>
                  <p>
                    The reset token remains valid for <strong>15 minutes</strong>. If you do not see the message in your inbox, please verify your spam filter.
                  </p>
                </div>

                <div className="space-y-2 pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full text-xs gap-2 border-border"
                    onClick={handleResend}
                    disabled={cooldown > 0 || loading}
                  >
                    <RotateCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} aria-hidden="true" />
                    {cooldown > 0 ? `Resend available in ${cooldown}s` : 'Resend Recovery Email'}
                  </Button>

                  {/* Direct Demo Link */}
                  <Button
                    type="button"
                    variant="secondary"
                    className="w-full text-xs gap-2 font-medium"
                    onClick={() => navigate('/reset-password?token=demo-token-hospital-2026')}
                  >
                    <ExternalLink className="h-3.5 w-3.5 text-accent" aria-hidden="true" />
                    <span>Test Reset Flow (Use Mock Token)</span>
                  </Button>
                </div>
              </CardContent>

              <CardFooter className="flex items-center justify-between border-t border-border pt-4 text-xs">
                <button
                  type="button"
                  onClick={() => setSent(false)}
                  className="text-muted-foreground hover:text-foreground underline"
                >
                  Use different email
                </button>
                <Link to="/login" className="text-accent hover:underline font-medium flex items-center gap-1">
                  <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" /> Back to Sign In
                </Link>
              </CardFooter>
            </>
          ) : (
            <>
              <CardHeader className="space-y-1 pb-4 border-b border-border">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-xl font-bold text-foreground">Password Recovery</CardTitle>
                  <Badge variant="outline" className="text-xs border-accent/40 text-accent font-medium">
                    256-Bit TLS
                  </Badge>
                </div>
                <CardDescription className="text-xs text-muted-foreground">
                  Enter your verified staff email to receive password reset authorization
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
                    <Label htmlFor="reset-email" className="text-xs font-medium text-foreground flex items-center gap-1.5">
                      <Mail className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
                      Registered Work Email
                    </Label>
                    <Input
                      id="reset-email"
                      type="email"
                      placeholder="doctor@smarthealth.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      className="h-10 text-sm bg-background border-border"
                    />
                  </div>

                  <Button
                    type="submit"
                    className="w-full h-11 text-sm font-semibold bg-accent text-accent-foreground hover:bg-accent/90 transition-colors"
                    disabled={loading}
                  >
                    {loading ? 'Transmitting Token...' : 'Send Recovery Authorization'}
                  </Button>
                </form>

                <div className="p-3 rounded-lg bg-muted/40 border border-border text-[11px] text-muted-foreground flex items-start gap-2">
                  <KeyRound className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-0.5" aria-hidden="true" />
                  <span>
                    To maintain strict HIPAA data governance, reset authorizations are time-locked and recorded in the hospital audit trail.
                  </span>
                </div>
              </CardContent>

              <CardFooter className="flex items-center justify-center border-t border-border pt-4 text-xs">
                <Link to="/login" className="text-muted-foreground hover:text-foreground flex items-center gap-1.5 font-medium transition-colors">
                  <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Return to Sign In</span>
                </Link>
              </CardFooter>
            </>
          )}
        </Card>
      </div>
    </div>
  );
}