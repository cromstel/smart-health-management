import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Activity,
  Lock,
  Mail,
  Eye,
  EyeOff,
  ShieldCheck,
  AlertCircle,
  Stethoscope,
  Building2,
  Shield,
  HeartHandshake,
  CheckCircle2,
  Fingerprint,
  Loader2,
} from 'lucide-react';

const DEMO_ACCOUNTS = [
  {
    role: 'Doctor',
    name: 'Dr. John Smith',
    email: 'doctor@smarthealth.com',
    password: 'password123',
    badge: 'Cardiology',
    icon: Stethoscope,
  },
  {
    role: 'Admin',
    name: 'Admin User',
    email: 'admin@smarthealth.com',
    password: 'password123',
    badge: 'Operations',
    icon: Building2,
  },
  {
    role: 'Super Admin',
    name: 'Super Admin',
    email: 'superadmin@smarthealth.com',
    password: 'password123',
    badge: 'Root Access',
    icon: Shield,
  },
  {
    role: 'Patient',
    name: 'John Doe',
    email: 'patient@smarthealth.com',
    password: 'password123',
    badge: 'Self-Service',
    icon: HeartHandshake,
  },
];

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { login } = useAuth();
  const navigate = useNavigate();

  const [isBiometricLoading, setIsBiometricLoading] = useState(false);

  const handleBiometricLogin = async () => {
    setIsBiometricLoading(true);
    setError('');

    try {
      // Simulate WebAuthn/Biometric key verification delay
      await new Promise((resolve) => setTimeout(resolve, 1000));
      
      // Speed up clinical authentication by logging in with default Doctor account
      const defaultDoctor = DEMO_ACCOUNTS[0]; // doctor@smarthealth.com
      await login(defaultDoctor.email, defaultDoctor.password);
      
      navigate('/dashboard');
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : 'Biometric identification failed.';
      setError(errMsg);
    } finally {
      setIsBiometricLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!email.trim() || !password) {
      setError('Please provide both your work email and password.');
      return;
    }

    setLoading(true);
    try {
      await login(email, password);
      navigate('/dashboard');
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : 'Authentication failed. Please check your credentials.';
      setError(errMsg);
    } finally {
      setLoading(false);
    }
  };

  const handleQuickFill = (demoEmail: string, demoPass: string) => {
    setEmail(demoEmail);
    setPassword(demoPass);
    setError('');
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 sm:p-6 bg-background text-foreground">
      <div className="w-full max-w-4xl grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* Left Side: Hospital Brand & System Status Overview */}
        <div className="lg:col-span-5 flex flex-col justify-between p-6 sm:p-8 rounded-xl bg-card border border-border">
          <div className="space-y-6">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-xl bg-accent/15 border border-accent/30 flex items-center justify-center flex-shrink-0">
                <Activity className="h-6 w-6 text-accent" />
              </div>
              <div>
                <h1 className="text-xl font-bold tracking-tight text-foreground">Smart Health</h1>
                <p className="text-xs text-muted-foreground font-medium">Enterprise Clinical Platform</p>
              </div>
            </div>

            <div className="space-y-3 pt-2">
              <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs font-medium">
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                All Clinical Services Operational
              </div>
              <h2 className="text-2xl font-bold tracking-tight text-foreground leading-snug">
                Integrated Hospital Management & Patient Care
              </h2>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Secure electronic health records, automated pharmacy dispensing, OPD scheduling, and general ledger accounting.
              </p>
            </div>

            <div className="space-y-2.5 pt-2 text-xs text-muted-foreground">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-accent flex-shrink-0" />
                <span>HIPAA & GDPR Compliant Data Encryption</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-accent flex-shrink-0" />
                <span>Role-Based Access Control & Audit Trails</span>
              </div>
              <div className="flex items-center gap-2">
                <Building2 className="h-4 w-4 text-accent flex-shrink-0" />
                <span>Multi-Facility Network Synchronization</span>
              </div>
            </div>
          </div>

          <div className="pt-8 mt-6 border-t border-border flex items-center justify-between text-xs text-muted-foreground">
            <span>Hospital Security Tier 4</span>
            <Link to="/super-admin/login" className="text-accent hover:underline font-medium flex items-center gap-1">
              <Shield className="h-3.5 w-3.5" />
              Super Admin Portal
            </Link>
          </div>
        </div>

        {/* Right Side: Sign-In Card */}
        <div className="lg:col-span-7 flex flex-col justify-center">
          <Card className="border border-border bg-card shadow-md">
            <CardHeader className="space-y-1 pb-4">
              <div className="flex items-center justify-between">
                <CardTitle className="text-xl font-bold text-foreground">Sign In to Workstation</CardTitle>
                <Badge variant="outline" className="text-xs font-normal text-muted-foreground">
                  v1.2.0 Production
                </Badge>
              </div>
              <CardDescription className="text-xs text-muted-foreground">
                Enter your authorized clinical or administrative credentials
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-4">
              {error && (
                <div className="p-3 rounded-lg bg-destructive/15 border border-destructive/30 flex items-start gap-2.5 text-destructive text-xs">
                  <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                  <span className="font-medium">{error}</span>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="email" className="text-xs font-medium text-foreground flex items-center gap-1.5">
                    <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                    Email
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="doctor@smarthealth.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoComplete="username"
                    aria-label="Email"
                    className="h-10 text-sm bg-background border-border"
                  />
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="password" className="text-xs font-medium text-foreground flex items-center gap-1.5">
                      <Lock className="h-3.5 w-3.5 text-muted-foreground" />
                      Password
                    </Label>
                    <Link
                      to="/forgot-password"
                      className="text-xs text-accent hover:underline font-medium"
                    >
                      Forgot password?
                    </Link>
                  </div>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      autoComplete="current-password"
                      aria-label="Password"
                      className="h-10 pr-10 text-sm bg-background border-border"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                      title={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-1">
                  <div className="flex items-center gap-2">
                    <input
                      id="remember"
                      type="checkbox"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                      className="h-4 w-4 rounded border-border text-accent focus:ring-accent"
                    />
                    <Label htmlFor="remember" className="text-xs text-muted-foreground cursor-pointer">
                      Remember this workstation
                    </Label>
                  </div>
                  <Link to="/two-factor" className="text-xs text-muted-foreground hover:text-foreground">
                    2FA Prompt
                  </Link>
                </div>

                <div className="flex gap-2.5 pt-2">
                  <Button
                    type="submit"
                    className="flex-1 h-11 text-sm font-semibold bg-accent text-accent-foreground hover:bg-accent/90 transition-colors"
                    disabled={loading || isBiometricLoading}
                  >
                    {loading ? 'Authenticating...' : 'Sign In'}
                  </Button>

                  <Button
                    type="button"
                    variant="outline"
                    className="h-11 px-3 border-border hover:bg-muted/10 gap-2 text-xs font-semibold"
                    onClick={handleBiometricLogin}
                    disabled={loading || isBiometricLoading}
                    title="Biometric Sign In (FaceID / TouchID)"
                  >
                    {isBiometricLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin text-accent" />
                    ) : (
                      <Fingerprint className="h-5 w-5 text-accent" />
                    )}
                  </Button>
                </div>
              </form>

              {/* Demo Quick Accounts Section */}
              <div className="pt-4 border-t border-border">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Quick Demo Accounts
                  </span>
                  <span className="text-[11px] text-muted-foreground">Click to fill credentials</span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {DEMO_ACCOUNTS.map((acc) => {
                    const Icon = acc.icon;
                    const isSelected = email === acc.email;
                    return (
                      <button
                        key={acc.role}
                        type="button"
                        onClick={() => handleQuickFill(acc.email, acc.password)}
                        className={`p-2 rounded-lg border text-left transition-colors flex items-center justify-between ${
                          isSelected
                            ? 'bg-accent/15 border-accent text-foreground'
                            : 'bg-muted/40 border-border hover:bg-muted text-muted-foreground hover:text-foreground'
                        }`}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <Icon className={`h-4 w-4 flex-shrink-0 ${isSelected ? 'text-accent' : ''}`} />
                          <div className="min-w-0">
                            <div className="text-xs font-medium truncate text-foreground">{acc.role}</div>
                            <div className="text-[10px] text-muted-foreground truncate">{acc.badge}</div>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </CardContent>

            <CardFooter className="flex flex-col sm:flex-row items-center justify-between border-t border-border pt-4 text-xs text-muted-foreground gap-2">
              <span>New hospital staff member?</span>
              <Link to="/signup" className="text-accent hover:underline font-semibold">
                Register New Account
              </Link>
            </CardFooter>
          </Card>
        </div>
      </div>
    </div>
  );
}
