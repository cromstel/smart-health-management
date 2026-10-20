import { motion, useReducedMotion } from 'motion/react';

type HeroGridLinesProps = {
  /** Number of equal columns to rule. A rule sits on the right edge of each column. */
  columns?: number;
  /** Draw the outer 1px rules at the hero edges as well as the internal columns. */
  bordered?: boolean;
  /** Keep the final rule on the right edge when the grid is not bordered. */
  trailing?: boolean;
  /** Border colour utility for every rule. */
  ruleClass?: string;
  /** Extra classes for the positioning wrapper. */
  className?: string;
};

/**
 * Animated column hairlines shared by the marketing heroes. Each rule draws
 * downward from the top once on mount, staggered left to right, then holds.
 *
 * Flat 1px rules only: a gradient mesh would be the obvious way to texture a
 * hero and the house rule forbids gradients, so the depth comes from ruled
 * structure instead.
 */
export function HeroGridLines({
  columns = 4,
  bordered = true,
  trailing = false,
  ruleClass = 'border-primary-foreground/15',
  className = '',
}: HeroGridLinesProps) {
  const reduce = useReducedMotion();

  return (
    <div
      className={`pointer-events-none absolute inset-0 -z-10 ${bordered ? `border-x ${ruleClass}` : ''} ${className}`}
      aria-hidden="true"
    >
      <div className="grid h-full w-full" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>
        {Array.from({ length: columns }, (_, index) => (
          <motion.span
            key={index}
            initial={reduce ? false : { scaleY: 0, opacity: 0 }}
            animate={{ scaleY: 1, opacity: 1 }}
            transition={reduce ? { duration: 0 } : { duration: 0.9, delay: 0.15 + index * 0.09, ease: [0.22, 1, 0.36, 1] }}
            className={`block origin-top ${ruleClass} ${trailing || index < columns - 1 ? 'border-r' : ''}`}
          />
        ))}
      </div>
    </div>
  );
}

/**
 * A single accent hairline that sweeps across the hero once on mount. Purely
 * decorative, so it is dropped entirely under reduced motion rather than being
 * shown frozen mid-sweep.
 */
export function HeroScanLine({ delay = 0.45 }: { delay?: number }) {
  const reduce = useReducedMotion();
  if (reduce) return null;

  return (
    <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden" aria-hidden="true">
      <motion.span
        initial={{ x: '-8vw', opacity: 0 }}
        animate={{ x: ['-8vw', '104vw'], opacity: [0, 0.7, 0] }}
        transition={{ duration: 1.8, delay, ease: 'easeInOut' }}
        className="absolute inset-y-0 left-0 w-px bg-accent/70"
      />
    </div>
  );
}

/**
 * A soft radar ping that sits behind a small accent dot in a hero eyebrow or
 * badge, keeping a faint sense of life without a looping spotlight. Anchored to
 * a `relative` parent; renders nothing under reduced motion.
 */
export function HeroPing({ className = '', tone = 'accent' }: { className?: string; tone?: 'accent' | 'success' }) {
  const reduce = useReducedMotion();
  if (reduce) return null;

  const ring = tone === 'success' ? 'border-success/60' : 'border-accent/60';

  return (
    <motion.span
      className={`pointer-events-none absolute inset-0 rounded-full border ${ring} ${className}`}
      initial={{ scale: 0.6, opacity: 0.6 }}
      animate={{ scale: [0.6, 2.3], opacity: [0.6, 0] }}
      transition={{ duration: 2.6, repeat: Infinity, ease: 'easeOut' }}
      aria-hidden="true"
    />
  );
}
