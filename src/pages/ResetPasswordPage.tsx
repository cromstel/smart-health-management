import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CheckCircle2, Heart, Shield, AlertCircle, Lock, Eye, EyeOff } from 'lucide-react';
import { Logo } from '@/components/ui';
import { api } from '@/services/api';
import './ResetPasswordPage.css';


export default function ResetPasswordPage() {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  const token = searchParams.get('token');

  if (user?.role === 'Super Admin') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-center text-destructive">Not Allowed</CardTitle>
            <CardDescription className="text-center">
              Super Admins cannot reset passwords via this page. Use the in-app prompt after login.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }

    if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d])/.test(password)) {
      setError('Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character');
      return;
    }

    setLoading(true);

    try {
      await api.resetPassword(token!, password);
      setSuccess(true);

      // Redirect to login after 3 seconds
      setTimeout(() => {
        navigate('/login');
      }, 3000);
    } catch (error: any) {
      setError(error.message || 'Failed to reset password');
    } finally {
      setLoading(false);
    }
  };

  if (!token) {
  return (
    <div className="h-screen w-screen flex items-center justify-center reset-page bg-gray-900">
      {/* Invalid Link Message */}
      <div className="w-full max-w-md flex items-center justify-center p-8 relative overflow-hidden">
          {/* Background Pattern */}
          <div className="absolute inset-0 opacity-5">
            <div className="absolute inset-0 reset-background-pattern" />
          </div>

          {/* Medical Cross Icon Background */}
          <div className="absolute top-10 right-10 opacity-10">
            <Heart className="w-32 h-32 reset-heart-icon" />
          </div>
          <div className="absolute bottom-10 left-10 opacity-10">
            <Shield className="w-24 h-24 reset-shield-icon" />
          </div>

          <Card className="w-full max-w-lg shadow-2xl relative z-10 reset-card">
            <CardHeader className="space-y-6 pt-8 pb-8">
              {/* Hospital Branding */}
              <div className="flex flex-col items-center justify-center gap-4">
                <div className="relative">
                  <div className="w-16 h-16 rounded-full flex items-center justify-center reset-branding-icon">
                    <Logo size="xl" variant="circle" className="w-12 h-12" />
                  </div>
                  <div className="absolute -top-1 -right-1 w-6 h-6 rounded-full flex items-center justify-center reset-branding-badge">
                    <AlertCircle className="w-3 h-3 text-white" />
                  </div>
                </div>
                <div className="text-center">
                  <h1 className="text-2xl font-bold reset-title">
                    Smart Health Manager
                  </h1>
                  <p className="text-sm mt-1 opacity-80 reset-subtitle">
                    Healthcare Management Portal
                  </p>
                </div>
              </div>

              {/* Error Message */}
              <div className="text-center space-y-2">
                <CardTitle className="text-2xl font-bold reset-error-title">
                  Invalid Reset Link
                </CardTitle>
                <CardDescription className="reset-description">
                  This password reset link is invalid or has expired.
                </CardDescription>
              </div>
            </CardHeader>

            <CardContent className="space-y-6">
              <Button onClick={() => navigate('/forgot-password')} className="w-full h-12 text-base font-semibold transition-all duration-200 hover:scale-105 reset-button">
                <div className="flex items-center justify-center gap-2">
                  <Shield className="w-5 h-5" />
                  Request New Reset Link
                </div>
              </Button>
            </CardContent>

            <CardFooter className="pt-6 text-center reset-footer-border">
              <p className="text-sm w-full reset-footer-text">
                Protected by Enterprise-Grade Security •
                <span className="ml-1 font-medium reset-hipaa-link">
                  HIPAA Compliant
                </span>
              </p>
            </CardFooter>
          </Card>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="h-screen w-screen flex items-center justify-center reset-page bg-gray-900">
        {/* Success Message */}
        <div className="w-full max-w-md flex items-center justify-center p-8 relative overflow-hidden">
          {/* Background Pattern */}
          <div className="absolute inset-0 opacity-5">
            <div className="absolute inset-0 reset-background-pattern" />
          </div>

          {/* Medical Cross Icon Background */}
          <div className="absolute top-10 right-10 opacity-10">
            <Heart className="w-32 h-32 reset-heart-icon" />
          </div>
          <div className="absolute bottom-10 left-10 opacity-10">
            <Shield className="w-24 h-24 reset-shield-icon" />
          </div>

          <Card className="w-full max-w-lg shadow-2xl relative z-10 reset-card">
            <CardHeader className="space-y-6 pt-8 pb-8">
              {/* Hospital Branding */}
              <div className="flex flex-col items-center justify-center gap-4">
                <div className="relative">
                  <div className="w-16 h-16 rounded-full flex items-center justify-center reset-branding-icon">
                    <Logo size="xl" variant="circle" className="w-12 h-12" />
                  </div>
                  <div className="absolute -top-1 -right-1 w-6 h-6 rounded-full flex items-center justify-center reset-branding-badge">
                    <CheckCircle2 className="w-3 h-3 text-white" />
                  </div>
                </div>
                <div className="text-center">
                  <h1 className="text-2xl font-bold reset-title">
                    Smart Health Manager
                  </h1>
                  <p className="text-sm mt-1 opacity-80 reset-subtitle">
                    Healthcare Management Portal
                  </p>
                </div>
              </div>

              {/* Success Message */}
              <div className="text-center space-y-2">
                <CardTitle className="text-2xl font-bold reset-success-title">
                  Password Reset Successful
                </CardTitle>
                <CardDescription className="reset-description">
                  Your password has been reset successfully. You will be redirected to the login page shortly.
                </CardDescription>
              </div>
            </CardHeader>

            <CardContent className="space-y-6">
              <div className="flex justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary reset-loading-spinner"></div>
              </div>
            </CardContent>

            <CardFooter className="pt-6 text-center reset-footer-border">
              <p className="text-sm w-full reset-footer-text">
                Protected by Enterprise-Grade Security •
                <span className="ml-1 font-medium reset-hipaa-link">
                  HIPAA Compliant
                </span>
              </p>
            </CardFooter>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen w-screen flex items-center justify-center reset-page bg-gray-900">
      {/* Reset Password Form */}
      <div className="w-full max-w-md flex items-center justify-center p-8 relative overflow-hidden">
        {/* Background Pattern */}
        <div className="absolute inset-0 opacity-5">
          <div className="absolute inset-0 reset-background-pattern" />
        </div>

        {/* Medical Cross Icon Background */}
        <div className="absolute top-10 right-10 opacity-10">
          <Heart className="w-32 h-32 reset-heart-icon" />
        </div>
        <div className="absolute bottom-10 left-10 opacity-10">
          <Shield className="w-24 h-24 reset-shield-icon" />
        </div>

        <Card className="w-full max-w-lg shadow-2xl relative z-10 reset-card">
          <CardHeader className="space-y-6 pt-8 pb-8">
            {/* Hospital Branding */}
            <div className="flex flex-col items-center justify-center gap-4">
              <div className="relative">
                <div className="w-16 h-16 rounded-full flex items-center justify-center reset-branding-icon">
                  <Logo size="xl" variant="circle" className="w-12 h-12" />
                </div>
                <div className="absolute -top-1 -right-1 w-6 h-6 rounded-full flex items-center justify-center reset-branding-badge">
                  <Shield className="w-3 h-3 text-white" />
                </div>
              </div>
              <div className="text-center">
                <h1 className="text-2xl font-bold reset-title">
                  Smart Health Manager
                </h1>
                <p className="text-sm mt-1 opacity-80 reset-subtitle">
                  Healthcare Management Portal
                </p>
              </div>
            </div>

            {/* Welcome Message */}
            <div className="text-center space-y-2">
              <CardTitle className="text-2xl font-bold reset-title">
                Reset Your Password
              </CardTitle>
              <CardDescription className="reset-description">
                Create a strong, secure password for your account
              </CardDescription>
            </div>
          </CardHeader>

          <CardContent className="space-y-6">
            {/* Error Alert */}
            {error && (
              <Alert className="reset-error-alert">
                <AlertCircle className="h-4 w-4 reset-error-icon" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Password Fields */}
              <div className="space-y-2">
                <div className="grid grid-cols-2 gap-4">
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      placeholder="New password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      disabled={loading}
                      className="h-12 text-base pl-12 pr-12 placeholder:text-gray-400 reset-input"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 p-1 rounded-md hover:bg-opacity-20 hover:bg-white transition-colors reset-show-password"
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
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                      disabled={loading}
                      className="h-12 text-base pl-12 pr-12 placeholder:text-gray-400 reset-input"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 p-1 rounded-md hover:bg-opacity-20 hover:bg-white transition-colors reset-show-password"
                    >
                      {showConfirmPassword ? (
                        <EyeOff className="w-5 h-5" />
                      ) : (
                        <Eye className="w-5 h-5" />
                      )}
                    </button>
                  </div>
                </div>
                <p className="text-xs reset-password-hint col-span-2">
                  Password must be at least 8 characters with uppercase, lowercase, number, and special character.
                </p>
              </div>

              {/* Reset Button */}
              <Button
                type="submit"
                disabled={loading}
                className="w-full h-12 text-base font-semibold transition-all duration-200 hover:scale-105 reset-button"
              >
                {loading ? (
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
                    Resetting Password...
                  </div>
                ) : (
                  <div className="flex items-center justify-center gap-2">
                    <Lock className="w-5 h-5" />
                    Reset Password
                  </div>
                )}
              </Button>
            </form>
          </CardContent>

          <CardFooter className="pt-6 text-center reset-footer-border">
            <p className="text-sm w-full reset-footer-text">
              Protected by Enterprise-Grade Security •
              <span className="ml-1 font-medium reset-hipaa-link">
                HIPAA Compliant
              </span>
            </p>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}