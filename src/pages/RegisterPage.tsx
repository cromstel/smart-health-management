import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/services/api';
import { AuthLayout, PasswordStrength } from '@/components/auth';
import Logo from '@/components/Logo';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { postAuthRoute } from '@/lib/postAuthRoute';
import {
  Eye,
  EyeOff,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
  ArrowRight,
  LogIn,
  Building2,
  User,
  Mail,
  Lock,
  Stethoscope,
  Layers,
  Loader2,
} from 'lucide-react';

const registerSchema = z
  .object({
    // Trimmed before the length check, not after. min(2) on the raw value is
    // satisfied by two spaces, and onSubmit then sends
    // `name: \`${first} ${last}\`.trim()` -- so the API could be handed an empty
    // name for a record that then displays as blank.
    firstName: z.string().trim().min(2, 'First name must be at least 2 characters'),
    lastName: z.string().trim().min(2, 'Last name must be at least 2 characters'),
    email: z
      .string()
      .min(1, 'Email address is required')
      .email('Please enter a valid work email address'),
    confirmEmail: z.string().min(1, 'Please confirm your email address'),
    role: z.string().min(1, 'Please select a role'),
    hospital: z.string().min(1, 'Please select a hospital facility'),
    department: z.string().min(1, 'Please select a department'),
    password: z
      .string()
      .min(8, 'Password must be at least 8 characters')
      .regex(/[A-Z]/, 'Must contain at least one uppercase letter')
      .regex(/[a-z]/, 'Must contain at least one lowercase letter')
      .regex(/[0-9]/, 'Must contain at least one number'),
    confirmPassword: z.string().min(1, 'Please confirm your password'),
    agreedToTerms: z.boolean().refine((val) => val === true, {
      message: 'You must accept the HIPAA Compliance and Security Policies',
    }),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  })
  .refine((data) => data.email.trim().toLowerCase() === data.confirmEmail.trim().toLowerCase(), {
    message: 'Email addresses do not match',
    path: ['confirmEmail'],
  });

type RegisterFormValues = z.infer<typeof registerSchema>;

const roleApiValues: Record<RegisterFormValues['role'], string> = {
  Doctor: 'doctor',
  Nurse: 'nurse',
  Pharmacist: 'pharmacist',
  Administrator: 'admin',
  Patient: 'patient',
  '': '',
};

/**
 * One shared box for every control in the wizard -- text inputs and dropdowns
 * alike -- so they all share the same height and the same inner padding and
 * cannot drift apart. `pl-10` clears the leading icon every field carries; the
 * password fields append `pr-10` to clear the reveal toggle.
 */
const fieldBox = 'h-11 w-full py-2 pl-10 pr-3 text-sm';

