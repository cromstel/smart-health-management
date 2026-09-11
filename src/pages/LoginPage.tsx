import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/services/api';
import { AuthLayout, OtpHero } from '@/components/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
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

const loginSchema = z.object({
  email: z
    .string()
    .min(1, 'Email address is required')
    .email('Please enter a valid work email address'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters'),
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

  const savedEmail = localStorage.getItem('remember_email') || '';
  const initialRemember = !!savedEmail;

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

  const getPageTitle = () => {
    if (mfaPending) return 'Two-Factor Verification';
    if (formMode === 'forgot') return 'Reset Password';
    return 'Welcome back';
  };

  const getPageDescription = () => {
    if (mfaPending) return 'Enter the 6-digit code from your authenticator app (TOTP standard)';
    if (formMode === 'forgot') return 'Provide your work email address to receive password reset instructions';
    return 'Sign in to your clinical workstation';
  };

  return (
    <AuthLayout>
      <div className="space-y-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <div className="flex items-center gap-3 mb-6">
            <motion.div
              className="h-11 w-11 rounded-xl bg-primary flex items-center justify-center shadow-lg shadow-primary/20"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <Activity className="h-5 w-5 text-primary-foreground" aria-hidden="true" />
            </motion.div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Smart Health</h1>
          </div>

          <AnimatePresence mode="wait">
            <motion.div
              key={getPageTitle()}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 10 }}
              transition={{ duration: 0.2 }}
            >
              <h2 className="text-3xl font-bold tracking-tight text-foreground mb-2">
                {getPageTitle()}
              </h2>
              <p className="text-sm text-muted-foreground">
                {getPageDescription()}
              </p>
            </motion.div>
          </AnimatePresence>
        </motion.div>

        {/* Error Alert */}
        <AnimatePresence>
          {serverError && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="p-4 rounded-xl bg-destructive/10 border border-destructive/20 flex items-start gap-3 text-destructive text-sm"
              id="server-error-container"
              role="alert"
              aria-live="assertive"
            >
              <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" aria-hidden="true" />
              <span className="font-medium" id="server-error-text">{serverError}</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Form Content */}
        <AnimatePresence mode="wait">
          {mfaPending ? (
            <motion.div
              key="mfa"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
              className="space-y-6"
              id="mfa-verification-container"
            >
              {/* MFA User Info Card */}
              <div className="p-4 rounded-xl border border-accent/20 bg-accent/5 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Account Credentials</span>
                  <Badge variant="outline" className="border-accent text-accent text-[10px] font-semibold flex items-center gap-1">
                    <KeyRound className="h-3 w-3" aria-hidden="true" />
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
                <div className="space-y-3">
                  <Label className="text-sm font-semibold text-foreground flex items-center gap-2">
                    <Smartphone className="h-4 w-4 text-accent" aria-hidden="true" />
                    Authenticator Security Code (TOTP)
                  </Label>
                  <div className="flex justify-center py-2">
                    <OtpHero
                      id="totp-otp-input"
                      value={totpCode}
                      onChange={(val) => {
                        setTotpCode(val);
                        setServerError('');
                      }}
                      ariaLabel="Enter 6-digit TOTP code"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground text-center">
                    Open Google Authenticator, Authy, or 1Password to view your 6-digit token.
                  </p>
                </div>

                <div className="space-y-3">
                  <Button
                    type="submit"
                    id="mfa-submit-btn"
                    className="w-full h-11 text-base font-semibold bg-accent text-accent-foreground hover:bg-accent/90 transition-all duration-200 shadow-lg shadow-accent/20 hover:shadow-xl hover:shadow-accent/30"
                    disabled={totpLoading || totpCode.length !== 6}
                  >
                    {totpLoading ? (
                      <span className="flex items-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                        Verifying Authenticator Code...
                      </span>
                    ) : (
                      'Verify Code & Access Workstation'
                    )}
                  </Button>

                  {import.meta.env.DEV && (
                    <Button
                      type="button"
                      id="fill-demo-totp-btn"
                      variant="outline"
                      onClick={() => {
                        setTotpCode('123456');
                        setServerError('');
                      }}
                      className="w-full text-xs h-9 border-dashed border-accent/40 text-accent hover:bg-accent/5 transition-colors"
                    >
                      <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" aria-hidden="true" />
                      Quick Test: Fill Demo TOTP Token (123456)
                    </Button>
                  )}

                  <Button
                    type="button"
                    id="cancel-mfa-btn"
                    variant="ghost"
                    onClick={cancelMfa}
                    className="w-full text-xs text-muted-foreground hover:text-foreground flex items-center justify-center gap-1.5 transition-colors"
                  >
                    <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
                    Back to Email & Password Sign In
                  </Button>
                </div>
              </form>

              {import.meta.env.DEV && (
                <div className="p-3 rounded-lg bg-muted/60 border border-border text-[11px] text-muted-foreground space-y-1">
                  <div className="font-semibold text-foreground flex items-center gap-1.5">
                    <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" aria-hidden="true" />
                    Standard Authenticator Configured
                  </div>
                  <p>
                    Key format: RFC 6238 TOTP (30s interval, HMAC-SHA1). Standard seed:{' '}
                    <code className="font-mono bg-background px-1 py-0.5 rounded border border-border text-foreground">JBSWY3DPEHPK3PXP</code>
                  </p>
                </div>
              )}
            </motion.div>
          ) : formMode === 'forgot' ? (
            <motion.form
              key="forgot"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
              onSubmit={handleSubmitForgot(onForgotSubmit)}
              className="space-y-5"
              noValidate
              id="forgot-password-form"
            >
              <div className="space-y-2">
                <Label htmlFor="forgot-email" className="text-sm font-semibold text-foreground">
                  Work Email Address
                </Label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Mail className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                  </div>
                  <Input
                    id="forgot-email"
                    type="email"
                    placeholder="name@smarthealth.com"
                    autoComplete="email"
                    {...registerForgot('email')}
                    className={`pl-10 h-11 bg-muted/40 border-border focus-visible:ring-accent transition-all duration-200 ${
                      errorsForgot.email ? 'border-destructive focus-visible:ring-destructive' : ''
                    }`}
                    aria-invalid={errorsForgot.email ? 'true' : 'false'}
                    aria-describedby={errorsForgot.email ? 'forgot-email-error' : undefined}
                  />
                </div>
                {errorsForgot.email && (
                  <p className="text-xs text-destructive font-medium flex items-center gap-1 mt-1" id="forgot-email-error" role="alert">
                    <AlertCircle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                    <span>{errorsForgot.email.message}</span>
                  </p>
                )}
              </div>

              <div className="space-y-3 pt-2">
                <Button
                  type="submit"
                  id="forgot-submit-btn"
                  className="w-full h-11 text-base font-semibold bg-accent text-accent-foreground hover:bg-accent/90 flex items-center justify-center gap-2 transition-all duration-200 shadow-lg shadow-accent/20 hover:shadow-xl hover:shadow-accent/30"
                  disabled={loading}
                >
                  {loading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                      Sending Reset Link...
                    </>
                  ) : (
                    <>
                      <Send className="h-4 w-4" aria-hidden="true" />
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
                  className="w-full text-xs text-muted-foreground hover:text-foreground flex items-center justify-center gap-1.5 transition-colors"
                >
                  <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
                  Back to Workstation Sign In
                </Button>
              </div>
            </motion.form>
          ) : (
            <motion.form
              key="login"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.3 }}
              onSubmit={handleSubmit(onSubmit)}
              className="space-y-5"
              noValidate
              id="login-form"
            >
              <div className="space-y-2">
                <Label htmlFor="email" className="text-sm font-semibold text-foreground">
                  Email address
                </Label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Mail className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                  </div>
                  <Input
                    id="email"
                    type="email"
                    placeholder="name@smarthealth.com"
                    autoComplete="email"
                    {...register('email')}
                    className={`pl-10 h-11 bg-muted/40 border-border focus-visible:ring-accent transition-all duration-200 ${
                      errors.email ? 'border-destructive focus-visible:ring-destructive' : ''
                    }`}
                    aria-invalid={errors.email ? 'true' : 'false'}
                    aria-describedby={errors.email ? 'email-error' : undefined}
                  />
                </div>
                {errors.email && (
                  <p className="text-xs text-destructive font-medium flex items-center gap-1 mt-1" id="email-error" role="alert">
                    <AlertCircle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                    <span>{errors.email.message}</span>
                  </p>
                )}
              </div>

              <div className="space-y-2">
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
                    className="text-sm font-medium text-accent hover:text-accent/80 transition-colors"
                  >
                    Forgot password?
                  </button>
                </div>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Lock className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                  </div>
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="••••••••"
                    autoComplete="current-password"
                    {...register('password')}
                    className={`pl-10 pr-10 h-11 bg-muted/40 border-border focus-visible:ring-accent transition-all duration-200 ${
                      errors.password ? 'border-destructive focus-visible:ring-destructive' : ''
                    }`}
                    aria-invalid={errors.password ? 'true' : 'false'}
                    aria-describedby={errors.password ? 'password-error' : undefined}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    id="toggle-password-visibility"
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-muted-foreground hover:text-foreground transition-colors"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" aria-hidden="true" /> : <Eye className="h-4 w-4" aria-hidden="true" />}
                  </button>
                </div>
                {errors.password && (
                  <p className="text-xs text-destructive font-medium flex items-center gap-1 mt-1" id="password-error" role="alert">
                    <AlertCircle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                    <span>{errors.password.message}</span>
                  </p>
                )}
              </div>

              <div className="flex items-center gap-2">
                <input
                  id="remember"
                  type="checkbox"
                  {...register('rememberMe')}
                  className="h-4 w-4 rounded border-border text-accent focus:ring-accent bg-background cursor-pointer transition-colors"
                />
                <Label htmlFor="remember" className="text-sm font-medium text-foreground cursor-pointer">
                  Remember me
                </Label>
              </div>

              <Button
                type="submit"
                id="login-submit-btn"
                className="w-full h-11 text-base font-semibold bg-accent text-accent-foreground hover:bg-accent/90 flex items-center justify-center transition-all duration-200 shadow-lg shadow-accent/20 hover:shadow-xl hover:shadow-accent/30"
                disabled={loading}
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" aria-hidden="true" />
                    Signing in...
                  </>
                ) : (
                  'Sign In'
                )}
              </Button>
            </motion.form>
          )}
        </AnimatePresence>

        {/* Footer */}
        <motion.p
          className="text-center text-sm text-muted-foreground"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4, delay: 0.2 }}
        >
          New staff member?{' '}
          <Link to="/signup" className="font-semibold text-accent hover:text-accent/80 transition-colors">
            Register here
          </Link>
        </motion.p>
      </div>
    </AuthLayout>
  );
}