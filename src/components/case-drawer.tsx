'use client';

import { ExternalLink } from 'lucide-react';
import Link from 'next/link';
import { type MouseEvent, type ReactNode, useCallback, useState } from 'react';

import { Dialog } from '@/components/ui/dialog';

export interface CaseDrawerLabels {
  /** Drawer header — e.g. "Sak 4711". */
  title: string;
  /** Open-full link in the drawer header. */
  openFull: string;
}

/**
 * Case Workspace drawer (doc 13 §7). Wraps any clickable card / row and opens
 * the canonical Case Workspace inside a right-side drawer instead of
 * navigating away. Cmd/Ctrl/middle-click still navigate to the full page so
 * the manager can opt into a deep-dive.
 *
 * The drawer iframe points at /embed/cases/[id] — the same page module as
 * /cases/[id] but rendered inside the thin embed layout (no sidebar, no
 * topbar). SSoT preserved — no duplicate Case Workspace.
 */
export function CaseDrawer({
  caseId,
  caseHref,
  trigger,
  labels,
  className,
}: {
  caseId: string;
  /** Full-page href for the case (also used as Cmd+Click fallback). */
  caseHref: string;
  /** Visual content of the click target (card body, row, etc.). */
  trigger: ReactNode;
  labels: CaseDrawerLabels;
  className?: string;
}) {
  const [open, setOpen] = useState(false);

  const handleClick = useCallback((event: MouseEvent<HTMLAnchorElement>) => {
    // Honour native middle-click / Cmd/Ctrl-click → open in new tab / nav
    // to full page. Only intercept primary plain clicks for the drawer.
    if (
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    ) {
      return;
    }
    event.preventDefault();
    setOpen(true);
  }, []);

  return (
    <>
      <Link
        href={caseHref}
        onClick={handleClick}
        className={className ?? 'block'}
      >
        {trigger}
      </Link>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        side="right"
        ariaLabel={labels.title}
        className="!max-w-4xl"
      >
        <div className="flex h-full flex-col">
          <div className="flex items-center gap-3 border-b px-4 py-3 pr-12">
            <div className="text-sm font-semibold">{labels.title}</div>
            <Link
              href={caseHref}
              className="ml-auto inline-flex items-center gap-1 text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
            >
              {labels.openFull}
              <ExternalLink className="h-3 w-3" aria-hidden="true" />
            </Link>
          </div>
          <iframe
            key={caseId}
            src={`/embed/cases/${caseId}`}
            title={labels.title}
            className="h-full w-full flex-1 border-0"
          />
        </div>
      </Dialog>
    </>
  );
}
