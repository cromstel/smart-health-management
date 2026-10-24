import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardFooter } from '@/components/ui/card';
import { AlertCircle, Loader2, Eye, EyeOff } from 'lucide-react';
import Logo from '@/components/Logo';
import SystemAuthorBadge from '@/components/auth/SystemAuthorBadge';

function SiteSuperAdminLogin() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
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
        navigate('/auth/two-factor');
        return;
      }
      if (res.user && res.user.role !== 'super_admin' && res.user.role !== 'Super Admin') {
        logout();
        setError('Access denied. Site super-admin privileges required.');
        setLoading(false);
        return;
      }
      navigate('/super-admin');
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : 'Invalid Site Super Admin credentials';
      setError(errMsg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen bg-(--navy-deepest) bg-[url('/images/medicare-supersdmin-background.webp')] bg-cover bg-center bg-no-repeat text-(--industrial-text) font-sans selection:bg-red-900/40 selection:text-red-100">
      <div className="relative min-h-screen mx-auto max-w-5xl px-4 sm:px-6 py-10 sm:py-16 lg:py-24 grid lg:grid-cols-2 gap-10 lg:gap-16 items-center content-center">
        <div className="min-w-0 w-full lg:col-start-2">
          <Card className="border-(--navy-dark-border) bg-(--navy-dark-card)/80 shadow-2xl shadow-black/50 text-(--industrial-text) w-full max-w-md mx-auto lg:mx-0">
            <CardHeader className="pb-2 space-y-3 border-b border-(--navy-dark-border)">
              <div className="flex justify-center">
                <Logo variant="light" size="md" textClassName="text-base sm:text-xl lg:text-2xl" />
              </div>
              {/* A real heading, not the card's title element: the page
                  needs a top-level heading for the document outline. */}
              <h1 className="leading-none font-semibold font-display text-xl sm:text-2xl tracking-tight">
                Welcome to Super Admin Portal
              </h1>
              <CardDescription className="text-xs text-(--industrial-muted)">Central hospital management console</CardDescription>
            </CardHeader>
            <CardContent className="pt-6 space-y-5">
              {error && (
                <div className="p-3 rounded-lg bg-red-900/20 border border-red-800/40 text-red-300 text-xs font-medium flex items-start gap-2" role="alert">
                  <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" aria-hidden="true" />
                  <span>{error}</span>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4" noValidate>
                <div className="space-y-2">
                  <Label htmlFor="admin-email" className="text-xs font-mono font-bold uppercase tracking-wider text-(--industrial-muted)">Super Admin Email</Label>
                  <Input
                    id="admin-email"
                    type="email"
                    placeholder="superadmin@smarthealth.com"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    required
                    autoComplete="username"
                    className="h-10 text-sm bg-(--navy-dark-form-field) border-(--navy-dark-border) text-(--industrial-text) focus-visible:ring-red-500/40 focus-visible:border-red-400/60 font-mono"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="admin-password" className="text-xs font-mono font-bold uppercase tracking-wider text-(--industrial-muted)">Master Password</Label>
                  <div className="relative">
                    <Input
                      id="admin-password"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="Enter master password"
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      required
                      autoComplete="current-password"
                      className="h-10 pr-10 text-sm bg-(--navy-dark-form-field) border-(--navy-dark-border) text-(--industrial-text) focus-visible:ring-red-500/40 focus-visible:border-red-400/60 font-mono"
                    />
                    <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-(--industrial-subtle) hover:text-(--industrial-text)" aria-label="Toggle password" title="Toggle visibility">
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <Button type="submit" disabled={loading} className="w-full min-h-11 whitespace-normal text-sm font-mono font-bold uppercase tracking-wide bg-accent text-accent-foreground hover:bg-accent/90 border-0 shadow-lg shadow-accent/30 transition-all">
                  {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  {loading ? 'Verifying...' : 'Authenticate'}
                </Button>
              </form>
            </CardContent>

            <CardFooter className="border-t border-(--navy-dark-border) pt-4 flex flex-col items-center gap-3 text-[11px] text-(--industrial-subtle) font-mono">
              <button
                type="button"
                onClick={() => navigate('/auth/super-admin/forgot-password')}
                className="flex items-center gap-1.5 hover:text-(--industrial-text) transition-colors"
              >
                Forgot password?
              </button>
              <SystemAuthorBadge />
            </CardFooter>
          </Card>
        </div>
      </div>
    </div>
  );
}

SiteSuperAdminLogin.displayName = 'SiteSuperAdminLogin';
export default React.memo(SiteSuperAdminLogin);
