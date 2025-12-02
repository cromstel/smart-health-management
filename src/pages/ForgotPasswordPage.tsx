import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Heart, Shield, Mail, ArrowLeft, CheckCircle, AlertCircle, Clock, Users } from 'lucide-react';
import { Logo } from '@/components/ui';
import { api } from '@/services/api';
import './ForgotPasswordPage.css';


export default function ForgotPasswordPage() {
  const { user } = useAuth();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    if (!email.trim()) {
      setError('Email address is required');
      setLoading(false);
      return;
    }

    if (!/\S+@\S+\.\S+/.test(email)) {
      setError('Please enter a valid email address');
      setLoading(false);
      return;
    }

    try {
      await api.forgotPassword(email.trim().toLowerCase());
      setSent(true);
    } catch (error: any) {
      setError(error.message || 'Failed to send password reset request. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (sent) {
  return (
    <div className="h-screen w-screen flex items-center  forgot-page ">
      {/* Success Message */}
      <div className="w-full max-w-md h-full flex flex-col justify-center p-8 pl-16 relative overflow-hidden">

          {/* Medical Cross Icon Background */}
          <div className="absolute top-10 right-10 opacity-10">
            <Heart className="w-32 h-32 forgot-heart-icon" />
          </div>
          <div className="absolute bottom-10 left-10 opacity-10">
            <Shield className="w-24 h-24 forgot-shield-icon" />
          </div>

          <Card className="w-full max-w-lg shadow-2xl relative z-10 forgot-card">
          <CardHeader className="space-y-6 pb-6">
            {/* Hospital Branding */}
            <div className="flex flex-col items-center  gap-4">
              <div className="relative">
                <div className="w-16 h-16 rounded-full flex items-center  forgot-branding-icon">
                  <Logo size="xl" variant="circle" className="w-12 h-12" />
                </div>
                <div className="absolute -top-1 -right-1 w-6 h-6 rounded-full flex items-center  forgot-branding-badge">
                  <Shield className="w-3 h-3 text-white" />
                </div>
              </div>
              <div className="text-center">
                <h1 className="text-2xl font-bold forgot-title">
                  Smart Health Manager
                </h1>
                <p className="text-sm mt-1 opacity-80 forgot-subtitle">
                  Healthcare Management Portal
                </p>
              </div>
            </div>

            {/* Success Icon */}
            <div className="flex items-center ">
              <div className="w-20 h-20 rounded-full flex items-center  forgot-success-icon">
                <CheckCircle className="w-10 h-10 text-white" />
              </div>
            </div>

            {/* Success Message */}
            <div className="text-center space-y-3">
              <CardTitle className="text-xl font-bold forgot-success-title">
                Password Reset Request Sent
              </CardTitle>
              <CardDescription className="forgot-success-description">
                Your request has been forwarded to your hospital administrator for review
              </CardDescription>
            </div>

            {/* Security Badge */}
            <div className="flex items-center  gap-2 px-4 py-2 rounded-lg forgot-security-badge">
              <Clock className="w-4 h-4 forgot-clock-icon" />
              <span className="text-xs font-medium forgot-security-text">
                Processing Time: 24-48 hours
              </span>
            </div>
          </CardHeader>

          <CardContent className="space-y-6">
            {/* Information Alert */}
            <Alert className="forgot-info-alert">
              <Users className="h-4 w-4 forgot-users-icon" />
              <AlertDescription>
                <strong>RBAC Security Protocol:</strong> For security and compliance reasons,
                password resets are handled by hospital administrators. You will receive an
                email notification once your request has been processed.
              </AlertDescription>
            </Alert>

            <div className="space-y-4">
              <div className="text-center">
                <p className="text-sm mb-4 forgot-links-text">
                  Request submitted for: <strong className="forgot-title">{email}</strong>
                </p>
              </div>

              <Button
                variant="outline"
                className="w-full forgot-outline-button"
                onClick={() => {
                  setSent(false);
                  setEmail('');
                }}
              >
                Submit Another Request
              </Button>

              <Link to="/login">
                <Button
                  variant="ghost"
                  className="w-full gap-2 forgot-ghost-button"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Back to Login
                </Button>
              </Link>
            </div>
          </CardContent>

          <CardFooter className="pt-6 text-center forgot-footer-border">
            <p className="text-sm w-full forgot-footer-text">
              Need immediate assistance? Contact your hospital IT support •
              <span className="ml-1 font-medium forgot-hipaa-link">
                HIPAA Compliant
              </span>
            </p>
          </CardFooter>
        </Card>
        </div>

      </div>
    );
  }

  if (user?.role === 'Super Admin') {
    return (
      <div className="h-screen w-screen flex items-center  forgot-page ">
        {/* Restricted Access */}
        <div className="w-full max-w-md h-full flex flex-col justify-center p-8 pl-16 relative overflow-hidden">

          {/* Medical Cross Icon Background */}
          <div className="absolute top-10 right-10 opacity-10">
            <Heart className="w-32 h-32 forgot-heart-icon" />
          </div>
          <div className="absolute bottom-10 left-10 opacity-10">
            <Shield className="w-24 h-24 forgot-shield-icon" />
          </div>

          <Card className="w-full max-w-md shadow-2xl relative z-10 forgot-restricted-card">
          <CardHeader className="space-y-4">
            <div className="flex flex-col items-center  gap-4">
              <div className="w-16 h-16 rounded-full flex items-center  forgot-restricted-icon">
                <AlertCircle className="w-8 h-8 text-white" />
              </div>
              <div className="text-center">
                <h1 className="text-2xl font-bold forgot-restricted-title">
                  Access Restricted
                </h1>
              </div>
            </div>
            <CardTitle className="text-center text-xl forgot-restricted-title">
              Super Admin Access
            </CardTitle>
            <CardDescription className="text-center forgot-restricted-description">
              Super Administrators cannot use the forgot password feature.
              Please change your password through the admin dashboard after login.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link to="/super-admin/login">
              <Button
                className="w-full forgot-restricted-button"
              >
                Go to Super Admin Login
              </Button>
            </Link>
          </CardContent>
        </Card>
        </div>

      </div>
    );
  }

  return (
    <div className="h-screen w-screen flex items-center  forgot-page ">
      {/* Forgot Password Form */}
      <div className="w-full max-w-md h-full flex flex-col justify-center p-8 pl-16 relative overflow-hidden">
        {/* Background Pattern */}
        <div className="absolute inset-0 opacity-5">
          <div className="absolute inset-0 forgot-background-pattern" />
        </div>

        {/* Medical Cross Icon Background */}
        <div className="absolute top-10 right-10 opacity-10">
          <Heart className="w-32 h-32 forgot-heart-icon" />
        </div>
        <div className="absolute bottom-10 left-10 opacity-10">
          <Shield className="w-24 h-24 forgot-shield-icon" />
        </div>

        <Card className="w-full max-w-lg shadow-2xl relative z-10 forgot-card">
        <CardHeader className="space-y-6 pb-8">
          {/* Hospital Branding */}
          <div className="flex flex-col items-center  gap-4">
            <div className="relative">
              <div className="w-16 h-16 rounded-full flex items-center  forgot-branding-icon">
                <Logo size="xl" variant="circle" className="w-12 h-12" />
              </div>
              <div className="absolute -top-1 -right-1 w-6 h-6 rounded-full flex items-center  forgot-branding-badge">
                <Shield className="w-3 h-3 text-white" />
              </div>
            </div>
            <div className="text-center">
              <h1 className="text-2xl font-bold forgot-title">
                Smart Health Manager
              </h1>
              <p className="text-sm mt-1 opacity-80 forgot-subtitle">
                Healthcare Management Portal
              </p>
            </div>
          </div>

          {/* Welcome Message */}
          <div className="text-center space-y-2">
            <CardTitle className="text-2xl font-bold forgot-title">
              Password Reset
            </CardTitle>
            <CardDescription className="forgot-description">
              Request password reset assistance from your administrator
            </CardDescription>
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Error Alert */}
          {error && (
            <Alert className="forgot-error-alert">
              <AlertCircle className="h-4 w-4 forgot-error-icon" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Information Alert */}
          <Alert className="forgot-info-alert">
            <Users className="h-4 w-4 forgot-users-icon" />
            <AlertDescription>
              <strong>RBAC Security Protocol:</strong> Password resets are processed by hospital administrators
              to ensure security and compliance with healthcare regulations.
            </AlertDescription>
          </Alert>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Email Field */}
            <div className="space-y-2">
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                <Input
                  id="email"
                  type="email"
                  placeholder="your.email@hospital.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={loading}
                  className="h-12 text-base pl-12 placeholder:text-gray-400 forgot-input"
                />
              </div>
              <p className="text-xs forgot-input-hint">
                Enter the email associated with your healthcare account
              </p>
            </div>

            {/* Submit Button */}
            <Button
              type="submit"
              disabled={loading}
              className="w-full h-12 text-base font-semibold transition-all duration-200 hover:scale-105 forgot-button"
            >
              {loading ? (
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
                  Sending Request...
                </div>
              ) : (
                <div className="flex items-center  gap-2">
                  <Mail className="w-5 h-5" />
                  Send Reset Request
                </div>
              )}
            </Button>
          </form>

          {/* Additional Links */}
          <div className="text-center space-y-2 pt-4 forgot-links-border">
            <p className="text-sm forgot-links-text">
              Remember your password?
            </p>
            <Link
              to="/login"
              className="inline-flex items-center gap-2 hover:underline transition-colors font-medium forgot-back-link"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Login
            </Link>
          </div>
        </CardContent>

        <CardFooter className="pt-6 text-center forgot-footer-border">
          <p className="text-sm w-full forgot-footer-text">
            Protected by enterprise-grade security •
            <span className="ml-1 font-medium forgot-hipaa-link">
              HIPAA Compliant
            </span>
          </p>
        </CardFooter>
      </Card>
      </div>

    </div>
  );
}