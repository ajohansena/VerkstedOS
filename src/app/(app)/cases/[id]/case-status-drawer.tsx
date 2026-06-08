'use client';

import { useState } from 'react';
import { Dialog } from '@/components/ui/dialog';
import { transitionAction } from '@/app/actions/production';

interface DrawerLabels {
  changeStatus: string;
  cancel: string;
  confirm: string;
  reason: string;
  reasonOptional: string;
  newStatus: string;
}

/**
 * Case Workspace → status change drawer. Renders the existing
 * `transitionAction` server form inside a right-side Dialog (doc 12 §6 —
 * "drawers over full-page navigation"). Available transitions are computed
 * server-side and passed in; the drawer just lists the candidates.
 */
export function CaseStatusDrawer({
  caseId,
  available,
  labels,
}: {
  caseId: string;
  available: { id: string; code: string; label: string }[];
  labels: DrawerLabels;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        disabled={available.length === 0}
        className="inline-flex h-9 w-full items-center justify-center rounded-md border bg-primary px-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {labels.changeStatus}
      </button>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        side="right"
        ariaLabel={labels.changeStatus}
      >
        <div className="space-y-4 p-5">
          <h2 className="text-lg font-semibold">{labels.changeStatus}</h2>
          {available.length === 0 ? (
            <p className="text-sm text-muted-foreground">—</p>
          ) : (
            <ul className="divide-y rounded-md border">
              {available.map((s) => (
                <li key={s.id}>
                  <form action={transitionAction}>
                    <input type="hidden" name="caseId" value={caseId} />
                    <input type="hidden" name="toStateCode" value={s.code} />
                    <div className="flex items-center gap-2 p-3">
                      <span className="flex-1 truncate text-sm font-medium">
                        {s.label}
                      </span>
                      <input
                        name="reason"
                        placeholder={labels.reasonOptional}
                        className="h-8 w-44 rounded-md border bg-background px-2 text-xs"
                      />
                      <button
                        type="submit"
                        className="inline-flex h-8 items-center rounded-md bg-foreground px-3 text-xs font-medium text-background hover:opacity-90"
                      >
                        {labels.confirm}
                      </button>
                    </div>
                  </form>
                </li>
              ))}
            </ul>
          )}
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="w-full text-xs text-muted-foreground hover:underline"
          >
            {labels.cancel}
          </button>
        </div>
      </Dialog>
    </>
  );
}