export default function RegisterPage() {
  const [step, setStep] = useState(1);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [serverError, setServerError] = useState('');
  const [success, setSuccess] = useState(false);
  const navigate = useNavigate();
  const { login } = useAuth();
  const reduceMotion = useReducedMotion();

  const {
    register,
    handleSubmit,
    watch,
    trigger,
    formState: { errors },
  } = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      firstName: '',
      lastName: '',
      email: '',
      confirmEmail: '',
      role: '',
      hospital: '',
      department: '',
      password: '',
      confirmPassword: '',
      agreedToTerms: false,
    },
  });

  const passwordValue = watch('password') || '';

  const stepDetails = [
    { title: 'Your identity', description: 'Tell us how your team can identify you.' },
    { title: 'Your organization', description: 'Connect your profile to the right care setting.' },
    { title: 'Secure your account', description: 'Create credentials for your protected workspace.' },
  ];
  const activeStep = stepDetails[step - 1];

  const continueToNextStep = async () => {
    const fields = step === 1
      ? ['firstName', 'lastName', 'email', 'confirmEmail'] as const
      : ['role', 'hospital', 'department'] as const;
    const valid = await trigger(fields);

    if (valid) {
      setStep((currentStep) => Math.min(currentStep + 1, stepDetails.length));
    }
  };

  const onSubmit = async (data: RegisterFormValues) => {
    setServerError('');
    setLoading(true);
    try {
      await api.register({
        name: `${data.firstName} ${data.lastName}`.trim(),
        email: data.email.trim(),
        password: data.password,
        roleId: roleApiValues[data.role],
        hospital: data.hospital,
        department: data.department,
      });
      setSuccess(true);

      setTimeout(async () => {
        try {
          const res = await login(data.email.trim(), data.password);
          if (res.requiresMfa) {
            navigate('/auth/two-factor');
            return;
          }
          navigate(postAuthRoute(res.user));
        } catch {
          navigate('/auth/login');
        }
      }, 1500);
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : 'Registration failed. Please try again.';
      setServerError(errMsg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      showBranding={false}
      formPanelClassName="lg:w-[680px] xl:w-[760px] 2xl:w-[840px] bg-transparent"
      contentClassName="lg:max-w-[620px] xl:max-w-[680px]"
    >
      <div className="space-y-5 sm:space-y-6">
        <Card className="overflow-hidden border border-border bg-card shadow-xl shadow-primary/5">
          {/* Header */}
          <motion.div
            className="px-5 text-center sm:px-6 lg:text-left"
            initial={reduceMotion ? false : { opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
          >
            <div className="flex items-center justify-center lg:justify-start">
              <Logo size="md" />
            </div>
            <h1 className="mt-5 font-display text-3xl font-medium tracking-tight text-foreground sm:text-[2rem]">
              Build your clinical workspace.
            </h1>
            <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-muted-foreground lg:mx-0">
              Set up a verified profile for secure access to your care team’s operations.
            </p>
          </motion.div>

          <CardHeader className="space-y-0 border-b border-border bg-muted/30 px-5 py-4 sm:px-6">
            <div>
              <span className="mb-1 block font-mono text-[0.6875rem] font-semibold tabular-nums text-accent">
                {String(step).padStart(2, '0')} / 03
              </span>
              <CardTitle className="text-base font-semibold uppercase">{activeStep.title}</CardTitle>
              <CardDescription className="mt-0.5 text-xs text-muted-foreground">
                {activeStep.description}
              </CardDescription>
            </div>
          </CardHeader>

          <CardContent className="px-5 py-5 sm:px-6 sm:py-6">
            {/* Error Alert */}
            <AnimatePresence>
              {serverError && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="mb-5 p-3 rounded-lg bg-destructive/15 border border-destructive/30 flex items-start gap-2.5 text-destructive text-xs"
                  role="alert"
                  aria-live="assertive"
                >
                  <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" aria-hidden="true" />
                  <span className="font-medium">{serverError}</span>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Success State */}
            <AnimatePresence mode="wait">
              {success ? (
                <motion.div
                  key="success"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="py-8 text-center space-y-4"
                >
                  <motion.div
                    className="h-16 w-16 rounded-full bg-success/15 border border-success/30 text-success flex items-center justify-center mx-auto"
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: 'spring', stiffness: 200, damping: 15 }}
                  >
                    <CheckCircle2 className="h-9 w-9" aria-hidden="true" />
                  </motion.div>
                  <div className="space-y-1">
                    <h3 className="text-lg font-semibold text-foreground">Registration Successful!</h3>
                    <p className="text-sm text-muted-foreground">
                      Your account has been provisioned. Redirecting to your workstation...
                    </p>
                  </div>
                  <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                    Establishing your secure session...
                  </div>
                </motion.div>
              ) : (
                <motion.form
                  key="form"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  onSubmit={(event) => {
                    if (step < stepDetails.length) {
                      event.preventDefault();
                      void continueToNextStep();
                      return;
                    }
                    void handleSubmit(onSubmit)(event);
                  }}
                  className="space-y-5"
                  noValidate
                >
                  <div className="flex gap-1" aria-label={`Step ${step} of ${stepDetails.length}`} role="progressbar" aria-valuemin={1} aria-valuemax={stepDetails.length} aria-valuenow={step} aria-valuetext={`Step ${step} of ${stepDetails.length}`}>
                    {stepDetails.map((stepDetail, index) => (
                      <span key={stepDetail.title} className={`h-1 flex-1 rounded-full ${index < step ? 'bg-accent' : 'bg-border'}`} />
                    ))}
                  </div>

                  <AnimatePresence mode="wait" initial={false}>
                  {step === 1 && (
                  <motion.div
                    key="identity"
                    initial={reduceMotion ? false : { opacity: 0, x: 12 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={reduceMotion ? undefined : { opacity: 0, x: -12 }}
                    className="space-y-5"
                  >
                  <div className="flex items-center gap-3" aria-hidden="true">
                    <span className="h-px flex-1 bg-border" />
                    <span className="text-[0.6875rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Identity</span>
                    <span className="h-px flex-1 bg-border" />
                  </div>

                  {/* Name */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="firstName" className="sr-only">First name</Label>
                      <div className="relative">
                        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                          <User className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                        </div>
                        <Input
                          id="firstName"
                          type="text"
                          placeholder="First name"
                          {...register('firstName')}
                          autoComplete="given-name"
                          className={`${fieldBox} bg-background border-border focus-visible:ring-accent transition-all duration-200 ${
                            errors.firstName ? 'border-destructive focus-visible:ring-destructive' : ''
                          }`}
                          aria-invalid={errors.firstName ? 'true' : 'false'}
                          aria-describedby={errors.firstName ? 'firstName-error' : undefined}
                        />
                      </div>
                      {errors.firstName && (
                        <p className="text-xs text-destructive font-medium flex items-center gap-1" id="firstName-error" role="alert">
                          <AlertCircle className="h-3 w-3" aria-hidden="true" />
                          {errors.firstName.message}
                        </p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="lastName" className="sr-only">Last name</Label>
                      <div className="relative">
                        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                          <User className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                        </div>
                        <Input
                          id="lastName"
                          type="text"
                          placeholder="Last name"
                          {...register('lastName')}
                          autoComplete="family-name"
                          className={`${fieldBox} bg-background border-border focus-visible:ring-accent transition-all duration-200 ${
                            errors.lastName ? 'border-destructive focus-visible:ring-destructive' : ''
                          }`}
                          aria-invalid={errors.lastName ? 'true' : 'false'}
                          aria-describedby={errors.lastName ? 'lastName-error' : undefined}
                        />
                      </div>
                      {errors.lastName && (
                        <p className="text-xs text-destructive font-medium flex items-center gap-1" id="lastName-error" role="alert">
                          <AlertCircle className="h-3 w-3" aria-hidden="true" />
                          {errors.lastName.message}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Email */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="email" className="sr-only">Work email</Label>
                      <div className="relative">
                        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                          <Mail className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                        </div>
                        <Input
                          id="email"
                          type="email"
                          placeholder="Work email"
                          {...register('email')}
                          autoComplete="email"
                          className={`${fieldBox} bg-background border-border focus-visible:ring-accent transition-all duration-200 ${
                            errors.email ? 'border-destructive focus-visible:ring-destructive' : ''
                          }`}
                          aria-invalid={errors.email ? 'true' : 'false'}
                          aria-describedby={errors.email ? 'email-error' : undefined}
                        />
                      </div>
                      {errors.email && (
                        <p className="text-xs text-destructive font-medium flex items-center gap-1" id="email-error" role="alert">
                          <AlertCircle className="h-3 w-3" aria-hidden="true" />
                          {errors.email.message}
                        </p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="confirmEmail" className="sr-only">Confirm email</Label>
                      <div className="relative">
                        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                          <Mail className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                        </div>
                        <Input
                          id="confirmEmail"
                          type="email"
                          placeholder="Confirm email"
                          {...register('confirmEmail')}
                          autoComplete="email"
                          className={`${fieldBox} bg-background border-border focus-visible:ring-accent transition-all duration-200 ${
                            errors.confirmEmail ? 'border-destructive focus-visible:ring-destructive' : ''
                          }`}
                          aria-invalid={errors.confirmEmail ? 'true' : 'false'}
                          aria-describedby={errors.confirmEmail ? 'confirmEmail-error' : undefined}
                        />
                      </div>
                      {errors.confirmEmail && (
                        <p className="text-xs text-destructive font-medium flex items-center gap-1" id="confirmEmail-error" role="alert">
                          <AlertCircle className="h-3 w-3" aria-hidden="true" />
                          {errors.confirmEmail.message}
                        </p>
                      )}
                    </div>
                  </div>
                  </motion.div>
                  )}

                  {step === 2 && (
                  <motion.div
                    key="organization"
                    initial={reduceMotion ? false : { opacity: 0, x: 12 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={reduceMotion ? undefined : { opacity: 0, x: -12 }}
                    className="space-y-5"
                  >
                  <div className="flex items-center gap-3" aria-hidden="true">
                    <span className="h-px flex-1 bg-border" />
                    <span className="text-[0.6875rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Organization</span>
                    <span className="h-px flex-1 bg-border" />
                  </div>

                  {/* Role & Hospital */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="role" className="sr-only">Clinical / system role</Label>
                      <div className="relative">
                        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                          <Stethoscope className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                        </div>
                        <select
                          id="role"
                          {...register('role')}
                          className={`${fieldBox} rounded-md border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-accent transition-all duration-200`}
                          aria-invalid={errors.role ? 'true' : 'false'}
                          aria-describedby={errors.role ? 'role-error' : undefined}
                        >
                          <option value="" disabled>
                            Select your role…
                          </option>
                          <option value="Doctor">Doctor / Physician</option>
                          <option value="Nurse">Registered Nurse</option>
                          <option value="Pharmacist">Pharmacist</option>
                          <option value="Administrator">Hospital Administrator</option>
                          <option value="Patient">Patient (Self-Service)</option>
                        </select>
                      </div>
                      {errors.role && (
                        <p className="text-xs text-destructive font-medium flex items-center gap-1" id="role-error" role="alert">
                          <AlertCircle className="h-3 w-3" aria-hidden="true" />
                          {errors.role.message}
                        </p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="hospital" className="sr-only">Hospital facility</Label>
                      <div className="relative">
                        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                          <Building2 className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                        </div>
                        <select
                          id="hospital"
                          {...register('hospital')}
                          className={`${fieldBox} rounded-md border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-accent transition-all duration-200`}
                          aria-invalid={errors.hospital ? 'true' : 'false'}
                          aria-describedby={errors.hospital ? 'hospital-error' : undefined}
                        >
                          <option value="" disabled>
                            Select hospital facility…
                          </option>
                          <option value="General Hospital">General Hospital (HOSP-001)</option>
                          <option value="Ridge Regional Hospital">Ridge Regional Hospital (HOSP-002)</option>
                          <option value="Central Children's Hospital">Central Children's Hospital (HOSP-003)</option>
                        </select>
                      </div>
                      {errors.hospital && (
                        <p className="text-xs text-destructive font-medium flex items-center gap-1" id="hospital-error" role="alert">
                          <AlertCircle className="h-3 w-3" aria-hidden="true" />
                          {errors.hospital.message}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Department Selection */}
                  <div className="space-y-2">
                    <Label htmlFor="department" className="sr-only">Department / specialty unit</Label>
                    <div className="relative">
                      <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                        <Layers className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                      </div>
                      <select
                        id="department"
                        {...register('department')}
                        className={`${fieldBox} rounded-md border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-accent transition-all duration-200`}
                        aria-invalid={errors.department ? 'true' : 'false'}
                        aria-describedby={errors.department ? 'department-error' : undefined}
                      >
                        <option value="" disabled>
                          Select department / specialty unit…
                        </option>
                        <option value="Cardiology">Cardiology & Cardiovascular Care</option>
                        <option value="Emergency">Emergency & Acute Trauma</option>
                        <option value="Orthopedics">Orthopedics & Joint Surgery</option>
                        <option value="Pediatrics">Pediatrics & Neonatal Care</option>
                        <option value="Pharmacy">Pharmacy & Dispensary Services</option>
                        <option value="Radiology">Radiology & Diagnostic Imaging</option>
                        <option value="Administration">Hospital Operations & Finance</option>
                      </select>
                    </div>
                    {errors.department && (
                      <p className="text-xs text-destructive font-medium flex items-center gap-1" id="department-error" role="alert">
                        <AlertCircle className="h-3 w-3" aria-hidden="true" />
                        {errors.department.message}
                      </p>
                    )}
                  </div>
                  </motion.div>
                  )}

                  {step === 3 && (
                  <motion.div
                    key="security"
                    initial={reduceMotion ? false : { opacity: 0, x: 12 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={reduceMotion ? undefined : { opacity: 0, x: -12 }}
                    className="space-y-5"
                  >
                  <div className="flex items-center gap-3" aria-hidden="true">
                    <span className="h-px flex-1 bg-border" />
                    <span className="text-[0.6875rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Secure your account</span>
                    <span className="h-px flex-1 bg-border" />
                  </div>

                  {/* Password & Confirm Password */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="password" className="sr-only">Create password</Label>
                      <div className="relative">
                        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                          <Lock className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                        </div>
                        <Input
                          id="password"
                          type={showPassword ? 'text' : 'password'}
                          placeholder="Create password"
                          {...register('password')}
                          autoComplete="new-password"
                          className={`${fieldBox} pr-10 bg-background border-border focus-visible:ring-accent transition-all duration-200 ${
                            errors.password ? 'border-destructive focus-visible:ring-destructive' : ''
                          }`}
                          aria-invalid={errors.password ? 'true' : 'false'}
                          aria-describedby={errors.password ? 'password-error' : undefined}
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                          aria-label={showPassword ? 'Hide password' : 'Show password'}
                        >
                          {showPassword ? <EyeOff className="h-4 w-4" aria-hidden="true" /> : <Eye className="h-4 w-4" aria-hidden="true" />}
                        </button>
                      </div>
                      {errors.password && (
                        <p className="text-xs text-destructive font-medium flex items-center gap-1" id="password-error" role="alert">
                          <AlertCircle className="h-3 w-3" aria-hidden="true" />
                          {errors.password.message}
                        </p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="confirmPassword" className="sr-only">Confirm password</Label>
                      <div className="relative">
                        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                          <Lock className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                        </div>
                        <Input
                          id="confirmPassword"
                          type={showConfirmPassword ? 'text' : 'password'}
                          placeholder="Confirm password"
                          {...register('confirmPassword')}
                          autoComplete="new-password"
                          className={`${fieldBox} pr-10 bg-background border-border focus-visible:ring-accent transition-all duration-200 ${
                            errors.confirmPassword ? 'border-destructive focus-visible:ring-destructive' : ''
                          }`}
                          aria-invalid={errors.confirmPassword ? 'true' : 'false'}
                          aria-describedby={errors.confirmPassword ? 'confirmPassword-error' : undefined}
                        />
                        <button
                          type="button"
                          onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                          aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                        >
                          {showConfirmPassword ? <EyeOff className="h-4 w-4" aria-hidden="true" /> : <Eye className="h-4 w-4" aria-hidden="true" />}
                        </button>
                      </div>
                      {errors.confirmPassword && (
                        <p className="text-xs text-destructive font-medium flex items-center gap-1" id="confirmPassword-error" role="alert">
                          <AlertCircle className="h-3 w-3" aria-hidden="true" />
                          {errors.confirmPassword.message}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Password Strength Meter */}
                  <PasswordStrength password={passwordValue} />

                  {/* Terms and compliance */}
                  <div className="space-y-2">
                    <div className="flex items-start gap-3 pt-1">
                      <input
                        id="terms"
                        type="checkbox"
                        {...register('agreedToTerms')}
                        className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer rounded border-border text-accent transition-colors focus:ring-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                      />
                      <Label
                        htmlFor="terms"
                        className="block min-w-0 flex-1 cursor-pointer text-xs leading-5 font-normal text-muted-foreground"
                      >
                        I acknowledge that I am an authorized healthcare professional and agree to uphold all{' '}
                        <span className="font-medium text-accent underline underline-offset-2">HIPAA Privacy Protections</span>, patient confidentiality protocols, and institutional security guidelines.
                      </Label>
                    </div>
                    {errors.agreedToTerms && (
                      <p className="text-xs text-destructive font-medium flex items-center gap-1 pl-7" id="terms-error" role="alert">
                        <AlertCircle className="h-3 w-3" aria-hidden="true" />
                        {errors.agreedToTerms.message}
                      </p>
                    )}
                  </div>
                  </motion.div>
                  )}
                  </AnimatePresence>

                  <div className="flex items-center gap-3">
                    {step > 1 && (
                      <Button type="button" variant="outline" className="h-11 px-5" onClick={() => setStep((currentStep) => currentStep - 1)} disabled={loading}>
                        Back
                      </Button>
                    )}
                    <Button type="submit" className="group h-12 flex-1 rounded-lg border border-accent bg-accent text-sm font-semibold text-accent-foreground shadow-lg shadow-accent/30 transition-all duration-200 hover:-translate-y-0.5 hover:bg-accent/90 hover:text-accent-foreground hover:shadow-xl hover:shadow-accent/40 active:translate-y-0" disabled={loading}>
                    {loading ? (
                      <span className="flex items-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                        Provisioning Account...
                      </span>
                    ) : step < stepDetails.length ? (
                      <span className="flex items-center justify-center gap-2">
                        {step === 1 ? 'Proceed to organization' : 'Proceed to account security'}
                        <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-1" aria-hidden="true" />
                      </span>
                    ) : (
                      <span className="flex items-center justify-center gap-2">
                        Complete secure registration
                        <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5" aria-hidden="true" />
                      </span>
                    )}
                  </Button>
                  </div>
                </motion.form>
              )}
            </AnimatePresence>
          </CardContent>

          <CardFooter className="flex flex-col gap-3 border-t border-border bg-muted/20 px-5 py-4 text-xs text-muted-foreground sm:px-6">
            <div className="flex flex-col items-center justify-between gap-2 text-center sm:flex-row sm:text-left">
              <span>Already have hospital credentials?</span>
              <Button variant="outline" size="sm" asChild className="group h-8 border-accent/40 bg-background px-3 font-semibold text-accent hover:border-accent">
                <Link to="/auth/login">
                  Sign-in
                  <LogIn className="h-3.5 w-3.5 transition-transform duration-200 group-hover:translate-x-0.5" aria-hidden="true" />
                </Link>
              </Button>
            </div>
            <div className="flex items-center justify-center gap-1.5 border-t border-border pt-3 text-[0.6875rem] font-semibold uppercase tracking-[0.13em] text-muted-foreground sm:justify-start">
              <ShieldCheck className="h-3.5 w-3.5 text-success" aria-hidden="true" />
              Secure enrollment · protected workspace access
            </div>
          </CardFooter>
        </Card>
      </div>
    </AuthLayout>
  );
}
