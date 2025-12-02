import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertCircle, Eye, EyeOff, Shield, Heart, Lock, Mail, User, UserPlus, CheckCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Logo } from '@/components/ui';
import { api } from '@/services/api';
import './RegisterPage.css';


export default function RegisterPage() {
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    confirmPassword: '',
    roleId: ''
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const navigate = useNavigate();

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const validatePassword = (password: string): { isValid: boolean; message: string } => {
    if (password.length < 8) {
      return { isValid: false, message: 'Password must be at least 8 characters long' };
    }
    if (!/[A-Z]/.test(password)) {
      return { isValid: false, message: 'Password must contain at least one uppercase letter' };
    }
    if (!/[a-z]/.test(password)) {
      return { isValid: false, message: 'Password must contain at least one lowercase letter' };
    }
    if (!/[0-9]/.test(password)) {
      return { isValid: false, message: 'Password must contain at least one number' };
    }
    if (!/[^A-Za-z0-9]/.test(password)) {
      return { isValid: false, message: 'Password must contain at least one special character' };
    }
    return { isValid: true, message: 'Password is strong' };
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    // Validation
    if (!formData.firstName.trim()) {
      setError('First name is required');
      setLoading(false);
      return;
    }

    if (!formData.lastName.trim()) {
      setError('Last name is required');
      setLoading(false);
      return;
    }

    if (!formData.email.trim()) {
      setError('Email is required');
      setLoading(false);
      return;
    }

    const passwordValidation = validatePassword(formData.password);
    if (!passwordValidation.isValid) {
      setError(passwordValidation.message);
      setLoading(false);
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      setLoading(false);
      return;
    }

    if (!formData.roleId) {
      setError('Please select a role');
      setLoading(false);
      return;
    }

    try {
      await api.register({
        name: `${formData.firstName.trim()} ${formData.lastName.trim()}`,
        email: formData.email.trim().toLowerCase(),
        password: formData.password,
        roleId: formData.roleId
      });

      setSuccess(true);
      setTimeout(() => {
        navigate('/login');
      }, 2000);

    } catch (error: any) {
      setError(error.message || 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="h-screen w-screen flex items-center  register-page ">
        {/* Success Message */}
        <div className="w-full max-w-md h-full flex flex-col justify-center p-8 pl-16 relative overflow-hidden">

          <Card className="w-full max-w-md shadow-2xl register-success-card">
          <CardContent className="pt-8 pb-8">
            <div className="text-center space-y-4">
              <div className="w-16 h-16 rounded-full flex items-center  mx-auto register-success-icon">
                <CheckCircle className="w-8 h-8 text-white" />
              </div>
              <div>
                <h2 className="text-xl font-bold mb-2 register-success-title">
                  Registration Successful!
                </h2>
                <p className="register-success-description">
                  Your account has been created successfully. You will be redirected to the login page shortly.
                </p>
              </div>
              <Button
                onClick={() => navigate('/login')}
                className="register-success-button"
              >
                Continue to Login
              </Button>
            </div>
          </CardContent>
        </Card>
        </div>

      </div>
    );
  }

  return (
    <div className="h-screen w-screen flex items-center  register-page ">
      {/* Registration Form */}
      <div className="w-full max-w-md flex items-center  p-8 relative overflow-hidden">
        {/* Background Pattern */}
        <div className="absolute inset-0 opacity-5">
          <div className="absolute inset-0 register-background-pattern" />
        </div>

        {/* Medical Cross Icon Background */}
        <div className="absolute top-10 right-10 opacity-10">
          <Heart className="w-32 h-32 register-heart-icon" />
        </div>
        <div className="absolute bottom-10 left-10 opacity-10">
          <UserPlus className="w-24 h-24 register-user-plus-icon" />
        </div>

        <Card className="w-full max-w-lg shadow-2xl relative z-10 register-card">
        <CardHeader className="space-y-6 pt-8 pb-8">
          {/* Hospital Branding */}
          <div className="flex flex-col items-center  gap-4">
            <div className="relative">
              <div className="w-16 h-16 rounded-full flex items-center  register-branding-icon">
                <Logo size="xl" variant="circle" className="w-12 h-12" />
              </div>
              <div className="absolute -top-1 -right-1 w-6 h-6 rounded-full flex items-center  register-branding-badge">
                <Shield className="w-3 h-3 text-white" />
              </div>
            </div>
            <div className="text-center">
              <h1 className="text-2xl font-bold register-title">
                Smart Health Manager
              </h1>
              <p className="text-sm mt-1 opacity-80 register-subtitle">
                Healthcare Management Portal
              </p>
            </div>
          </div>

          {/* Welcome Message */}
          <div className="text-center space-y-2">
            <CardTitle className="text-2xl font-bold register-title">
              Create Account
            </CardTitle>
            <CardDescription className="register-description">
              Join our healthcare management platform
            </CardDescription>
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Error Alert */}
          {error && (
            <Alert className="register-error-alert">
              <AlertCircle className="h-4 w-4 register-error-icon" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* First and Last Name Fields */}
            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-4">
                <div className="relative">
                  <User className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <Input
                    id="firstName"
                    type="text"
                    placeholder="First name"
                    value={formData.firstName}
                    onChange={(e) => handleInputChange('firstName', e.target.value)}
                    required
                    disabled={loading}
                    className="h-12 text-base pl-12 placeholder:text-gray-400 register-input"
                  />
                </div>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <Input
                    id="lastName"
                    type="text"
                    placeholder="Last name"
                    value={formData.lastName}
                    onChange={(e) => handleInputChange('lastName', e.target.value)}
                    required
                    disabled={loading}
                    className="h-12 text-base pl-12 placeholder:text-gray-400 register-input"
                  />
                </div>
              </div>
            </div>

            {/* Email Field */}
            <div className="space-y-2">
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                <Input
                  id="email"
                  type="email"
                  placeholder="your.email@hospital.com"
                  value={formData.email}
                  onChange={(e) => handleInputChange('email', e.target.value)}
                  required
                  disabled={loading}
                  className="h-12 text-base pl-12 placeholder:text-gray-400 register-input"
                />
              </div>
            </div>

            {/* Role Selection */}
            <div className="space-y-2">
              <Select
                value={formData.roleId}
                onValueChange={(value) => handleInputChange('roleId', value)}
                disabled={loading}
              >
                <div className="relative">
                  <Shield className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400 z-10" />
                  <SelectTrigger className="h-12 text-base pl-12 register-select-trigger">
                    <SelectValue placeholder="Choose your healthcare role" />
                  </SelectTrigger>
                </div>
                <SelectContent className="register-select-content">
                  <SelectItem value="doctor">Doctor</SelectItem>
                  <SelectItem value="nurse">Nurse</SelectItem>
                  <SelectItem value="admin">Administrator</SelectItem>
                  <SelectItem value="receptionist">Receptionist</SelectItem>
                  <SelectItem value="pharmacist">Pharmacist</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Password Fields */}
            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-4">
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Strong password"
                    value={formData.password}
                    onChange={(e) => handleInputChange('password', e.target.value)}
                    required
                    disabled={loading}
                    className="h-12 text-base pl-12 pr-12 placeholder:text-gray-400 register-input"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 p-1 rounded-md hover:bg-opacity-20 hover:bg-white transition-colors register-show-password"
                  >
                    {showPassword ? (
                      <EyeOff className="w-5 h-5" />
                    ) : (
                      <Eye className="w-5 h-5" />
                    )}
                  </button>
                </div>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <Input
                    id="confirmPassword"
                    type={showConfirmPassword ? "text" : "password"}
                    placeholder="Confirm password"
                    value={formData.confirmPassword}
                    onChange={(e) => handleInputChange('confirmPassword', e.target.value)}
                    required
                    disabled={loading}
                    className="h-12 text-base pl-12 pr-12 placeholder:text-gray-400 register-input"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 p-1 rounded-md hover:bg-opacity-20 hover:bg-white transition-colors register-show-password"
                  >
                    {showConfirmPassword ? (
                      <EyeOff className="w-5 h-5" />
                    ) : (
                      <Eye className="w-5 h-5" />
                    )}
                  </button>
                </div>
              </div>
              <p className="text-xs register-password-hint col-span-2">
                Password must be at least 8 characters with uppercase, lowercase, number, and special character.
              </p>
            </div>

            {/* Register Button */}
            <Button
              type="submit"
              disabled={loading}
              className="w-full h-12 text-base font-semibold transition-all duration-200 hover:scale-105 register-button"
            >
              {loading ? (
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
                  Creating Account...
                </div>
              ) : (
                <div className="flex items-center  gap-2">
                  <UserPlus className="w-5 h-5" />
                  Create Account
                </div>
              )}
            </Button>
          </form>
        </CardContent>

        <CardFooter className="pt-6 text-center register-footer-border">
          <div className="w-full space-y-2">
            <p className="text-sm register-links-text">
              Already have an account?{' '}
              <Link
                to="/login"
                className="hover:underline transition-colors font-medium register-login-link"
              >
                Sign In
              </Link>
            </p>
            <p className="text-sm w-full register-footer-text">
              Protected by enterprise-grade security •
              <span className="ml-1 font-medium register-hipaa-link">
                HIPAA Compliant
              </span>
            </p>
          </div>
        </CardFooter>
      </Card>
      </div>

    </div>
  );
}
