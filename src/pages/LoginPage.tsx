import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useAuth } from '@/contexts/AuthContext';
import { authenticatePasskey } from '@/utils/webauthn';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Activity,
  Lock,
  Mail,
  Eye,
  EyeOff,
  AlertCircle,
  Stethoscope,
  Building2,
  Shield,
  ShieldCheck,
  HeartHandshake,
  Fingerprint,
  Loader2,
} from 'lucide-react';

const loginSchema = z.object({
  email: z
    .string()
    .min(1, 'Email address is required')
    .email('Please enter a valid work email address'),
  password: z
    .string()
    .min(6, 'Password must be at least 6 characters'),
  rememberMe: z.boolean(),
});

type LoginFormValues = z.infer<typeof loginSchema>;

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
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [serverError, setServerError] = useState('');
  const { login } = useAuth();
  const navigate = useNavigate();

  const [isBiometricLoading, setIsBiometricLoading] = useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
      rememberMe: true,
    },
  });

  const currentEmail = watch('email');

  const handleBiometricLogin = async () => {
    setIsBiometricLoading(true);
    setServerError('');

    try {
      const targetEmail = (currentEmail || '').trim() || DEMO_ACCOUNTS[0].email;
      const passkeyOk = await authenticatePasskey(targetEmail);
      if (passkeyOk) {
        // Authenticate as the target clinician (default Dr. John Smith if none typed)
        const matchedAccount = DEMO_ACCOUNTS.find((a) => a.email.toLowerCase() === targetEmail.toLowerCase()) || DEMO_ACCOUNTS[0];
        await login(matchedAccount.email, matchedAccount.password);
        navigate('/dashboard');
      } else {
        setServerError('WebAuthn biometric authentication was not completed.');
      }
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : 'Biometric WebAuthn identification failed.';
      setServerError(errMsg);
    } finally {
      setIsBiometricLoading(false);
    }
  };

  const onSubmit = async (data: LoginFormValues) => {
    setServerError('');
    setLoading(true);
    try {
      await login(data.email, data.password);
      const isMfaEnabled = localStorage.getItem('mfa_enabled') !== 'false';
      if (isMfaEnabled) {
        navigate('/two-factor');
      } else {
        navigate('/dashboard');
      }
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : 'Authentication failed. Please check your credentials.';
      setServerError(errMsg);
    } finally {
      setLoading(false);
    }
  };

  const handleQuickFill = (demoEmail: string, demoPass: string) => {
    setValue('email', demoEmail, { shouldValidate: true });
    setValue('password', demoPass, { shouldValidate: true });
    setServerError('');
  };

  return (
    <div className="min-h-screen flex w-full bg-background">
      {/* Left Side: Sign-In Form */}
      <div className="flex-1 flex flex-col justify-center px-4 sm:px-6 lg:flex-none lg:w-[480px] xl:w-[560px] 2xl:w-[640px] z-10 bg-background relative shadow-2xl">
        <div className="mx-auto w-full max-w-sm sm:max-w-md">
          
          <div className="mb-8">
            <div className="flex items-center gap-3 mb-6">
              <div className="h-10 w-10 rounded-lg bg-primary flex items-center justify-center">
                <Activity className="h-5 w-5 text-primary-foreground" />
              </div>
              <h1 className="text-2xl font-bold tracking-tight text-foreground">Smart Health</h1>
            </div>
            
            <h2 className="text-3xl font-bold tracking-tight text-foreground mb-2">Welcome back</h2>
            <p className="text-sm text-muted-foreground">
              Sign in to your clinical workstation
            </p>
          </div>

          <div className="space-y-6">
            {serverError && (
              <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 flex items-start gap-3 text-destructive text-sm">
                <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                <span className="font-medium">{serverError}</span>
              </div>
            )}

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
              <div className="space-y-1.5">
                <Label htmlFor="email" className="text-sm font-semibold text-foreground">
                  Email address
                </Label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <Input
                    id="email"
                    type="email"
                    placeholder="name@smarthealth.com"
                    autoComplete="username"
                    {...register('email')}
                    className={`pl-10 h-11 bg-muted/40 border-border focus-visible:ring-primary focus-visible:border-primary ${
                      errors.email ? 'border-destructive focus-visible:ring-destructive' : ''
                    }`}
                  />
                </div>
                {errors.email && (
                  <p className="text-xs text-destructive font-medium flex items-center gap-1 mt-1">
                    <AlertCircle className="h-3 w-3" />
                    {errors.email.message}
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password" className="text-sm font-semibold text-foreground">
                    Password
                  </Label>
                  <Link
                    to="/forgot-password"
                    className="text-sm font-medium text-primary hover:underline"
                  >
                    Forgot password?
                  </Link>
                </div>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Lock className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="••••••••"
                    autoComplete="current-password"
                    {...register('password')}
                    className={`pl-10 pr-10 h-11 bg-muted/40 border-border focus-visible:ring-primary focus-visible:border-primary ${
                      errors.password ? 'border-destructive focus-visible:ring-destructive' : ''
                    }`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {errors.password && (
                  <p className="text-xs text-destructive font-medium flex items-center gap-1 mt-1">
                    <AlertCircle className="h-3 w-3" />
                    {errors.password.message}
                  </p>
                )}
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <input
                    id="remember"
                    type="checkbox"
                    {...register('rememberMe')}
                    className="h-4 w-4 rounded border-border text-primary focus:ring-primary bg-background cursor-pointer"
                  />
                  <Label htmlFor="remember" className="text-sm font-medium text-foreground cursor-pointer">
                    Remember me
                  </Label>
                </div>
                <Link to="/two-factor" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
                  Use 2FA
                </Link>
              </div>

              <div className="flex gap-3 pt-2">
                <Button
                  type="submit"
                  className="flex-1 h-11 text-base font-semibold bg-primary text-primary-foreground hover:bg-primary/90"
                  disabled={loading || isBiometricLoading}
                >
                  {loading ? 'Signing in...' : 'Sign In'}
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  className="h-11 px-4 border-border hover:bg-muted font-semibold"
                  onClick={handleBiometricLogin}
                  disabled={loading || isBiometricLoading}
                  title="Biometric Sign In"
                >
                  {isBiometricLoading ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <Fingerprint className="h-5 w-5 text-primary" />
                  )}
                </Button>
              </div>
            </form>

            <div className="mt-8 pt-6 border-t border-border">
              <p className="text-sm font-medium text-muted-foreground mb-4">Quick demo accounts</p>
              <div className="grid grid-cols-2 gap-3">
                {DEMO_ACCOUNTS.map((acc) => {
                  const Icon = acc.icon;
                  const isSelected = currentEmail === acc.email;
                  return (
                    <button
                      key={acc.role}
                      type="button"
                      onClick={() => handleQuickFill(acc.email, acc.password)}
                      className={`p-3 rounded-xl border text-left transition-all duration-200 ${
                        isSelected
                          ? 'bg-primary/10 border-primary ring-1 ring-primary'
                          : 'bg-card border-border hover:border-primary/50 hover:bg-muted/50'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg ${isSelected ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
                          <Icon className="h-4 w-4" />
                        </div>
                        <div className="min-w-0">
                          <div className={`text-sm font-semibold truncate ${isSelected ? 'text-primary' : 'text-foreground'}`}>
                            {acc.role}
                          </div>
                          <div className="text-xs text-muted-foreground truncate font-medium">
                            {acc.badge}
                          </div>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            <p className="text-center text-sm text-muted-foreground mt-8">
              New staff member?{' '}
              <Link to="/signup" className="font-semibold text-primary hover:underline">
                Register here
              </Link>
            </p>
          </div>
        </div>
      </div>

      {/* Right Side: Informational Panel */}
      <div className="hidden lg:flex flex-1 flex-col justify-between bg-zinc-950 px-12 py-16 text-white overflow-hidden relative">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxwYXRoIGQ9Ik0zNiAzNEwzNiA1OE0yNCAzNEwyNCA1OE0xMiAzNEwxMiA1OE00OCAzNEw0OCA1OE0wIDYwTDYwIDYwTTAgNDhMNjAgNDhNMCAzNkw2MCAzNk0wIDI0TDYwIDI0TTAgMTJMNjAgMTJNMCAwTDYwIDAiIHN0cm9rZT0icmdiYSgyNTUsMjU1LDI1NSwwLjA1KSIgc3Ryb2tlLXdpZHRoPSIxIi8+PC9nPjwvc3ZnPg==')] opacity-20 pointer-events-none"></div>
        
        <div className="relative z-10 max-w-2xl mt-12">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/20 text-emerald-400 text-sm font-semibold mb-8 border border-emerald-500/30">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            System Operational
          </div>
          <h2 className="text-4xl xl:text-5xl font-bold tracking-tight mb-6 leading-[1.15]">
            Secure, intelligent healthcare management.
          </h2>
          <p className="text-lg text-zinc-400 leading-relaxed max-w-xl">
            A comprehensive clinical platform combining electronic health records, pharmacy workflows, and automated scheduling into one unified system.
          </p>
        </div>

        <div className="relative z-10 max-w-2xl">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-12 border-t border-zinc-800">
            <div className="flex gap-4">
              <div className="h-10 w-10 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center flex-shrink-0">
                <ShieldCheck className="h-5 w-5 text-zinc-300" />
              </div>
              <div>
                <h3 className="font-semibold text-zinc-100">Enterprise Security</h3>
                <p className="text-sm text-zinc-400 mt-1">HIPAA compliant encryption with role-based access control.</p>
              </div>
            </div>
            <div className="flex gap-4">
              <div className="h-10 w-10 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center flex-shrink-0">
                <Activity className="h-5 w-5 text-zinc-300" />
              </div>
              <div>
                <h3 className="font-semibold text-zinc-100">Real-time Telemetry</h3>
                <p className="text-sm text-zinc-400 mt-1">Live patient vitals monitoring and algorithmic triage.</p>
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-2 text-sm text-zinc-500 mt-16 font-medium">
            <span>&copy; 2026 Smart Health Systems</span>
            <span>&middot;</span>
            <Link to="/super-admin/login" className="hover:text-zinc-300 transition-colors flex items-center gap-1.5">
              <Shield className="h-3.5 w-3.5" />
              Super Admin Access
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
