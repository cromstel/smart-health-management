import { motion, useReducedMotion } from 'motion/react';
import { useEffect, useState } from 'react';

export function ScrollProgress() {
  const [progress, setProgress] = useState(0);
  const prefersReduced = useReducedMotion();

  useEffect(() => {
    const onScroll = () => {
      const scrollTop = window.scrollY || document.documentElement.scrollTop;
      const docHeight = document.documentElement.scrollHeight - document.documentElement.clientHeight;
      setProgress(docHeight > 0 ? (scrollTop / docHeight) * 100 : 0);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <div
      role="progressbar"
      aria-label="Page scroll progress"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(progress)}
      className="fixed top-0 left-0 z-[60] h-[3px] w-full bg-transparent"
    >
      <motion.div
        className="h-full bg-[var(--sea-blue)] origin-left"
        style={{ scaleX: progress / 100 }}
        transition={prefersReduced ? { duration: 0 } : { duration: 0.1, ease: 'easeOut' }}
      />
    </div>
  );
}
