import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '@/contexts/AuthContext';
import { AuthLayout } from '@/components/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Shield, AlertCircle, Lock, Mail, Eye, EyeOff, ArrowLeft, KeyRound, Loader2 } from 'lucide-react';

const DEMO_EMAIL = 'admin@smarthealth.com';
const DEMO_PASSWORD = 'Pass@135709';

const SiteSuperAdminLogin = React.memo(() => {
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
        navigate('/auth/two-factor');
        return;
      }
      if (res.user && res.user.role !== 'super_admin' && res.user.role !== 'Super Admin') {
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
    <div className="min-h-screen bg-[#0A0E14] text-[#EAEAEA] font-sans selection:bg-red-900/40 selection:text-red-100">
      {/* Industrial / steel header strip */}
      <div className="border-b border-[#23262F] bg-[#0D1117]">
        <div className="mx-auto max-w-5xl px-6 py-3 flex items-center gap-3">
          <Shield className="h-5 w-5 text-red-400" aria-hidden="true" />
          <span className="font-mono text-[11px] font-bold tracking-[0.2em] uppercase text-[#8892b0]">Site Owner Portal</span>
          <span className="ml-auto font-mono text-[10px] text-[#5B6B84]">ROOT ACCESS • RESTRICTED TERMINAL</span>
        </div>
      </div>

      <div className="mx-auto max-w-5xl px-6 py-16 lg:py-24 grid lg:grid-cols-2 gap-16 items-start">
        {/* Left — identity / control */}
        <div className="space-y-10">
          <div>
            <h1 className="font-display text-5xl sm:text-6xl font-bold tracking-tight leading-[1.05] text-[#EAEAEA]">
              Root <span className="italic text-red-400">Access</span>.
            </h1>
            <p className="mt-6 text-base text-[#8892b0] leading-relaxed max-w-md">
              Multi-hospital governance, master database provisioning, and system-level command. This terminal is restricted to the site owner and developer.
            </p>
          </div>

          <div className="border border-[#23262F] bg-[#0D1117]/60 rounded-xl p-6 space-y-3">
            <h3 className="font-mono text-xs font-bold tracking-widest uppercase text-[#8892b0]">Access Protocol</h3>
            <ul className="font-mono text-xs space-y-2 text-[#EAEAEA]/80">
              <li>• Multi-factor enforced (TOTP required)</li>
              <li>• Session audit logged immutably</li>
              <li>• Hospital-scoped admins redirected automatically</li>
              <li>• All commands cryptographically signed</li>
            </ul>
          </div>
        </div>

        {/* Right — form panel (industrial raw, not clinical card) */}
        <Card className="border-[#23262F] bg-[#0D1117] shadow-2xl shadow-black/50 text-[#EAEAEA] w-full max-w-md mx-auto lg:mx-0 lg:ml-auto">
          <CardHeader className="pb-2 space-y-1 border-b border-[#23262F]">
            <div className="flex items-center gap-2">
              <KeyRound className="h-5 w-5 text-red-400" aria-hidden="true" />
              <CardTitle className="font-display text-xl tracking-tight">Authenticate Master Session</CardTitle>
            </div>
            <CardDescription className="text-xs text-[#5B6B84]">Site super-admin credentials. Not for hospital staff.</CardDescription>
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
                <Label htmlFor="admin-email" className="text-xs font-mono font-bold uppercase tracking-wider text-[#8892b0]">Super Admin Email</Label>
                <Input
                  id="admin-email"
                  type="email"
                  placeholder="superadmin@smarthealth.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                  autoComplete="username"
                  className="h-10 text-sm bg-[#161B22] border-[#23262F] text-[#EAEAEA] focus-visible:ring-red-500/40 focus-visible:border-red-400/60 font-mono"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="admin-password" className="text-xs font-mono font-bold uppercase tracking-wider text-[#8892b0]">Master Password</Label>
                <div className="relative">
                  <Input
                    id="admin-password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Enter master password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    required
                    autoComplete="current-password"
                    className="h-10 pr-10 text-sm bg-[#161B22] border-[#23262F] text-[#EAEAEA] focus-visible:ring-red-500/40 font-mono"
                  />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#5B6B84] hover:text-[#EAEAEA]" aria-label="Toggle password" title="Toggle visibility">
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <Button type="submit" disabled={loading} className="w-full h-11 text-sm font-mono font-bold tracking-wide bg-red-600 hover:bg-red-700 text-white border-0 shadow-lg shadow-red-900/30 transition-all">
                {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                {loading ? 'Verifying...\nGranting access' : 'Authenticate Master Session'}
              </Button>
            </form>
          </CardContent>

          <CardFooter className="border-t border-[#23262F] pt-4 flex flex-col items-center gap-3 text-[11px] text-[#5B6B84] font-mono">
            <div className="flex items-center gap-4">
              <Link to="/auth/admin/login" className="hover:text-[#EAEAEA] transition-colors">Hospital Admin Portal</Link>
              <span>·</span>
              <Link to="/" className="hover:text-[#EAEAEA] transition-colors">Public Site</Link>
            </div>
            <p>Restricted to site owner and developer. Hospital administrators redirect automatically.</p>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
});

SiteSuperAdminLogin.displayName = 'SiteSuperAdminLogin';

export default SiteSuperAdminLogin;
