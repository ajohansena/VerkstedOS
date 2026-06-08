'use client';

import { useState, useTransition } from 'react';

import { renameWorkflowStateAction } from '../admin-actions';

interface StateRow {
  id: string;
  label: string;
  category: string;
  sequenceNo: number;
  isInitial: boolean;
}

const CATEGORY_COLOR: Record<string, string> = {
  active: 'bg-emerald-100 text-emerald-700',
  waiting: 'bg-amber-100 text-amber-700',
  terminal: 'bg-slate-100 text-slate-500',
};

/**
 * /admin/workflow editor (Sprint 14 Track G). The states are ordered by
 * sequenceNo and each label is inline-editable (rename → server action,
 * `admin:config` gated). Reordering and side-effects remain a later iteration;
 * rename is the highest-value first step.
 */
export function WorkflowStatesEditor({
  states,
  labels,
}: {
  states: StateRow[];
  labels: { save: string; saved: string; initial: string };
}) {
  const [pending, startTransition] = useTransition();
  const [savedId, setSavedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function onRename(formData: FormData) {
    setError(null);
    setSavedId(null);
    const stateId = String(formData.get('stateId') ?? '');
    startTransition(async () => {
      const res = await renameWorkflowStateAction(formData);
      if (res.ok) setSavedId(stateId);
      else setError(res.error);
    });
  }

  return (
    <div className="space-y-3">
      {error ? (
        <div
          role="alert"
          className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800"
        >
          {error}
        </div>
      ) : null}
      <ol className="divide-y rounded-lg border bg-background shadow-sm">
        {states.map((s) => (
          <li key={s.id} className="px-4 py-2.5">
            <form
              action={onRename}
              className="flex flex-wrap items-center gap-2"
            >
              <input type="hidden" name="stateId" value={s.id} />
              <span className="w-6 shrink-0 text-xs tabular-nums text-muted-foreground">
                {s.sequenceNo}
              </span>
              <input
                name="label"
                defaultValue={s.label}
                className="h-8 flex-1 rounded-md border bg-background px-2 text-sm"
              />
              <span
                className={
                  'shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ' +
                  (CATEGORY_COLOR[s.category] ?? 'bg-slate-100 text-slate-600')
                }
              >
                {s.category}
              </span>
              {s.isInitial ? (
                <span className="shrink-0 text-[11px] text-muted-foreground">
                  {labels.initial}
                </span>
              ) : null}
              <button
                type="submit"
                disabled={pending}
                className="inline-flex h-8 shrink-0 items-center rounded-md border px-2.5 text-xs font-medium hover:bg-muted/40 disabled:opacity-50"
              >
                {labels.save}
              </button>
              {savedId === s.id ? (
                <span className="text-xs text-emerald-600">{labels.saved}</span>
              ) : null}
            </form>
          </li>
        ))}
      </ol>
    </div>
  );
}
