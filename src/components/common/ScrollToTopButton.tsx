import { useEffect, useState } from 'react';
import { ArrowUp } from 'lucide-react';
import { useReducedMotion } from 'motion/react';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';

/** How far the visitor must scroll before the control appears. */
const SCROLL_THRESHOLD = 320;

/**
 * Floating control that returns the visitor to the top of the page.
 *
 * Mounted once in `App.tsx`, so every public surface gets it without each page
 * rendering it: the marketing pages (`PublicLayout`), the account flows and the
 * tokenised shared-summary page. It withdraws for authenticated sessions, which
 * is what makes "public pages" the boundary rather than a list of paths.
 *
 * `--accent` is the only token that stays legible on every public surface — the
 * navy hero sections use `--primary`, and `--card` would disappear against it in
 * the default (dark) theme.
 */
export function ScrollToTopButton() {
  const reduceMotion = useReducedMotion();
  const { isAuthenticated, isAuthLoading } = useAuth();
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Deliberately not throttled through requestAnimationFrame: if the page is
    // occluded when this mounts, the mount-time frame may never fire and a
    // pending-frame guard would then swallow every later scroll event, leaving
    // the control permanently hidden. React already bails out when the value is
    // unchanged, so a direct update costs one comparison per scroll event.
    const update = () => {
      setIsVisible(window.scrollY > SCROLL_THRESHOLD);
    };

    update();
    window.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    return () => {
      window.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
    };
  }, []);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' });
  };

  // Nothing to do before the session resolves, and none of this applies to the
  // authenticated workspace.
  if (isAuthLoading || isAuthenticated) return null;

  return (
    <button
      type="button"
      onClick={scrollToTop}
      aria-label="Scroll to top"
      title="Scroll to top"
      className={cn(
        'fixed bottom-5 right-5 z-50 flex h-11 w-11 items-center justify-center rounded-full bg-accent text-accent-foreground shadow-lg',
        'transition-all duration-300 ease-out hover:bg-accent/90',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground focus-visible:ring-offset-2 focus-visible:ring-offset-accent',
        'motion-reduce:transition-none',
        isVisible
          ? 'translate-y-0 opacity-100'
          : 'pointer-events-none invisible translate-y-3 opacity-0'
      )}
    >
      <ArrowUp className="h-5 w-5" aria-hidden="true" />
    </button>
  );
}
