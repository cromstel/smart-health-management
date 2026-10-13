import { ShieldCheck } from 'lucide-react';

/**
 * Global system-author badge embedded on every authentication form card.
 * Value sourced from the single SYSTEM_AUTHOR constant below — change it
 * once here rather than per-page.
 */
const SYSTEM_AUTHOR = 'CITGROUP';

export default function SystemAuthorBadge() {
  return (
    <div
      className="flex items-center justify-center gap-1.5 text-[10px] font-mono font-semibold
                 text-muted-foreground/70 uppercase tracking-wider"
      aria-label={`System author ${SYSTEM_AUTHOR}`}
    >
      <ShieldCheck className="h-3 w-3 text-muted-foreground/60" aria-hidden="true" />
      <span>POWERED BY: </span>
      <a href="https://cromstelit.com" target="_blank" rel="noopener noreferrer" className="hover:text-foreground underline-offset-2 hover:underline transition-colors">{SYSTEM_AUTHOR}</a>
    </div>
  );
}
