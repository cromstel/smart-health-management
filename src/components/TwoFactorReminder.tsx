import { useState, useEffect } from 'react';
import { ShieldAlert, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

export function TwoFactorReminder() {
  const { user } = useAuth();
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    setDismissed(sessionStorage.getItem('2fa_reminder_dismissed') === '1');
  }, []);

  if (!user || user.totp_enabled || dismissed) return null;

  const handleDismiss = () => {
    setDismissed(true);
    sessionStorage.setItem('2fa_reminder_dismissed', '1');
  };

  return (
    <div
      role="alert"
      aria-live="polite"
      className="relative w-full border border-info/30 bg-navy/[0.85] text-foreground px-4 py-3.5 rounded-lg shadow-sm"
    >
      <div className="flex items-start gap-3 pr-8">
        <ShieldAlert className="h-5 w-5 text-info shrink-0 mt-0.5" aria-hidden="true" />
        <div className="min-w-0 leading-snug">
          <p className="text-sm font-medium">Two-factor authentication is not active.</p>
          <p className="text-sm text-muted-foreground mt-0.5">
            Enable 2FA in <Link to="/settings" className="underline text-info hover:text-info/90">Settings</Link> to protect your account.
          </p>
        </div>
      </div>
      <button
        aria-label="Dismiss reminder"
        onClick={handleDismiss}
        className="absolute top-3 right-3 p-1 rounded-md hover:bg-white/10 transition-colors focus:outline-none focus:ring-2 focus:ring-info/50"
      >
        <X className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
      </button>
    </div>
  );
}
