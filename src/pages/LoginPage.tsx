import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { motion } from 'motion/react';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/services/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import {
  Activity,
  Lock,
  Mail,
  Eye,
  EyeOff,
  AlertCircle,
  ShieldCheck,
  Loader2,
  ArrowLeft,
  Smartphone,
  CheckCircle2,
  KeyRound,
  Send,
} from 'lucide-react';
import { toast } from 'sonner';

// Schemas for forms
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

const forgotSchema = z.object({
  email: z
    .string()
    .min(1, 'Email address is required')
    .email('Please enter a valid work email address'),
});

type LoginFormValues = z.infer<typeof loginSchema>;
type ForgotFormValues = z.infer<typeof forgotSchema>;

export default function LoginPage() {
  const [formMode, setFormMode] = useState<'login' | 'forgot'>('login');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [serverError, setServerError] = useState('');
  const [totpCode, setTotpCode] = useState('');
  const [totpLoading, setTotpLoading] = useState(false);

  const { login, mfaPending, mfaPendingUser, verifyMfaTotp, cancelMfa } = useAuth();
  const navigate = useNavigate();

  // Load saved email if exists
  const savedEmail = localStorage.getItem('remember_email') || '';
  const initialRemember = !!savedEmail;

  // React Hook Form for login
  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    mode: 'onChange',
    defaultValues: {
      email: savedEmail,
      password: '',
      rememberMe: initialRemember,
    },
  });

  // React Hook Form for forgot password
  const {
    register: registerForgot,
    handleSubmit: handleSubmitForgot,
    formState: { errors: errorsForgot },
    reset: resetForgot,
  } = useForm<ForgotFormValues>({
    resolver: zodResolver(forgotSchema),
    mode: 'onChange',
    defaultValues: {
      email: '',
    },
  });

  // Ensure remembered email is set if it changes (or loads late)
  useEffect(() => {
    if (savedEmail) {
      setValue('email', savedEmail);
      setValue('rememberMe', true);
    }
  }, [savedEmail, setValue]);

  const onSubmit = async (data: LoginFormValues) => {
    setServerError('');
    setLoading(true);
    try {
      if (data.rememberMe) {
        localStorage.setItem('remember_email', data.email);
      } else {
        localStorage.removeItem('remember_email');
      }
      const res = await login(data.email, data.password);
      if (!res.requiresMfa) {
        toast.success('Successfully logged in!');
        navigate('/dashboard');
      }
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : 'Authentication failed. Please check your credentials.';
      setServerError(errMsg);
    } finally {
      setLoading(false);
    }
  };

  const onForgotSubmit = async (data: ForgotFormValues) => {
    setServerError('');
    setLoading(true);
    try {
      await api.forgotPassword(data.email);
      toast.success('A password reset link has been successfully dispatched.');
      setFormMode('login');
      resetForgot();
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : 'Failed to send password reset email.';
      setServerError(errMsg);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyTotpSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setServerError('');
    if (totpCode.trim().length !== 6) {
      setServerError('Please enter the complete 6-digit TOTP security token.');
      return;
    }
    setTotpLoading(true);
    try {
      await verifyMfaTotp(totpCode);
      toast.success('Authenticator MFA token verified successfully!');
      navigate('/dashboard');
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : 'Invalid TOTP code. Please check your authenticator app.';
      setServerError(errMsg);
    } finally {
      setTotpLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex w-full bg-background" id="login-page">
      {/* Left Side: Sign-In / Forgot Password Form */}
      <div className="flex-1 flex flex-col justify-center items-center lg:items-stretch px-4 xs:px-6 sm:px-8 lg:px-12 lg:flex-none lg:w-[480px] xl:w-[560px] 2xl:w-[640px] z-10 bg-background relative shadow-2xl">
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
          className="w-full max-w-[340px] xs:max-w-sm sm:max-w-md mx-auto my-auto lg:my-0"
        >
          
          <div className="mb-8">
            <div className="flex items-center gap-3 mb-6">
              <div className="h-10 w-10 rounded-lg bg-primary flex items-center justify-center">
                <Activity className="h-5 w-5 text-primary-foreground" />
              </div>
              <h1 className="text-2xl font-bold tracking-tight text-foreground">Smart Health</h1>
            </div>
            
            <h2 className="text-3xl font-bold tracking-tight text-foreground mb-2">
              {mfaPending 
                ? 'Two-Factor Verification' 
                : formMode === 'forgot' 
                  ? 'Reset Password' 
                  : 'Welcome back'}
            </h2>
            <p className="text-sm text-muted-foreground">
              {mfaPending
                ? 'Enter the 6-digit code from your authenticator app (TOTP standard)'
                : formMode === 'forgot'
                  ? 'Provide your work email address to receive password reset instructions'
                  : 'Sign in to your clinical workstation'}
            </p>
          </div>

          <div className="space-y-6">
            {serverError && (
              <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 flex items-start gap-3 text-destructive text-sm" id="server-error-container">
                <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                <span className="font-medium" id="server-error-text">{serverError}</span>
              </div>
            )}

            {mfaPending ? (
              <div className="space-y-6 animate-in fade-in-50 duration-300" id="mfa-verification-container">
                <div className="p-4 rounded-xl border border-primary/20 bg-primary/5 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Account Credentials</span>
                    <Badge variant="outline" className="border-primary text-primary text-[10px] font-semibold flex items-center gap-1">
                      <KeyRound className="h-3 w-3" />
                      MFA ENFORCED
                    </Badge>
                  </div>
                  <div className="font-semibold text-foreground text-base">
                    {mfaPendingUser?.name || 'Staff Clinician'}
                  </div>
                  <div className="text-xs text-muted-foreground font-mono">
                    {mfaPendingUser?.email}
                  </div>
                </div>

                <form onSubmit={handleVerifyTotpSubmit} className="space-y-6" id="mfa-form">
                  <div className="space-y-2">
                    <Label className="text-sm font-semibold text-foreground flex items-center gap-2">
                      <Smartphone className="h-4 w-4 text-primary" />
                      Authenticator Security Code (TOTP)
                    </Label>
                    <div className="flex justify-center py-2">
                      <InputOTP
                        maxLength={6}
                        value={totpCode}
                        onChange={(val) => {
                          setTotpCode(val);
                          setServerError('');
                        }}
                        autoFocus
                        id="totp-otp-input"
                      >
                        <InputOTPGroup className="gap-2">
                          <InputOTPSlot index={0} className="h-12 w-11 text-lg font-mono rounded-md border-border bg-background" />
                          <InputOTPSlot index={1} className="h-12 w-11 text-lg font-mono rounded-md border-border bg-background" />
                          <InputOTPSlot index={2} className="h-12 w-11 text-lg font-mono rounded-md border-border bg-background" />
                          <InputOTPSlot index={3} className="h-12 w-11 text-lg font-mono rounded-md border-border bg-background" />
                          <InputOTPSlot index={4} className="h-12 w-11 text-lg font-mono rounded-md border-border bg-background" />
                          <InputOTPSlot index={5} className="h-12 w-11 text-lg font-mono rounded-md border-border bg-background" />
                        </InputOTPGroup>
                      </InputOTP>
                    </div>
                    <p className="text-xs text-muted-foreground text-center">
                      Open Google Authenticator, Authy, or 1Password to view your 6-digit token.
                    </p>
                  </div>

                  <div className="space-y-3">
                    <Button
                      type="submit"
                      id="mfa-submit-btn"
                      className="w-full h-11 text-base font-semibold bg-primary text-primary-foreground hover:bg-primary/90"
                      disabled={totpLoading || totpCode.length !== 6}
                    >
                      {totpLoading ? (
                        <span className="flex items-center gap-2">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Verifying Authenticator Code...
                        </span>
                      ) : (
                        'Verify Code & Access Workstation'
                      )}
                    </Button>

                    <Button
                      type="button"
                      id="fill-demo-totp-btn"
                      variant="outline"
                      onClick={() => {
                        setTotpCode('123456');
                        setServerError('');
                      }}
                      className="w-full text-xs h-9 border-dashed border-primary/40 text-primary hover:bg-primary/5"
                    >
                      <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />
                      Quick Test: Fill Demo TOTP Token (123456)
                    </Button>

                    <Button
                      type="button"
                      id="cancel-mfa-btn"
                      variant="ghost"
                      onClick={cancelMfa}
                      className="w-full text-xs text-muted-foreground hover:text-foreground flex items-center justify-center gap-1.5"
                    >
                      <ArrowLeft className="h-3.5 w-3.5" />
                      Back to Email & Password Sign In
                    </Button>
                  </div>
                </form>

                <div className="p-3 rounded-lg bg-muted/60 border border-border text-[11px] text-muted-foreground space-y-1">
                  <div className="font-semibold text-foreground flex items-center gap-1.5">
                    <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
                    Standard Authenticator Configured
                  </div>
                  <p>
                    Key format: RFC 6238 TOTP (30s interval, HMAC-SHA1). Standard seed: <code className="font-mono bg-background px-1 py-0.5 rounded border border-border text-foreground">JBSWY3DPEHPK3PXP</code>.
                  </p>
                </div>
              </div>
            ) : formMode === 'forgot' ? (
              <form onSubmit={handleSubmitForgot(onForgotSubmit)} className="space-y-5" noValidate id="forgot-password-form">
                <div className="space-y-1.5">
                  <Label htmlFor="forgot-email" className="text-sm font-semibold text-foreground">
                    Work Email Address
                  </Label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Mail className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <Input
                      id="forgot-email"
                      type="email"
                      placeholder="name@smarthealth.com"
                      autoComplete="email"
                      {...registerForgot('email')}
                      className={`pl-10 h-11 bg-muted/40 border-border focus-visible:ring-primary focus-visible:border-primary ${
                        errorsForgot.email ? 'border-destructive focus-visible:ring-destructive' : ''
                      }`}
                    />
                  </div>
                  {errorsForgot.email && (
                    <p className="text-xs text-destructive font-medium flex items-center gap-1 mt-1" id="forgot-email-error">
                      <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                      <span>{errorsForgot.email.message}</span>
                    </p>
                  )}
                </div>

                <div className="space-y-3 pt-2">
                  <Button
                    type="submit"
                    id="forgot-submit-btn"
                    className="w-full h-11 text-base font-semibold bg-primary text-primary-foreground hover:bg-primary/90 flex items-center justify-center gap-2"
                    disabled={loading}
                  >
                    {loading ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Sending Reset Link...
                      </>
                    ) : (
                      <>
                        <Send className="h-4 w-4" />
                        Send Password Reset Link
                      </>
                    )}
                  </Button>

                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => {
                      setFormMode('login');
                      setServerError('');
                    }}
                    className="w-full text-xs text-muted-foreground hover:text-foreground flex items-center justify-center gap-1.5"
                  >
                    <ArrowLeft className="h-3.5 w-3.5" />
                    Back to Workstation Sign In
                  </Button>
                </div>
              </form>
            ) : (
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate id="login-form">
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
                    <p className="text-xs text-destructive font-medium flex items-center gap-1 mt-1" id="email-error">
                      <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                      <span>{errors.email.message}</span>
                    </p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="password" className="text-sm font-semibold text-foreground">
                      Password
                    </Label>
                    <button
                      type="button"
                      onClick={() => {
                        setFormMode('forgot');
                        setServerError('');
                      }}
                      className="text-sm font-medium text-primary hover:underline"
                    >
                      Forgot password?
                    </button>
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
                      id="toggle-password-visibility"
                      className="absolute inset-y-0 right-0 pr-3 flex items-center text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  {errors.password && (
                    <p className="text-xs text-destructive font-medium flex items-center gap-1 mt-1" id="password-error">
                      <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                      <span>{errors.password.message}</span>
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

                <Button
                  type="submit"
                  id="login-submit-btn"
                  className="w-full h-11 text-base font-semibold bg-primary text-primary-foreground hover:bg-primary/90 flex items-center justify-center"
                  disabled={loading}
                >
                  {loading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      Signing in...
                    </>
                  ) : (
                    'Sign In'
                  )}
                </Button>
              </form>
            )}

            <p className="text-center text-sm text-muted-foreground mt-4">
              New staff member?{' '}
              <Link to="/signup" className="font-semibold text-primary hover:underline">
                Register here
              </Link>
            </p>
          </div>
        </motion.div>
      </div>

      {/* Right Side: Informational Panel */}
      <div className="hidden lg:flex flex-1 flex-col justify-between bg-zinc-950 px-12 py-16 text-white overflow-hidden relative">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxwYXRoIGQ9Ik0zNiAzNEwzNiA1OE0yNCAzNEwyNCA1OE0xMiAzNEwxMiA1OE00OCAzNEw0OCA1OE0wIDYwTDYwIDYwTTAgNDhMNjAgNDhNMCAzNkw2MCAzNk0wIDYwTDYwIDYwTTAgNDhMNjAgNDhNMCAzNkw2MCAzNk0wIDI0TDYwIDI0TTAgMTJMNjAgMTJNMCAwTDYwIDAiIHN0cm9rZT0icmdiYSgyNTUsMjU1LDI1NSwwLjA1KSIgc3Ryb2tlLXdpZHRoPSIxIi8+PC9nPjwvc3ZnPg==')] opacity-20 pointer-events-none"></div>
        
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
              <ShieldCheck className="h-3.5 w-3.5" />
              Super Admin Access
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
