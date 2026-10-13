import { cn } from '@/lib/utils';

type LogoVariant = 'default' | 'light' | 'sidebar';
type LogoSize = 'xs' | 'sm' | 'md';

interface LogoProps {
  /** Colour context so the wordmark stays readable over any surface. */
  variant?: LogoVariant;
  /** xs = sidebar/nav, sm = header/footer, md = auth page headers. */
  size?: LogoSize;
  /** Set false to render just the mark (e.g. tight navbars). */
  showText?: boolean;
  className?: string;
}

const SIZES: Record<LogoSize, { box: string; text: string }> = {
  xs: { box: 'h-8 w-8', text: 'text-lg' },
  sm: { box: 'h-9 w-9', text: 'text-lg' },
  md: { box: 'h-11 w-11', text: 'text-2xl' },
};

const TEXT_COLORS: Record<LogoVariant, string> = {
  default: 'text-foreground',
  light: 'text-primary-foreground',
  sidebar: 'text-sidebar-foreground',
};

/**
 * Single source of truth for the Smart MediCare brand mark.
 * Every logo on the site renders through this component and points at the
 * one canonical asset: /public/medicare-logo.webp.
 */
export default function Logo({
  variant = 'default',
  size = 'sm',
  showText = true,
  className,
}: LogoProps) {
  const { box, text } = SIZES[size];

  return (
    <span
      className={cn('inline-flex items-center gap-2.5', className)}
      role="img"
      aria-label="Smart MediCare"
    >
      <img
        src="/medicare-logo.webp"
        alt=""
        aria-hidden="true"
        width={size === 'md' ? 44 : size === 'sm' ? 36 : 32}
        height={size === 'md' ? 44 : size === 'sm' ? 36 : 32}
        className={cn(box, 'rounded-lg object-contain')}
      />
      {showText && (
        <span className={cn('font-display font-semibold tracking-tight', text, TEXT_COLORS[variant])}>
          Smart <span className="text-accent">MediCare</span>
        </span>
      )}
    </span>
  );
}