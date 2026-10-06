import type { ReactNode } from 'react';
import type { LegendPayload } from 'recharts';

/**
 * Legend renderer for the vitals trend charts.
 *
 * Recharts reuses a series' stroke colour as its legend LABEL colour. That is
 * fine for a 3px line and wrong for 16px text: the `--chart-N` tokens are tuned
 * for marks, and measured against a light surface they gave
 * `--chart-4` 3.19:1 and `--chart-5` 3.30:1, under the 4.5:1 AA threshold for
 * body text.
 *
 * The swatch already carries series identity, so the label does not need to be
 * colour-coded. This keeps the colour as an identifier and gives the words a
 * readable token instead.
 */
export function chartLegendContent({
  payload,
}: {
  payload?: ReadonlyArray<LegendPayload>;
}): ReactNode {
  const entries = payload ?? [];
  if (entries.length === 0) return null;

  return (
    <ul className="flex flex-wrap items-center gap-x-4 gap-y-1 pt-2 text-xs text-muted-foreground">
      {entries.map((entry, index) => (
        <li key={`${String(entry.dataKey ?? entry.value)}-${index}`} className="flex items-center gap-1.5">
          <span
            aria-hidden="true"
            className="h-2 w-2 shrink-0 rounded-full ring-1 ring-border"
            style={{ backgroundColor: entry.color }}
          />
          <span>{entry.value}</span>
        </li>
      ))}
    </ul>
  );
}