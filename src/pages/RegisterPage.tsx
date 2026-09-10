import { useState, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/services/api';
import { AuthLayout } from '@/components/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Activity,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
  Building2,
  User,
  Mail,
  Lock,
  ArrowRight,
  Stethoscope,
  Loader2,
} from 'lucide-react';

const registerSchema = z
  .object({
    name: z.string().min(2, 'Full name must be at least 2 characters'),
    email: z
      .string()
      .min(1, 'Email address is required')
      .email('Please enter a valid work email address'),
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
  });

type RegisterFormValues = z.infer<typeof registerSchema>;

const strengthLabels = ['Very Weak', 'Weak', 'Moderate', 'Strong', 'Excellent'];
const strengthColors = ['bg-destructive', 'bg-orange-500', 'bg-yellow-500', 'bg-emerald-500', 'bg-emerald-600'];

export default function RegisterPage() {
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [serverError, setServerError] = useState('');
  const [success, setSuccess] = useState(false);
  const navigate = useNavigate();
  const { login } = useAuth();

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      name: '',
      email: '',
      role: 'Doctor',
      hospital: 'General Hospital',
      department: 'Cardiology',
      password: '',
      confirmPassword: '',
      agreedToTerms: false,
    },
  });

  const passwordValue = watch('password') || '';

  const strength = useMemo(() => {
    const length = passwordValue.length >= 8;
    const upper = /[A-Z]/.test(passwordValue);
    const lower = /[a-z]/.test(passwordValue);
    const number = /[0-9]/.test(passwordValue);
    const special = /[^A-Za-z0-9]/.test(passwordValue);
    const score = [length, upper, lower, number, special].filter(Boolean).length;
    return { length, upper, lower, number, special, score };
  }, [passwordValue]);

  const onSubmit = async (data: RegisterFormValues) => {
    setServerError('');
    setLoading(true);
    try {
      await api.register({
        name: data.name,
        email: data.email,
        password: data.password,
        roleId: data.role.toLowerCase(),
      });
      setSuccess(true);

      setTimeout(async () => {
        try {
          await login(data.email, data.password);
          navigate('/dashboard');
        } catch {
          navigate('/login');
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
    <AuthLayout>
      <div className="space-y-6">
        {/* Header */}
        <motion.div
          className="flex flex-col items-center lg:items-start text-center lg:text-left"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <div className="flex items-center gap-3 mb-4">
            <motion.div
              className="h-11 w-11 rounded-xl bg-primary flex items-center justify-center shadow-lg shadow-primary/20"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <Activity className="h-5 w-5 text-primary-foreground" aria-hidden="true" />
            </motion.div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Smart Health</h1>
          </div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground mb-1">Staff Registration</h2>
          <p className="text-sm text-muted-foreground">Create your verified healthcare provider profile</p>
        </motion.div>

        <Card className="border border-border bg-card shadow-lg shadow-border/50">
          <CardHeader className="space-y-1 pb-4 border-b border-border">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg font-semibold">Clinical Onboarding</CardTitle>
                <CardDescription className="text-xs text-muted-foreground mt-0.5">
                  Complete your professional profile below
                </CardDescription>
              </div>
              <Badge variant="outline" className="text-xs border-accent/40 text-accent font-medium flex items-center gap-1">
                <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
                HIPAA Verified
              </Badge>
            </div>
          </CardHeader>

          <CardContent className="pt-6">
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
                    className="h-16 w-16 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-500 flex items-center justify-center mx-auto"
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: 'spring', stiffness: 200, damping: 15 }}
                  >
                    <CheckCircle2 className="h-9 w-9" aria-hidden="true" />
                  </motion.div>
                  <div className="space-y-1">
                    <h3 className="text-lg font-semibold text-foreground">Registration Successful!</h3>
                    <p className="text-sm text-muted-foreground">
                      Your account has been provisioned. Redirecting to your dashboard...
                    </p>
                  </div>
                  <div className="pt-2">
                    <Button onClick={() => navigate('/login')} className="gap-2 bg-accent text-accent-foreground">
                      Proceed to Login <ArrowRight className="h-4 w-4" aria-hidden="true" />
                    </Button>
                  </div>
                </motion.div>
              ) : (
                <motion.form
                  key="form"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  onSubmit={handleSubmit(onSubmit)}
                  className="space-y-5"
                  noValidate
                >
                  {/* Name & Email */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="name" className="text-xs font-medium text-foreground flex items-center gap-1.5">
                        <User className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
                        Full Name
                      </Label>
                      <Input
                        id="name"
                        type="text"
                        placeholder="e.g. Dr. Kwame Mensah"
                        {...register('name')}
                        className={`h-10 text-sm bg-background border-border transition-all duration-200 ${
                          errors.name ? 'border-destructive focus-visible:ring-destructive' : ''
                        }`}
                        aria-invalid={errors.name ? 'true' : 'false'}
                        aria-describedby={errors.name ? 'name-error' : undefined}
                      />
                      {errors.name && (
                        <p className="text-xs text-destructive font-medium flex items-center gap-1" id="name-error" role="alert">
                          <AlertCircle className="h-3 w-3" aria-hidden="true" />
                          {errors.name.message}
                        </p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="email" className="text-xs font-medium text-foreground flex items-center gap-1.5">
                        <Mail className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
                        Work Email
                      </Label>
                      <Input
                        id="email"
                        type="email"
                        placeholder="k.mensah@smarthealth.com"
                        {...register('email')}
                        className={`h-10 text-sm bg-background border-border transition-all duration-200 ${
                          errors.email ? 'border-destructive focus-visible:ring-destructive' : ''
                        }`}
                        aria-invalid={errors.email ? 'true' : 'false'}
                        aria-describedby={errors.email ? 'email-error' : undefined}
                      />
                      {errors.email && (
                        <p className="text-xs text-destructive font-medium flex items-center gap-1" id="email-error" role="alert">
                          <AlertCircle className="h-3 w-3" aria-hidden="true" />
                          {errors.email.message}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Role & Hospital */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="role" className="text-xs font-medium text-foreground flex items-center gap-1.5">
                        <Stethoscope className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
                        Clinical / System Role
                      </Label>
                      <select
                        id="role"
                        {...register('role')}
                        className="h-10 w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-accent transition-all duration-200"
                        aria-invalid={errors.role ? 'true' : 'false'}
                        aria-describedby={errors.role ? 'role-error' : undefined}
                      >
                        <option value="Doctor">Doctor / Physician</option>
                        <option value="Nurse">Registered Nurse</option>
                        <option value="Pharmacist">Pharmacist</option>
                        <option value="Administrator">Hospital Administrator</option>
                        <option value="Patient">Patient (Self-Service)</option>
                      </select>
                      {errors.role && (
                        <p className="text-xs text-destructive font-medium flex items-center gap-1" id="role-error" role="alert">
                          <AlertCircle className="h-3 w-3" aria-hidden="true" />
                          {errors.role.message}
                        </p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="hospital" className="text-xs font-medium text-foreground flex items-center gap-1.5">
                        <Building2 className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
                        Hospital Facility
                      </Label>
                      <select
                        id="hospital"
                        {...register('hospital')}
                        className="h-10 w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-accent transition-all duration-200"
                        aria-invalid={errors.hospital ? 'true' : 'false'}
                        aria-describedby={errors.hospital ? 'hospital-error' : undefined}
                      >
                        <option value="General Hospital">General Hospital (HOSP-001)</option>
                        <option value="Ridge Regional Hospital">Ridge Regional Hospital (HOSP-002)</option>
                        <option value="Central Children's Hospital">Central Children's Hospital (HOSP-003)</option>
                      </select>
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
                    <Label htmlFor="department" className="text-xs font-medium text-foreground">
                      Department / Specialty Unit
                    </Label>
                    <select
                      id="department"
                      {...register('department')}
                      className="h-10 w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-accent transition-all duration-200"
                      aria-invalid={errors.department ? 'true' : 'false'}
                      aria-describedby={errors.department ? 'department-error' : undefined}
                    >
                      <option value="Cardiology">Cardiology & Cardiovascular Care</option>
                      <option value="Emergency">Emergency & Acute Trauma</option>
                      <option value="Orthopedics">Orthopedics & Joint Surgery</option>
                      <option value="Pediatrics">Pediatrics & Neonatal Care</option>
                      <option value="Pharmacy">Pharmacy & Dispensary Services</option>
                      <option value="Radiology">Radiology & Diagnostic Imaging</option>
                      <option value="Administration">Hospital Operations & Finance</option>
                    </select>
                    {errors.department && (
                      <p className="text-xs text-destructive font-medium flex items-center gap-1" id="department-error" role="alert">
                        <AlertCircle className="h-3 w-3" aria-hidden="true" />
                        {errors.department.message}
                      </p>
                    )}
                  </div>

                  {/* Password & Confirm Password */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="password" className="text-xs font-medium text-foreground flex items-center gap-1.5">
                        <Lock className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
                        Create Password
                      </Label>
                      <div className="relative">
                        <Input
                          id="password"
                          type={showPassword ? 'text' : 'password'}
                          placeholder="••••••••"
                          {...register('password')}
                          className={`h-10 pr-10 text-sm bg-background border-border transition-all duration-200 ${
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
                      <Label htmlFor="confirmPassword" className="text-xs font-medium text-foreground flex items-center gap-1.5">
                        <Lock className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
                        Confirm Password
                      </Label>
                      <div className="relative">
                        <Input
                          id="confirmPassword"
                          type={showConfirmPassword ? 'text' : 'password'}
                          placeholder="••••••••"
                          {...register('confirmPassword')}
                          className={`h-10 pr-10 text-sm bg-background border-border transition-all duration-200 ${
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
                  <AnimatePresence>
                    {passwordValue.length > 0 && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="p-4 rounded-xl bg-muted/40 border border-border text-xs space-y-3"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground font-medium">Password Complexity</span>
                          <span className="font-semibold text-foreground">
                            {strengthLabels[Math.max(0, strength.score - 1)]}
                          </span>
                        </div>

                        {/* Strength Bar */}
                        <div className="h-1.5 bg-border rounded-full overflow-hidden">
                          <motion.div
                            className={`h-full ${strengthColors[Math.max(0, strength.score - 1)]}`}
                            initial={{ width: 0 }}
                            animate={{ width: `${(strength.score / 5) * 100}%` }}
                            transition={{ duration: 0.3 }}
                          />
                        </div>

                        {/* Requirements */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
                          {[
                            { label: '8+ Characters', met: strength.length },
                            { label: 'Upper & Lower', met: strength.upper && strength.lower },
                            { label: 'Numbers (0-9)', met: strength.number },
                            { label: 'Special Symbol', met: strength.special },
                          ].map((req, i) => (
                            <motion.div
                              key={i}
                              className={`flex items-center gap-1.5 ${req.met ? 'text-emerald-500' : 'text-muted-foreground'}`}
                              animate={{ scale: req.met ? 1.05 : 1 }}
                              transition={{ duration: 0.2 }}
                            >
                              <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                              <span>{req.label}</span>
                            </motion.div>
                          ))}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Terms and compliance */}
                  <div className="space-y-2">
                    <div className="flex items-start gap-3 pt-1">
                      <input
                        id="terms"
                        type="checkbox"
                        {...register('agreedToTerms')}
                        className="mt-1 h-4 w-4 rounded border-border text-accent focus:ring-accent cursor-pointer transition-colors"
                      />
                      <Label htmlFor="terms" className="text-xs text-muted-foreground leading-relaxed cursor-pointer">
                        I acknowledge that I am an authorized healthcare professional and agree to uphold all{' '}
                        <span className="text-accent underline font-medium">HIPAA Privacy Protections</span>, patient confidentiality protocols, and institutional security guidelines.
                      </Label>
                    </div>
                    {errors.agreedToTerms && (
                      <p className="text-xs text-destructive font-medium flex items-center gap-1 pl-7" id="terms-error" role="alert">
                        <AlertCircle className="h-3 w-3" aria-hidden="true" />
                        {errors.agreedToTerms.message}
                      </p>
                    )}
                  </div>

                  <Button
                    type="submit"
                    className="w-full h-11 text-sm font-semibold bg-accent text-accent-foreground hover:bg-accent/90 transition-all duration-200 shadow-lg shadow-accent/20 hover:shadow-xl hover:shadow-accent/30"
                    disabled={loading}
                  >
                    {loading ? (
                      <span className="flex items-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                        Provisioning Account...
                      </span>
                    ) : (
                      'Complete Staff Registration'
                    )}
                  </Button>
                </motion.form>
              )}
            </AnimatePresence>
          </CardContent>

          <CardFooter className="flex flex-col sm:flex-row items-center justify-between border-t border-border pt-4 text-xs text-muted-foreground gap-2">
            <span>Already registered with the hospital?</span>
            <Link to="/login" className="text-accent hover:text-accent/80 hover:underline font-medium transition-colors">
              Back to Sign In
            </Link>
          </CardFooter>
        </Card>
      </div>
    </AuthLayout>
  );
}
