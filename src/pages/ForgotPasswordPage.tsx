import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { motion, useReducedMotion } from 'motion/react';
import {
  ArrowLeft,
  Mail,
  AlertCircle,
  ShieldCheck,
  RotateCw,
  Send,
  Loader2,
} from 'lucide-react';
import { AuthLayout } from '@/components/auth';
import Logo from '@/components/Logo';
import { api } from '@/services/api';

export default function ForgotPasswordPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const reduceMotion = useReducedMotion();
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
    setError('');
    try {
      await api.forgotPassword(email);
      setCooldown(60);
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : 'Unable to resend the recovery link.';
      setError(errMsg);
    } finally {
      setLoading(false);
    }
  };

  // The header mirrors the sign-in page exactly: the same logo lockup, the
  // same display heading, and the same supporting line.
  const pageHeader = (
    <motion.div
      initial={reduceMotion ? false : { opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <div className="mb-8 flex items-center">
        <Logo size="md" />
      </div>
      <h1 className="mb-2 font-display text-3xl font-medium leading-tight tracking-tight text-foreground sm:text-[2rem]">
        Password Recovery
      </h1>
      <p className="max-w-sm text-sm leading-6 text-muted-foreground">
        Provide your registered work email address to receive password reset instructions
      </p>
    </motion.div>
  );

  if (user?.role === 'Super Admin' || user?.role === 'super_admin') {
    return (
      <AuthLayout
        showBranding={false}
        formPanelClassName="bg-transparent"
        contentClassName="w-full max-w-md mx-auto my-auto"
      >
        <Card className="w-full border border-border bg-card p-6 shadow-xl shadow-primary/5 sm:p-8">
          <div className="space-y-7">
            {pageHeader}
            <div className="space-y-6 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-destructive/30 bg-destructive/15 text-destructive">
                <AlertCircle className="h-7 w-7" aria-hidden="true" />
              </div>
              <div className="space-y-2">
                <h2 className="font-display text-xl font-medium tracking-tight text-foreground">
                  Administrator Accounts Recover Separately
                </h2>
                <p className="mx-auto max-w-sm text-sm leading-6 text-muted-foreground">
                  This is the recovery flow for patients and hospital staff. The tenant administrator has its own recovery page, so the two never share a URL.
                </p>
              </div>
              <div className="space-y-3">
                <Button
                  onClick={() => navigate('/auth/super-admin/forgot-password')}
                  className="w-full h-11 text-base font-semibold bg-accent text-accent-foreground hover:bg-accent/90 flex items-center justify-center gap-2 transition-all duration-200 shadow-lg shadow-accent/20 hover:shadow-xl hover:shadow-accent/30"
                >
                  Go to Administrator Recovery
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => navigate('/auth/super-admin/login')}
                  className="w-full text-xs text-muted-foreground hover:text-foreground flex items-center justify-center gap-1.5 transition-colors"
                >
                  <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
                  Back to the Administrator Portal
                </Button>
              </div>
            </div>
          </div>
        </Card>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      showBranding={false}
      formPanelClassName="bg-transparent"
      contentClassName="w-full max-w-md mx-auto my-auto"
    >
      <Card className="w-full border border-border bg-card p-6 shadow-xl shadow-primary/5 sm:p-8">
        <div className="space-y-7">
          {pageHeader}

          {error && (
            <div
              className="p-4 rounded-xl bg-destructive/10 border border-destructive/20 flex items-start gap-3 text-destructive text-sm"
              role="alert"
              aria-live="assertive"
            >
              <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" aria-hidden="true" />
              <span className="font-medium">{error}</span>
            </div>
          )}

          {sent ? (
            <div className="space-y-6 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-success/30 bg-success/15 text-success">
                <Mail className="h-7 w-7" aria-hidden="true" />
              </div>
              <div className="space-y-2">
                <h2 className="font-display text-xl font-medium tracking-tight text-foreground">
                  Check Your Work Email
                </h2>
                <p className="mx-auto max-w-sm text-sm leading-6 text-muted-foreground">
                  We have dispatched password recovery instructions to
                </p>
                <p className="font-mono text-sm text-foreground">{email}</p>
              </div>

              <div className="rounded-xl border border-border bg-muted/40 p-4 text-left">
                <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                  <ShieldCheck className="h-4 w-4 text-accent" aria-hidden="true" />
                  <span>Security Verification Details</span>
                </div>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  The reset link is single-use and time-limited. If you do not see the message in your inbox, please check your spam filter.
                </p>
              </div>

              <div className="space-y-3">
                <Button
                  type="button"
                  variant="outline"
                  className="w-full h-11 text-sm font-semibold border-border focus-visible:ring-accent flex items-center justify-center gap-2 transition-all duration-200"
                  onClick={handleResend}
                  disabled={cooldown > 0 || loading}
                >
                  <RotateCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} aria-hidden="true" />
                  {cooldown > 0 ? `Resend available in ${cooldown}s` : 'Resend Recovery Email'}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  className="w-full text-xs text-muted-foreground hover:text-foreground flex items-center justify-center gap-1.5 transition-colors"
                  onClick={() => {
                    setSent(false);
                    setCooldown(0);
                    setError('');
                  }}
                >
                  Use a different email
                </Button>
              </div>
            </div>
          ) : (
            <motion.form
              key="forgot"
              initial={reduceMotion ? false : { opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={reduceMotion ? undefined : { opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
              onSubmit={handleSubmit}
              className="space-y-5"
              noValidate
              id="forgot-password-form"
            >
              <div className="space-y-2">
                <Label htmlFor="reset-email" className="sr-only">
                  Work Email Address
                </Label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Mail className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                  </div>
                  <Input
                    id="reset-email"
                    type="email"
                    placeholder="name@smarthealth.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoFocus
                    autoComplete="email"
                    className="pl-10 h-11 bg-muted/40 border-border focus-visible:ring-accent transition-all duration-200"
                  />
                </div>
              </div>

              <div className="space-y-3 pt-2">
                <Button
                  type="submit"
                  id="forgot-submit-btn"
                  className="w-full h-11 text-base font-semibold bg-accent text-accent-foreground hover:bg-accent/90 flex items-center justify-center transition-all duration-200 shadow-lg shadow-accent/20 hover:shadow-xl hover:shadow-accent/30"
                  disabled={loading}
                >
                  {loading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-2" aria-hidden="true" />
                      Sending Reset Link...
                    </>
                  ) : (
                    <span className="flex items-center gap-2">
                      Send Password Reset Link
                      <Send className="h-4 w-4" aria-hidden="true" />
                    </span>
                  )}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => navigate('/auth/login')}
                  className="w-full text-xs text-muted-foreground hover:text-foreground flex items-center justify-center gap-1.5 transition-colors"
                >
                  <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
                  Back to Workstation Sign In
                </Button>
              </div>

              <div className="rounded-xl border border-border bg-muted/40 p-4 text-sm leading-6 text-muted-foreground flex items-start gap-3">
                <ShieldCheck className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-0.5" aria-hidden="true" />
                <span>
                  Reset authorisations are time-locked, single-use, and recorded in the hospital audit trail.
                </span>
              </div>
            </motion.form>
          )}
        </div>
      </Card>
    </AuthLayout>
  );
}
