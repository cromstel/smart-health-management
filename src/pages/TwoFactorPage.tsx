import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { AuthLayout, OtpHero } from '@/components/auth';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Activity,
  ShieldCheck,
  Smartphone,
  Key,
  RotateCw,
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Lock,
  Fingerprint,
  Loader2,
} from 'lucide-react';
import { api } from '@/services/api';
import { startWebAuthnAuthentication } from '@/utils/webauthn';

const methods = [
  { id: 'totp' as const, label: 'Authenticator', icon: Lock },
  { id: 'passkey' as const, label: 'Passkey', icon: Fingerprint },
  { id: 'sms' as const, label: 'SMS Code', icon: Smartphone },
  { id: 'backup' as const, label: 'Recovery Code', icon: Key },
];

export default function TwoFactorPage() {
  const navigate = useNavigate();
  const { mfaPending, mfaPendingUser, verifyMfaTotp, verifyMfaRecovery, verifyMfaPasskey, cancelMfa } = useAuth();
  const [code, setCode] = useState('');
  const [recoveryCode, setRecoveryCode] = useState('');
  const [method, setMethod] = useState<'totp' | 'passkey' | 'sms' | 'backup'>('totp');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    if (cooldown > 0) {
      timer = setTimeout(() => setCooldown(cooldown - 1), 1000);
    }
    return () => clearTimeout(timer);
  }, [cooldown]);

  const [isBiometricLoading, setIsBiometricLoading] = useState(false);

  const handlePasskeyVerify = async () => {
    if (!mfaPendingUser) {
      setError('No pending verification session. Please log in again.');
      return;
    }
    setIsBiometricLoading(true);
    setError('');

    try {
      // Real WebAuthn assertion: fetch a signed server challenge for the
      // account, run the platform authenticator ceremony, then exchange the
      // assertion for the full session (mfa_pending temp token is consumed).
      const { options, challengeToken } = await api.webauthnLoginOptions(mfaPendingUser.email);
      const assertion = await startWebAuthnAuthentication(options);
      if (!assertion) {
        setError('Passkey verification cancelled.');
        return;
      }
      await verifyMfaPasskey(assertion, challengeToken);
      setSuccess(true);
      setTimeout(() => {
        navigate('/dashboard');
      }, 1000);
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : 'Passkey credentials could not be validated.';
      setError(errMsg);
    } finally {
      setIsBiometricLoading(false);
    }
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setError('');

    // Passkey method has no code input — run the ceremony directly.
    if (method === 'passkey') {
      await handlePasskeyVerify();
      return;
    }

    // Recovery codes are the only method in this flow with a text input —
    // verify them through the dedicated (single-use) endpoint.
    if (method === 'backup') {
      const clean = recoveryCode.trim().toUpperCase();
      if (!/^[A-Z0-9]{5}-[A-Z0-9]{5}$/.test(clean)) {
        setError('Enter a valid recovery code in the XXXXX-XXXXX format.');
        return;
      }
      setLoading(true);
      try {
        await verifyMfaRecovery(clean);
        setSuccess(true);
        setTimeout(() => {
          navigate('/dashboard');
        }, 1000);
      } catch (err: unknown) {
        const errMsg = err instanceof Error ? err.message : 'Verification failed. Check the code.';
        setError(errMsg);
      } finally {
        setLoading(false);
      }
      return;
    }

    if (code.length !== 6) {
      setError('Please enter the complete 6-digit authentication code.');
      return;
    }

    setLoading(true);
    try {
      await verifyMfaTotp(code);
      setSuccess(true);
      setTimeout(() => {
        navigate('/dashboard');
      }, 1000);
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : 'Verification failed. Please check the code.';
      setError(errMsg);
    } finally {
      setLoading(false);
    }
  };

  const handleQuickFill = async () => {
    try {
      const { code: demoCode } = await api.devCurrentTotp();
      setCode(demoCode);
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not fetch the demo code. Is the API running?');
    }
  };

  const handleResend = () => {
    if (cooldown > 0) return;
    setCooldown(30);
  };

  const getMethodDescription = () => {
    if (method === 'totp') return 'Enter the 6-digit security token generated by your authenticator app';
    if (method === 'passkey') return 'Confirm with your registered passkey (Touch ID, Face ID, or Windows Hello)';
    if (method === 'sms') return 'Enter the security code dispatched to your registered device (+233 ••• ••56)';
    return 'Enter a single-use backup code you saved when setting up two-factor authentication';
  };

  // ── No pending MFA session ──────────────────────────────────────────────
  if (!mfaPending) {
    return (
      <AuthLayout showBranding={false}>
        <div className="space-y-6">
          <div className="flex flex-col items-center lg:items-start text-center lg:text-left">
            <div className="flex items-center gap-3 mb-4">
              <div className="h-11 w-11 rounded-xl bg-primary flex items-center justify-center shadow-lg shadow-primary/20">
                <Activity className="h-5 w-5 text-primary-foreground" aria-hidden="true" />
              </div>
              <h1 className="text-2xl font-bold tracking-tight text-foreground">Smart Health</h1>
            </div>
          </div>

          <Card className="border border-border bg-card shadow-lg shadow-border/50">
            <CardHeader className="space-y-4 text-center pb-4 border-b border-border">
              <div className="flex justify-center">
                <div className="h-16 w-16 rounded-2xl bg-muted border border-border text-muted-foreground flex items-center justify-center shadow-inner">
                  <ShieldCheck className="h-8 w-8" aria-hidden="true" />
                </div>
              </div>
              <div>
                <h2 className="text-xl font-bold text-foreground">No Verification Session</h2>
                <CardDescription className="text-xs text-muted-foreground mt-1">
                  A two-factor authentication session has not been initiated. Please log in with
                  your email and password to begin verification.
                </CardDescription>
              </div>
            </CardHeader>

            <CardContent className="pt-6 flex justify-center">
              <Link
                to="/login"
                className="inline-flex items-center justify-center h-11 px-6 rounded-xl bg-accent text-accent-foreground text-sm font-semibold shadow-lg shadow-accent/20 hover:bg-accent/90 transition-colors"
              >
                <ArrowLeft className="h-4 w-4 mr-2" aria-hidden="true" />
                Return to Login
              </Link>
            </CardContent>
          </Card>
        </div>
      </AuthLayout>
    );
  }

  // ── Active MFA session ──────────────────────────────────────────────────
  return (
    <AuthLayout showBranding={false}>
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
          <h2 className="text-2xl font-bold tracking-tight text-foreground mb-1">Two-Factor Authentication</h2>
          <p className="text-sm text-muted-foreground">Multi-factor identity verification</p>
        </motion.div>

        <Card className="border border-border bg-card shadow-lg shadow-border/50">
          <CardHeader className="space-y-4 text-center pb-4 border-b border-border">
            <motion.div
              className="flex justify-center"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', stiffness: 200, damping: 15, delay: 0.2 }}
            >
              <div className="h-16 w-16 rounded-2xl bg-accent/15 border border-accent/30 text-accent flex items-center justify-center shadow-inner">
                <ShieldCheck className="h-8 w-8" aria-hidden="true" />
              </div>
            </motion.div>

            <div>
              <div className="flex items-center justify-center gap-2">
                <h3 className="text-xl font-bold text-foreground">Identity Verification</h3>
                <Badge variant="outline" className="text-[10px] border-accent/40 text-accent font-semibold">
                  2FA REQUIRED
                </Badge>
              </div>
              <CardDescription className="text-xs text-muted-foreground mt-1">
                {getMethodDescription()}
              </CardDescription>
              {mfaPendingUser && (
                <p className="text-[11px] text-muted-foreground mt-1.5">
                  Verifying for{' '}
                  <span className="font-medium text-foreground">{mfaPendingUser.name}</span>
                  {' • '}
                  <span className="font-mono">{mfaPendingUser.email}</span>
                </p>
              )}
            </div>

            {/* Method Switcher */}
            <div
              className="flex items-center justify-center gap-1.5 pt-2"
              role="group"
              aria-label="Verification method"
            >
              {methods.map((m) => (
                <motion.button
                  key={m.id}
                  type="button"
                  onClick={() => { setMethod(m.id); setError(''); }}
                  className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all duration-200 flex items-center gap-1.5 ${
                    method === m.id
                      ? 'bg-accent text-accent-foreground shadow-sm'
                      : 'bg-muted/40 text-muted-foreground hover:text-foreground hover:bg-muted/60'
                  }`}
                  aria-pressed={method === m.id}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <m.icon className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>{m.label}</span>
                </motion.button>
              ))}
            </div>
          </CardHeader>

          <CardContent className="pt-6 space-y-5">
            {/* Error Alert */}
            <AnimatePresence>
              {error && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="p-3 rounded-lg bg-destructive/15 border border-destructive/30 flex items-start gap-2.5 text-destructive text-xs"
                  role="alert"
                  aria-live="assertive"
                >
                  <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" aria-hidden="true" />
                  <span className="font-medium">{error}</span>
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
                  className="py-6 text-center space-y-3"
                >
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: 'spring', stiffness: 200, damping: 15 }}
                  >
                    <CheckCircle2 className="h-14 w-14 text-emerald-500 mx-auto" aria-hidden="true" />
                  </motion.div>
                  <p className="text-base font-semibold text-foreground">Security Token Verified!</p>
                  <p className="text-xs text-muted-foreground">Initializing workstation session...</p>
                </motion.div>
              ) : (
                <motion.form
                  key="form"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  onSubmit={handleSubmit}
                  className="space-y-5"
                >
                  {/* OTP / Passkey Input */}
                  <div className="flex flex-col items-center justify-center space-y-3">
                    {method === 'backup' ? (
                      <div className="w-full max-w-sm space-y-2">
                        <Label htmlFor="recoveryCode" className="text-xs font-semibold text-muted-foreground">
                          Offline Recovery Code
                        </Label>
                        <Input
                          id="recoveryCode"
                          value={recoveryCode}
                          onChange={(e) => {
                            setRecoveryCode(e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, ''));
                            setError('');
                          }}
                          placeholder="XXXXX-XXXXX"
                          autoComplete="one-time-code"
                          autoFocus
                          className="h-11 text-center font-mono tracking-widest"
                          aria-label="Enter recovery code"
                        />
                        <span className="text-[11px] text-muted-foreground block">
                          Format is five characters, a dash, then five more (uppercase letters and numbers only).
                        </span>
                      </div>
                    ) : method === 'passkey' ? (
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => void handlePasskeyVerify()}
                        className="w-full max-w-sm h-14 text-sm font-semibold border-accent/40 hover:border-accent hover:bg-accent/10 text-foreground gap-3 transition-all duration-200"
                        disabled={loading || isBiometricLoading}
                      >
                        {isBiometricLoading ? (
                          <Loader2 className="h-5 w-5 animate-spin text-accent" aria-hidden="true" />
                        ) : (
                          <Fingerprint className="h-5 w-5 text-accent" aria-hidden="true" />
                        )}
                        <span>{isBiometricLoading ? 'Waiting for biometric prompt...' : 'Verify with Passkey'}</span>
                      </Button>
                    ) : (
                      <>
                        <OtpHero
                          value={code}
                          onChange={(val) => {
                            setCode(val);
                            if (val.length === 6) {
                              setError('');
                            }
                          }}
                          ariaLabel="Enter 6-digit authentication code"
                        />
                        <span className="text-[11px] text-muted-foreground">
                          Auto-focus enabled. You can type or paste code.
                        </span>
                      </>
                    )}
                  </div>

                  <div className="space-y-3">
                    <Button
                      type="submit"
                      className="w-full h-11 text-sm font-semibold bg-accent text-accent-foreground hover:bg-accent/90 transition-all duration-200 shadow-lg shadow-accent/20 hover:shadow-xl hover:shadow-accent/30"
                      disabled={
                        loading ||
                        isBiometricLoading ||
                        (method === 'backup'
                          ? !/^[A-Z0-9]{5}-[A-Z0-9]{5}$/.test(recoveryCode.trim().toUpperCase())
                          : method === 'passkey'
                            ? false
                            : code.length !== 6)
                      }
                    >
                      {loading ? (
                        <span className="flex items-center gap-2">
                          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                          Verifying Token...
                        </span>
                      ) : (
                        method === 'passkey' ? 'Use Passkey to Confirm' : 'Confirm & Proceed to Dashboard'
                      )}
                    </Button>
                  </div>
                </motion.form>
              )}
            </AnimatePresence>

            {/* Helper Buttons */}
            <div className="space-y-2 pt-1">
              {import.meta.env.DEV && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleQuickFill}
                  className="w-full text-xs gap-1.5 border-border text-muted-foreground hover:text-foreground transition-colors"
                >
                  <CheckCircle2 className="h-3.5 w-3.5 text-accent" aria-hidden="true" />
                  <span>Quick Test: Fetch Current Demo TOTP Token</span>
                </Button>
              )}

              {method === 'sms' && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleResend}
                  disabled={cooldown > 0}
                  className="w-full text-xs text-muted-foreground hover:text-foreground gap-1.5 transition-colors"
                >
                  <RotateCw className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>{cooldown > 0 ? `Resend SMS in ${cooldown}s` : 'Resend SMS code'}</span>
                </Button>
              )}
            </div>
          </CardContent>

          <CardFooter className="flex items-center justify-center border-t border-border pt-4 text-xs">
            <Link
              to="/login"
              onClick={cancelMfa}
              className="text-accent hover:text-accent/80 flex items-center gap-1.5 font-medium transition-colors"
            >
              <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Cancel & Return to Login</span>
            </Link>
          </CardFooter>
        </Card>
      </div>
    </AuthLayout>
  );
}
