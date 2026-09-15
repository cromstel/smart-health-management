import { useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PasswordStrengthProps {
  password: string;
  className?: string;
}

export interface PasswordStrengthResult {
  score: number;
  length: boolean;
  upper: boolean;
  lower: boolean;
  number: boolean;
  special: boolean;
  upperLower: boolean;
}

/** Single source of truth for the SHMS password complexity policy. */
export function computePasswordStrength(password: string): PasswordStrengthResult {
  const length = password.length >= 8;
  const upper = /[A-Z]/.test(password);
  const lower = /[a-z]/.test(password);
  const number = /[0-9]/.test(password);
  const special = /[^A-Za-z0-9]/.test(password);
  const score = [length, upper, lower, number, special].filter(Boolean).length;
  return { score, length, upper, lower, number, special, upperLower: upper && lower };
}

const strengthLabels = ['Very Weak', 'Weak', 'Moderate', 'Strong', 'Excellent'];
const strengthColors = ['bg-destructive', 'bg-orange-500', 'bg-yellow-500', 'bg-emerald-500', 'bg-emerald-600'];

/**
 * Shared password complexity meter used by Register and Reset Password pages.
 * Renders nothing until the user types; animates the segment bar and checklist
 * as the password satisfies each requirement.
 */
export function PasswordStrength({ password, className }: PasswordStrengthProps) {
  const strength = useMemo(() => computePasswordStrength(password), [password]);

  const labelIndex = Math.max(0, strength.score - 1);

  const checks = [
    { label: '8+ Characters', met: strength.length },
    { label: 'Upper & Lowercase', met: strength.upperLower },
    { label: 'Numbers (0-9)', met: strength.number },
    { label: 'Special Symbols', met: strength.special },
  ];

  return (
    <AnimatePresence>
      {password.length > 0 && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          className={cn('p-4 rounded-xl bg-muted/40 border border-border text-xs space-y-3', className)}
        >
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground font-medium">Password Complexity</span>
            <span className="font-semibold text-foreground" role="status" aria-live="polite">
              {strengthLabels[labelIndex]}
            </span>
          </div>

          {/* Strength Bar */}
          <div className="h-1.5 bg-border rounded-full overflow-hidden">
            <motion.div
              className={`h-full ${strengthColors[labelIndex]}`}
              initial={{ width: 0 }}
              animate={{ width: `${(strength.score / 5) * 100}%` }}
              transition={{ duration: 0.3 }}
            />
          </div>

          {/* Requirements */}
          <div className="grid grid-cols-2 gap-2 pt-1">
            {checks.map((check) => (
              <div
                key={check.label}
                className={`flex items-center gap-1.5 ${check.met ? 'text-emerald-500' : 'text-muted-foreground'}`}
              >
                <CheckCircle2 className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                <span>{check.label}</span>
              </div>
            ))}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}