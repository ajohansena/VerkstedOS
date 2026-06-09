'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';

/**
 * Production Board v3 mode toggle (doc 13 §3). One engine, five
 * visualizations. The mode is a query param so each view is server-rendered
 * with its own data fetch — no client cache to invalidate, no layout shift on
 * mode switch.
 */
export type BoardMode = 'board' | 'day' | 'week' | 'resource' | 'mytasks';

const MODES: BoardMode[] = ['board', 'day', 'week', 'resource', 'mytasks'];

export function ModeTabs({
  current,
  labels,
}: {
  current: BoardMode;
  labels: Record<BoardMode, string>;
}) {
  const pathname = usePathname();
  const search = useSearchParams();

  const hrefFor = (mode: BoardMode): string => {
    const params = new URLSearchParams(search?.toString() ?? '');
    if (mode === 'board') {
      params.delete('mode');
    } else {
      params.set('mode', mode);
    }
    const qs = params.toString();
    return qs ? `${pathname}?${qs}` : pathname;
  };

  return (
    <nav
      role="tablist"
      aria-label="Visning"
      className="inline-flex items-center gap-1 rounded-md border bg-background p-1"
    >
      {MODES.map((mode) => {
        const active = current === mode;
        return (
          <Link
            key={mode}
            href={hrefFor(mode)}
            role="tab"
            aria-selected={active}
            className={`rounded px-3 py-1 text-sm transition-colors ${
              active
                ? 'bg-foreground text-background'
                : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground'
            }`}
          >
            {labels[mode]}
          </Link>
        );
      })}
    </nav>
  );
}
