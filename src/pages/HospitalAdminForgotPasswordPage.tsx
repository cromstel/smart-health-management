import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader } from '@/components/ui/card';
import { AlertCircle, ArrowLeft, Loader2, Mail, Send } from 'lucide-react';
import Logo from '@/components/Logo';
import SystemAuthorBadge from '@/components/auth/SystemAuthorBadge';
import { api } from '@/services/api';
import { HOSPITAL_ADMIN_AUTH_ROUTES } from '@/lib/authRoutes';

/**
 * Hospital administrator password recovery.
 *
 * The tenant administrator recovers on their own URL, in their own portal's
 * styling. The clinical workforce recovers at
 * `/auth/forgot-password`, and the platform site owner at
 * `/auth/super-admin/forgot-password`; none of the three shares a page.
 *
 * The request itself is the same endpoint the other surfaces use, and it
 * answers the same way whether or not the address is registered, so this
 * page cannot be used to find out which addresses exist.
 */
function HospitalAdminForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!email.trim()) {
      setError('Enter the administrator email address.');
      return;
    }

    setLoading(true);
    try {
      await api.forgotPassword(email.trim());
      setSent(true);
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : 'Unable to dispatch the recovery link.';
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
              <h1 className="font-display text-xl sm:text-2xl tracking-tight text-center">Administrator Recovery</h1>
              <CardDescription className="text-xs text-(--industrial-muted) text-center">
                Hospital administrator account access
              </CardDescription>
            </CardHeader>

            <CardContent className="pt-6 space-y-5">
              {error && (
                <div className="p-3 rounded-lg bg-red-900/20 border border-red-800/40 text-red-300 text-xs font-medium flex items-start gap-2" role="alert">
                  <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" aria-hidden="true" />
                  <span>{error}</span>
                </div>
              )}

              {sent ? (
                <div className="space-y-4 text-center">
                  <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-(--navy-dark-border) bg-(--navy-dark-form-field) text-(--sea-blue)">
                    <Mail className="h-7 w-7" aria-hidden="true" />
                  </div>
                  <div className="space-y-2">
                    <p className="font-display text-lg tracking-tight">Check the administrator mailbox</p>
                    <p className="text-xs leading-relaxed text-(--industrial-muted)">
                      If the address is registered, a single-use recovery link is on its way. It expires shortly, and it can only be used once.
                    </p>
                    <p className="font-mono text-xs text-(--industrial-text)">{email}</p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => { setSent(false); setError(''); }}
                    className="w-full min-h-11 text-sm font-mono font-bold uppercase tracking-wide border-(--navy-dark-border) text-(--industrial-text) hover:bg-(--navy-dark-form-field)"
                  >
                    Use a different address
                  </Button>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-4" noValidate>
                  <div className="space-y-2">
                    <Label htmlFor="hospital-admin-recovery-email" className="text-xs font-mono font-bold uppercase tracking-wider text-(--industrial-muted)">
                      Administrator Email
                    </Label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Mail className="h-4 w-4 text-(--industrial-subtle)" aria-hidden="true" />
                      </div>
                      <Input
                        id="hospital-admin-recovery-email"
                        type="email"
                        placeholder="name@smarthealth.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        autoFocus
                        autoComplete="username"
                        className="h-10 pl-10 text-sm bg-(--navy-dark-form-field) border-(--navy-dark-border) text-(--industrial-text) focus-visible:ring-red-500/40 focus-visible:border-red-400/60 font-mono"
                      />
                    </div>
                  </div>

                  <Button
                    type="submit"
                    disabled={loading}
                    className="w-full min-h-11 whitespace-normal text-sm font-mono font-bold uppercase tracking-wide bg-accent text-accent-foreground hover:bg-accent/90 border-0 shadow-lg shadow-accent/30 transition-all"
                  >
                    {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Send className="h-4 w-4 mr-2" />}
                    {loading ? 'Dispatching...' : 'Dispatch Recovery Link'}
                  </Button>
                </form>
              )}
            </CardContent>

            <CardFooter className="border-t border-(--navy-dark-border) pt-4 flex flex-col items-center gap-3 text-[11px] text-(--industrial-subtle) font-mono">
              <button
                type="button"
                onClick={() => navigate(HOSPITAL_ADMIN_AUTH_ROUTES.login)}
                className="flex items-center gap-1.5 hover:text-(--industrial-text) transition-colors"
              >
                <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
                Back to the administrator portal
              </button>
              <SystemAuthorBadge />
            </CardFooter>
          </Card>
        </div>
      </div>
    </div>
  );
}

HospitalAdminForgotPasswordPage.displayName = 'HospitalAdminForgotPasswordPage';
export default React.memo(HospitalAdminForgotPasswordPage);
