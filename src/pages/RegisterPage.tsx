import { useState, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/services/api';
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

  // Password strength calculation
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

      // Automatically sign in after 1.5s
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
    <div className="min-h-screen flex items-center justify-center p-4 bg-background text-foreground py-10">
      <div className="w-full max-w-2xl">
        {/* Top Branding */}
        <div className="flex flex-col items-center justify-center text-center mb-6">
          <div className="h-14 w-14 rounded-2xl bg-accent/15 border border-accent/30 flex items-center justify-center mb-3">
            <Activity className="h-8 w-8 text-accent" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Smart Health Manager</h1>
          <p className="text-sm text-muted-foreground mt-1">Clinical & Administrative Staff Onboarding</p>
        </div>

        <Card className="border border-border bg-card shadow-md">
          <CardHeader className="space-y-1 pb-4 border-b border-border">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-xl font-semibold">Staff Registration</CardTitle>
                <CardDescription className="text-xs text-muted-foreground mt-0.5">
                  Create your verified healthcare provider profile
                </CardDescription>
              </div>
              <Badge variant="outline" className="text-xs border-accent/40 text-accent font-medium flex items-center gap-1">
                <ShieldCheck className="h-3.5 w-3.5" />
                HIPAA Verified
              </Badge>
            </div>
          </CardHeader>

          <CardContent className="pt-6">
            {serverError && (
              <div className="mb-5 p-3 rounded-lg bg-destructive/15 border border-destructive/30 flex items-start gap-2.5 text-destructive text-xs">
                <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                <span className="font-medium">{serverError}</span>
              </div>
            )}

            {success ? (
              <div className="py-8 text-center space-y-4">
                <div className="h-16 w-16 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-500 flex items-center justify-center mx-auto">
                  <CheckCircle2 className="h-9 w-9" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-lg font-semibold text-foreground">Registration Successful!</h3>
                  <p className="text-sm text-muted-foreground">
                    Your account has been provisioned. Redirecting to your dashboard...
                  </p>
                </div>
                <div className="pt-2">
                  <Button onClick={() => navigate('/login')} className="gap-2 bg-accent text-accent-foreground">
                    Proceed to Login <ArrowRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
                {/* Name & Email */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="name" className="text-xs font-medium text-foreground flex items-center gap-1.5">
                      <User className="h-3.5 w-3.5 text-muted-foreground" />
                      Full Name
                    </Label>
                    <Input
                      id="name"
                      type="text"
                      placeholder="e.g. Dr. Kwame Mensah"
                      {...register('name')}
                      className={`h-10 text-sm bg-background border-border ${
                        errors.name ? 'border-destructive focus-visible:ring-destructive' : ''
                      }`}
                    />
                    {errors.name && (
                      <p className="text-xs text-destructive font-medium flex items-center gap-1">
                        <AlertCircle className="h-3 w-3" />
                        {errors.name.message}
                      </p>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="email" className="text-xs font-medium text-foreground flex items-center gap-1.5">
                      <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                      Work Email
                    </Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="k.mensah@smarthealth.com"
                      {...register('email')}
                      className={`h-10 text-sm bg-background border-border ${
                        errors.email ? 'border-destructive focus-visible:ring-destructive' : ''
                      }`}
                    />
                    {errors.email && (
                      <p className="text-xs text-destructive font-medium flex items-center gap-1">
                        <AlertCircle className="h-3 w-3" />
                        {errors.email.message}
                      </p>
                    )}
                  </div>
                </div>

                {/* Role & Hospital */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="role" className="text-xs font-medium text-foreground flex items-center gap-1.5">
                      <Stethoscope className="h-3.5 w-3.5 text-muted-foreground" />
                      Clinical / System Role
                    </Label>
                    <select
                      id="role"
                      {...register('role')}
                      className="h-10 w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-accent"
                    >
                      <option value="Doctor">Doctor / Physician</option>
                      <option value="Nurse">Registered Nurse</option>
                      <option value="Pharmacist">Pharmacist</option>
                      <option value="Administrator">Hospital Administrator</option>
                      <option value="Patient">Patient (Self-Service)</option>
                    </select>
                    {errors.role && (
                      <p className="text-xs text-destructive font-medium flex items-center gap-1">
                        <AlertCircle className="h-3 w-3" />
                        {errors.role.message}
                      </p>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="hospital" className="text-xs font-medium text-foreground flex items-center gap-1.5">
                      <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                      Hospital Facility
                    </Label>
                    <select
                      id="hospital"
                      {...register('hospital')}
                      className="h-10 w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-accent"
                    >
                      <option value="General Hospital">General Hospital (HOSP-001)</option>
                      <option value="Ridge Regional Hospital">Ridge Regional Hospital (HOSP-002)</option>
                      <option value="Central Children's Hospital">Central Children's Hospital (HOSP-003)</option>
                    </select>
                    {errors.hospital && (
                      <p className="text-xs text-destructive font-medium flex items-center gap-1">
                        <AlertCircle className="h-3 w-3" />
                        {errors.hospital.message}
                      </p>
                    )}
                  </div>
                </div>

                {/* Department Selection */}
                <div className="space-y-1.5">
                  <Label htmlFor="department" className="text-xs font-medium text-foreground">
                    Department / Specialty Unit
                  </Label>
                  <select
                    id="department"
                    {...register('department')}
                    className="h-10 w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-accent"
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
                    <p className="text-xs text-destructive font-medium flex items-center gap-1">
                      <AlertCircle className="h-3 w-3" />
                      {errors.department.message}
                    </p>
                  )}
                </div>

                {/* Password & Confirm Password */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="password" className="text-xs font-medium text-foreground flex items-center gap-1.5">
                      <Lock className="h-3.5 w-3.5 text-muted-foreground" />
                      Create Password
                    </Label>
                    <div className="relative">
                      <Input
                        id="password"
                        type={showPassword ? 'text' : 'password'}
                        placeholder="••••••••"
                        {...register('password')}
                        className={`h-10 pr-10 text-sm bg-background border-border ${
                          errors.password ? 'border-destructive focus-visible:ring-destructive' : ''
                        }`}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                    {errors.password && (
                      <p className="text-xs text-destructive font-medium flex items-center gap-1">
                        <AlertCircle className="h-3 w-3" />
                        {errors.password.message}
                      </p>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="confirmPassword" className="text-xs font-medium text-foreground flex items-center gap-1.5">
                      <Lock className="h-3.5 w-3.5 text-muted-foreground" />
                      Confirm Password
                    </Label>
                    <div className="relative">
                      <Input
                        id="confirmPassword"
                        type={showConfirmPassword ? 'text' : 'password'}
                        placeholder="••••••••"
                        {...register('confirmPassword')}
                        className={`h-10 pr-10 text-sm bg-background border-border ${
                          errors.confirmPassword ? 'border-destructive focus-visible:ring-destructive' : ''
                        }`}
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      >
                        {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                    {errors.confirmPassword && (
                      <p className="text-xs text-destructive font-medium flex items-center gap-1">
                        <AlertCircle className="h-3 w-3" />
                        {errors.confirmPassword.message}
                      </p>
                    )}
                  </div>
                </div>

                {/* Password Strength Checklist */}
                {passwordValue.length > 0 && (
                  <div className="p-3 rounded-lg bg-muted/40 border border-border text-xs space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Password Complexity:</span>
                      <span className="font-semibold text-foreground">
                        {['Very Weak', 'Weak', 'Moderate', 'Strong', 'Excellent'][Math.max(0, strength.score - 1)]}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 pt-1">
                      <div className={`flex items-center gap-1 ${strength.length ? 'text-emerald-500' : 'text-muted-foreground'}`}>
                        <CheckCircle2 className="h-3 w-3" />
                        <span>8+ Characters</span>
                      </div>
                      <div className={`flex items-center gap-1 ${strength.upper && strength.lower ? 'text-emerald-500' : 'text-muted-foreground'}`}>
                        <CheckCircle2 className="h-3 w-3" />
                        <span>Upper & Lower</span>
                      </div>
                      <div className={`flex items-center gap-1 ${strength.number ? 'text-emerald-500' : 'text-muted-foreground'}`}>
                        <CheckCircle2 className="h-3 w-3" />
                        <span>Numbers (0-9)</span>
                      </div>
                      <div className={`flex items-center gap-1 ${strength.special ? 'text-emerald-500' : 'text-muted-foreground'}`}>
                        <CheckCircle2 className="h-3 w-3" />
                        <span>Special Symbol</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Terms and compliance */}
                <div className="space-y-1">
                  <div className="flex items-start gap-2 pt-1">
                    <input
                      id="terms"
                      type="checkbox"
                      {...register('agreedToTerms')}
                      className="mt-1 h-4 w-4 rounded border-border text-accent focus:ring-accent cursor-pointer"
                    />
                    <Label htmlFor="terms" className="text-xs text-muted-foreground leading-normal cursor-pointer">
                      I acknowledge that I am an authorized healthcare professional and agree to uphold all{' '}
                      <span className="text-accent underline font-medium">HIPAA Privacy Protections</span>, patient confidentiality protocols, and institutional security guidelines.
                    </Label>
                  </div>
                  {errors.agreedToTerms && (
                    <p className="text-xs text-destructive font-medium flex items-center gap-1 pl-6">
                      <AlertCircle className="h-3 w-3" />
                      {errors.agreedToTerms.message}
                    </p>
                  )}
                </div>

                <Button
                  type="submit"
                  className="w-full h-11 text-sm font-semibold bg-accent text-accent-foreground hover:bg-accent/90 transition-colors"
                  disabled={loading}
                >
                  {loading ? 'Provisioning Account...' : 'Complete Staff Registration'}
                </Button>
              </form>
            )}
          </CardContent>

          <CardFooter className="flex flex-col sm:flex-row items-center justify-between border-t border-border pt-4 text-xs text-muted-foreground gap-2">
            <span>Already registered with the hospital?</span>
            <Link to="/login" className="text-accent hover:underline font-medium">
              Back to Sign In
            </Link>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
