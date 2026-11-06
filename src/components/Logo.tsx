import { cn } from '@/lib/utils';
import { APP_NAME } from '@/config/app';

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
  /** Optional override for the wordmark size, e.g. responsive classes on narrow
   *  layouts where the nowrap wordmark would otherwise set a min-content floor. */
  textClassName?: string;
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
 * Single source of truth for the application brand mark.
 * Every logo on the site renders through this component and points at the
 * one canonical asset: /public/medicare-logo.webp.
 */
export default function Logo({
  variant = 'default',
  size = 'sm',
  showText = true,
  className,
  textClassName,
}: LogoProps) {
  const { box, text } = SIZES[size];

  return (
    <span
      className={cn('inline-flex shrink-0 items-center gap-2.5 whitespace-nowrap', className)}
      role="img"
      aria-label={APP_NAME}
    >
      <img
        src="/medicare-logo.webp"
        alt=""
        aria-hidden="true"
        width={size === 'md' ? 44 : size === 'sm' ? 36 : 32}
        height={size === 'md' ? 44 : size === 'sm' ? 36 : 32}
        className={cn(box, 'shrink-0 rounded-lg object-contain')}
      />
      {showText && (
        <span className={cn('font-display font-semibold tracking-tight uppercase', textClassName ?? text, TEXT_COLORS[variant])}>
          SMART <span className="text-accent">MEDICARE</span>
        </span>
      )}
    </span>
  );
}
