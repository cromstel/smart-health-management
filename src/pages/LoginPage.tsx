import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertCircle, Eye, EyeOff, Shield, Heart, Lock, Mail } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Logo } from '@/components/ui';
import './LoginPage.css';


export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      await login(email, password);
      navigate('/dashboard');
    } catch (error: any) {
      setError(error.message || 'Login failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-screen w-screen flex items-center login-page">
      {/* Login Form */}
      <div className="w-full max-w-md h-full flex flex-col justify-center p-8 pl-16 relative overflow-hidden">

        {/* Medical Cross Icon Background */}
        <div className="absolute top-10 right-10 opacity-10">
          <Heart className="w-32 h-32 login-heart-icon" />
        </div>
        <div className="absolute bottom-10 left-10 opacity-10">
          <Shield className="w-24 h-24 login-shield-icon" />
        </div>

        <Card className="w-full max-w-lg shadow-2xl relative z-10 login-card">
          <CardHeader className="space-y-6 pt-8 pb-8">
          {/* Hospital Branding */}
          <div className="flex flex-col items-center justify-center gap-4">
            <div className="relative">
              <div className="w-16 h-16 rounded-full flex items-center justify-center login-branding-icon">
                <Logo size="xl" variant="circle" className="w-12 h-12" />
              </div>
              <div className="absolute -top-1 -right-1 w-6 h-6 rounded-full flex items-center justify-center login-branding-badge">
                <Shield className="w-3 h-3 text-white" />
              </div>
            </div>
              <div className="text-center">
                <h1 className="text-2xl font-bold login-title">
                  Smart Health Manager
                </h1>
                <p className="text-sm mt-1 opacity-80 login-subtitle">
                  Healthcare Management Portal
                </p>
              </div>
            </div>

            {/* Welcome Message */}
            <div className="text-center space-y-2">
              <CardTitle className="text-2xl font-bold login-title">
                Secure Login
              </CardTitle>
              <CardDescription className="login-description">
                Access your healthcare management dashboard
              </CardDescription>
            </div>
          </CardHeader>

          <CardContent className="space-y-6">
            {/* Error Alert */}
            {error && (
              <Alert className="login-error-alert">
                <AlertCircle className="h-4 w-4 login-error-icon" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

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
                    className="h-12 text-base pl-12 placeholder:text-gray-400 login-input"
                  />
                </div>
              </div>

              {/* Password Field */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span></span>
                  <Link
                    to="/forgot-password"
                    className="text-sm hover:underline transition-colors login-forgot-link"
                  >
                    Forgot Password?
                  </Link>
                </div>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    disabled={loading}
                    className="h-12 text-base pl-12 pr-12 placeholder:text-gray-400 login-input"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 p-1 rounded-md hover:bg-opacity-20 hover:bg-white transition-colors login-show-password"
                  >
                    {showPassword ? (
                      <EyeOff className="w-5 h-5" />
                    ) : (
                      <Eye className="w-5 h-5" />
                    )}
                  </button>
                </div>
              </div>

              {/* Login Button */}
              <Button
                type="submit"
                disabled={loading}
                className="w-full h-12 text-base font-semibold transition-all duration-200 hover:scale-105 login-button"
              >
                {loading ? (
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
                    Signing In...
                  </div>
                ) : (
                  <div className="flex items-center justify-center gap-2">
                    <Lock className="w-5 h-5" />
                    Sign In Securely
                  </div>
                )}
              </Button>
            </form>

            {/* Additional Links */}
            <div className="text-center space-y-2 pt-4 login-links-border">
              <p className="text-sm login-links-text">
                New to our platform?{' '}
                <Link
                  to="/register"
                  className="hover:underline transition-colors font-medium login-register-link"
                >
                  Create Account
                </Link>
              </p>
              <p className="text-sm login-links-text">
                Need help? Contact your system administrator
              </p>
            </div>
          </CardContent>

          <CardFooter className="pt-6 text-center login-footer-border">
            <p className="text-sm w-full login-footer-text">
              Protected by Enterprise-Grade Security •
              <span className="ml-1 font-medium login-hipaa-link">
                HIPAA Compliant
              </span>
            </p>
          </CardFooter>
        </Card>
      </div>

    </div>
  );
}
