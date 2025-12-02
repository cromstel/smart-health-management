import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import { Heart, Shield } from 'lucide-react';
import { Logo } from '@/components/ui';
import './TwoFactorPage.css';


export default function TwoFactorPage() {
  const navigate = useNavigate();
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (code.length !== 6) {
      setError('Please enter a 6-digit code');
      return;
    }

    setLoading(true);
    
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    // For demo, accept any 6-digit code
    navigate('/dashboard');
  };

  return (
    <div className="h-screen w-screen flex items-center justify-center two-factor-page bg-gray-900">
      {/* Two Factor Form */}
      <div className="w-full max-w-md flex items-center justify-center p-8 relative overflow-hidden">
        {/* Background Pattern */}
        <div className="absolute inset-0 opacity-5">
          <div className="absolute inset-0 two-factor-background-pattern" />
        </div>

        {/* Medical Cross Icon Background */}
        <div className="absolute top-10 right-10 opacity-10">
          <Heart className="w-32 h-32 two-factor-heart-icon" />
        </div>
        <div className="absolute bottom-10 left-10 opacity-10">
          <Shield className="w-24 h-24 two-factor-shield-icon" />
        </div>

        <Card className="w-full max-w-lg shadow-2xl relative z-10 two-factor-card">
          <CardHeader className="space-y-6 pt-8 pb-8">
            {/* Hospital Branding */}
            <div className="flex flex-col items-center justify-center gap-4">
              <div className="relative">
                <div className="w-16 h-16 rounded-full flex items-center justify-center two-factor-branding-icon">
                  <Logo size="xl" variant="circle" className="w-12 h-12" />
                </div>
                <div className="absolute -top-1 -right-1 w-6 h-6 rounded-full flex items-center justify-center two-factor-branding-badge">
                  <Shield className="w-3 h-3 text-white" />
                </div>
              </div>
              <div className="text-center">
                <h1 className="text-2xl font-bold two-factor-title">
                  Smart Health Manager
                </h1>
                <p className="text-sm mt-1 opacity-80 two-factor-subtitle">
                  Healthcare Management Portal
                </p>
              </div>
            </div>

            {/* Welcome Message */}
            <div className="text-center space-y-2">
              <CardTitle className="text-2xl font-bold two-factor-title">
                Two-Factor Authentication
              </CardTitle>
              <CardDescription className="two-factor-description">
                Enter the 6-digit code from your authenticator app
              </CardDescription>
            </div>
          </CardHeader>

          <CardContent className="space-y-6">
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="flex justify-center">
                <InputOTP
                  maxLength={6}
                  value={code}
                  onChange={setCode}
                  className="two-factor-otp-input"
                >
                  <InputOTPGroup>
                    <InputOTPSlot index={0} className="two-factor-otp-slot" />
                    <InputOTPSlot index={1} className="two-factor-otp-slot" />
                    <InputOTPSlot index={2} className="two-factor-otp-slot" />
                    <InputOTPSlot index={3} className="two-factor-otp-slot" />
                    <InputOTPSlot index={4} className="two-factor-otp-slot" />
                    <InputOTPSlot index={5} className="two-factor-otp-slot" />
                  </InputOTPGroup>
                </InputOTP>
              </div>
              {error && (
                <p className="text-sm two-factor-error-text text-center">{error}</p>
              )}
              <Button type="submit" className="w-full h-12 text-base font-semibold transition-all duration-200 hover:scale-105 two-factor-button" disabled={loading || code.length !== 6}>
                {loading ? (
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
                    Verifying Code...
                  </div>
                ) : (
                  <div className="flex items-center justify-center gap-2">
                    <Shield className="w-5 h-5" />
                    Verify Code
                  </div>
                )}
              </Button>
              <div className="text-center">
                <Button variant="link" className="text-sm two-factor-link-button">
                  Didn't receive a code?
                </Button>
              </div>
            </form>
          </CardContent>

          <CardFooter className="pt-6 text-center two-factor-footer-border">
            <p className="text-sm w-full two-factor-footer-text">
              Protected by Enterprise-Grade Security •
              <span className="ml-1 font-medium two-factor-hipaa-link">
                HIPAA Compliant
              </span>
            </p>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}