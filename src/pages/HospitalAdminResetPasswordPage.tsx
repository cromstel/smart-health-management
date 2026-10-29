import React, { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader } from '@/components/ui/card';
import { AlertCircle, ArrowLeft, CheckCircle2, Eye, EyeOff, Loader2, Lock } from 'lucide-react';
import Logo from '@/components/Logo';
import SystemAuthorBadge from '@/components/auth/SystemAuthorBadge';
import { api } from '@/services/api';
import { HOSPITAL_ADMIN_AUTH_ROUTES } from '@/lib/authRoutes';

/**
 * Hospital administrator password reset.
 *
 * Reached from the recovery link sent to a tenant administrator, on their
 * own URL and in their own portal's styling. The clinical workforce resets at
 * `/auth/reset-password` and the platform site owner at
 * `/auth/super-admin/reset-password`; none of the three shares a page.
 *
 * The token is the same single-use, expiring token every surface issues.
 */
function HospitalAdminResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const token = searchParams.get('token') ?? '';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!token) {
      setError('This recovery link is missing its token. Request a new one.');
      return;
    }
    if (password !== confirmPassword) {
      setError('The two passwords do not match.');
      return;
    }
    if (password.length < 8) {
      setError('Choose a password of at least 8 characters.');
      return;
    }

    setLoading(true);
    try {
      await api.resetPassword(token, password);
      setSuccess(true);
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : 'The recovery link could not be used.';
      setError(errMsg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen bg-(--navy-deepest) bg-[url('/images/medicare-admin-login-hero-banner.webp')] bg-cover bg-center bg-no-repeat text-(--industrial-text) font-sans selection:bg-red-900/40 selection:text-red-100">
      <div className="relative min-h-screen mx-auto max-w-5xl px-4 sm:px-6 py-10 sm:py-16 lg:py-24 grid lg:grid-cols-2 gap-10 lg:gap-16 items-center content-center">
        <div className="min-w-0 w-full lg:col-start-2">
          <Card className="border-(--navy-dark-border) bg-(--navy-dark-card)/80 shadow-2xl shadow-black/50 text-(--industrial-text) w-full max-w-md mx-auto lg:mx-0">
            <CardHeader className="pb-2 space-y-3 border-b border-(--navy-dark-border)">
              <div className="flex justify-center">
                <Logo variant="light" size="md" textClassName="text-base sm:text-xl lg:text-2xl" />
              </div>
              <h1 className="font-display text-xl sm:text-2xl tracking-tight text-center">
                {success ? 'Administrator password updated' : 'Set a new administrator password'}
              </h1>
              <CardDescription className="text-xs text-(--industrial-muted) text-center">
                {success
                  ? 'Sign in to the administrator portal with your new password.'
                  : 'Hospital administrator account credentials'}
              </CardDescription>
            </CardHeader>

            <CardContent className="pt-6 space-y-5">
              {error && (
                <div className="p-3 rounded-lg bg-red-900/20 border border-red-800/40 text-red-300 text-xs font-medium flex items-start gap-2" role="alert">
                  <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" aria-hidden="true" />
                  <span>{error}</span>
                </div>
              )}

              {success ? (
                <div className="space-y-4 text-center">
                  <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-green-800/40 bg-green-900/20 text-green-300">
                    <CheckCircle2 className="h-7 w-7" aria-hidden="true" />
                  </div>
                  <p className="text-xs leading-relaxed text-(--industrial-muted)">
                    The recovery link has been used and can no longer be reused. Sign in with the password you have just set.
                  </p>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-4" noValidate>
                  <div className="space-y-2">
                    <Label htmlFor="hospital-admin-new-password" className="text-xs font-mono font-bold uppercase tracking-wider text-(--industrial-muted)">
                      New Password
                    </Label>
                    <div className="relative">
                      <Input
                        id="hospital-admin-new-password"
                        type={showPassword ? 'text' : 'password'}
                        placeholder="••••••••"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        autoFocus
                        autoComplete="new-password"
                        className="h-10 pr-10 text-sm bg-(--navy-dark-form-field) border-(--navy-dark-border) text-(--industrial-text) focus-visible:ring-red-500/40 focus-visible:border-red-400/60 font-mono"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-(--industrial-subtle) hover:text-(--industrial-text)"
                        aria-label={showPassword ? 'Hide password' : 'Show password'}
                        title={showPassword ? 'Hide' : 'Show'}
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="hospital-admin-confirm-password" className="text-xs font-mono font-bold uppercase tracking-wider text-(--industrial-muted)">
                      Confirm New Password
                    </Label>
                    <div className="relative">
                      <Input
                        id="hospital-admin-confirm-password"
                        type={showConfirmPassword ? 'text' : 'password'}
                        placeholder="••••••••"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        required
                        autoComplete="new-password"
                        className="h-10 pr-10 text-sm bg-(--navy-dark-form-field) border-(--navy-dark-border) text-(--industrial-text) focus-visible:ring-red-500/40 focus-visible:border-red-400/60 font-mono"
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-(--industrial-subtle) hover:text-(--industrial-text)"
                        aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                        title={showConfirmPassword ? 'Hide' : 'Show'}
                      >
                        {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>

                  <Button
                    type="submit"
                    disabled={loading}
                    className="w-full min-h-11 whitespace-normal text-sm font-mono font-bold uppercase tracking-wide bg-accent text-accent-foreground hover:bg-accent/90 border-0 shadow-lg shadow-accent/30 transition-all"
                  >
                    {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Lock className="h-4 w-4 mr-2" />}
                    {loading ? 'Updating...' : 'Update Password'}
                  </Button>
                </form>
              )}
            </CardContent>

            <CardFooter className="border-t border-(--navy-dark-border) pt-4 flex flex-col items-center gap-3 text-[11px] text-(--industrial-subtle) font-mono">
              <button
                type="button"
                onClick={() => navigate(success ? HOSPITAL_ADMIN_AUTH_ROUTES.login : HOSPITAL_ADMIN_AUTH_ROUTES.forgotPassword)}
                className="flex items-center gap-1.5 hover:text-(--industrial-text) transition-colors"
              >
                <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
                {success ? 'Back to the administrator portal' : 'Request a new recovery link'}
              </button>
              <SystemAuthorBadge />
            </CardFooter>
          </Card>
        </div>
      </div>
    </div>
  );
}

HospitalAdminResetPasswordPage.displayName = 'HospitalAdminResetPasswordPage';
export default React.memo(HospitalAdminResetPasswordPage);
