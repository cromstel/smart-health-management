import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import { cn } from '@/lib/utils';

interface OtpHeroProps {
  value: string;
  onChange: (value: string) => void;
  ariaLabel: string;
  digits?: number;
  autoFocus?: boolean;
  id?: string;
  className?: string;
}

/**
 * Shared 6-digit (configurable) OTP input used by the Login MFA step and the
 * standalone Two-Factor page. Unifies slot sizing and focus styling so the
 * security-code experience is identical across the auth flow.
 */
export function OtpHero({
  value,
  onChange,
  ariaLabel,
  digits = 6,
  autoFocus = true,
  id,
  className,
}: OtpHeroProps) {
  return (
    <InputOTP maxLength={digits} value={value} onChange={onChange} autoFocus={autoFocus} id={id} aria-label={ariaLabel}>
      <InputOTPGroup className={cn('gap-2', className)}>
        {Array.from({ length: digits }, (_, i) => (
          <InputOTPSlot
            key={i}
            index={i}
            className="h-12 w-11 text-lg font-mono rounded-lg border-border bg-background transition-all duration-200 focus:border-accent focus:ring-2 focus:ring-accent/20"
            aria-label={`Digit ${i + 1}`}
          />
        ))}
      </InputOTPGroup>
    </InputOTP>
  );
}