'use client';

import { useState, useTransition } from 'react';

import {
  approveInvoiceBasisAction,
  cancelInvoiceBasisAction,
  generateInvoiceBasisAction,
} from '@/app/(app)/finance/finance-actions';

export interface CaseBasisRow {
  id: string;
  basisNumber: string;
  payerType: string;
  kind: string;
  netAmount: string;
  vatAmount: string;
  grossAmount: string;
  currency: string;
  status: string;
}

interface Labels {
  caseTitle: string;
  caseDescription: string;
  generate: string;
  generateHint: string;
  approve: string;
  cancel: string;
  noBasis: string;
  regenerateHint: string;
  basisNumber: string;
  payer: string;
  kind: string;
  net: string;
  vat: string;
  gross: string;
  status: string;
  kindStandard: string;
  kindDeductible: string;
  kindInternal: string;
  statusDraft: string;
  statusApproved: string;
  statusExported: string;
  statusSettled: string;
  statusCancelled: string;
}

const STATUS_STYLE: Record<string, string> = {
  draft: 'bg-slate-100 text-slate-700',
  approved: 'bg-blue-100 text-blue-700',
  exported: 'bg-emerald-100 text-emerald-700',
  settled: 'bg-green-100 text-green-700',
  cancelled: 'bg-red-100 text-red-700',
};

/**
 * Case Workspace finance section (Sprint 15). Generates invoice bases from the
 * locked estimate (one per active funding source + the deductible split),
 * approves them, and cancels them. Mirrors the doc-12 "act in place" pattern.
 */
export function CaseFinanceSection({
  caseId,
  bases,
  labels,
}: {
  caseId: string;
  bases: CaseBasisRow[];
  labels: Labels;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const hasActive = bases.some((b) => b.status !== 'cancelled');

  function kindLabel(kind: string): string {
    if (kind === 'deductible') return labels.kindDeductible;
    if (kind === 'internal') return labels.kindInternal;
    return labels.kindStandard;
  }
  function statusLabel(status: string): string {
    if (status === 'approved') return labels.statusApproved;
    if (status === 'exported') return labels.statusExported;
    if (status === 'settled') return labels.statusSettled;
    if (status === 'cancelled') return labels.statusCancelled;
    return labels.statusDraft;
  }

  function run(
    action: (fd: FormData) => Promise<{ ok: boolean; error?: string }>,
    fd: FormData,
  ) {
    setError(null);
    startTransition(async () => {
      const res = await action(fd);
      if (!res.ok) setError(res.error ?? 'ERROR');
    });
  }

  return (
    <section className="space-y-3 rounded-lg border bg-background p-4 shadow-sm">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold">{labels.caseTitle}</h2>
          <p className="text-xs text-muted-foreground">
            {labels.caseDescription}
          </p>
        </div>
        {!hasActive ? (
          <button
            type="button"
            disabled={pending}
            onClick={() => {
              const fd = new FormData();
              fd.set('caseId', caseId);
              run(generateInvoiceBasisAction, fd);
            }}
            className="inline-flex h-8 items-center rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            title={labels.generateHint}
          >
            {labels.generate}
          </button>
        ) : null}
      </header>

      {error ? (
        <div
          role="alert"
          className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800"
        >
          {error}
        </div>
      ) : null}

      {bases.length === 0 ? (
        <p className="text-sm text-muted-foreground">{labels.noBasis}</p>
      ) : (
        <ul className="divide-y rounded-md border">
          {bases.map((b) => (
            <li
              key={b.id}
              className="flex flex-wrap items-center gap-3 px-3 py-2 text-sm"
            >
              <span className="font-mono text-xs font-medium">
                {b.basisNumber}
              </span>
              <span className="text-xs text-muted-foreground">
                {b.payerType}
              </span>
              <span className="rounded bg-muted px-1.5 py-0.5 text-[11px]">
                {kindLabel(b.kind)}
              </span>
              <span className="ml-auto tabular-nums">
                {b.grossAmount} {b.currency}
              </span>
              <span
                className={
                  'rounded-full px-2 py-0.5 text-[11px] font-medium ' +
                  (STATUS_STYLE[b.status] ?? 'bg-slate-100 text-slate-700')
                }
              >
                {statusLabel(b.status)}
              </span>
              {b.status === 'draft' ? (
                <>
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => {
                      const fd = new FormData();
                      fd.set('basisId', b.id);
                      fd.set('caseId', caseId);
                      run(approveInvoiceBasisAction, fd);
                    }}
                    className="inline-flex h-7 items-center rounded-md border px-2 text-[11px] font-medium hover:bg-muted/40 disabled:opacity-50"
                  >
                    {labels.approve}
                  </button>
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => {
                      const fd = new FormData();
                      fd.set('basisId', b.id);
                      fd.set('caseId', caseId);
                      fd.set('reason', 'manual');
                      run(cancelInvoiceBasisAction, fd);
                    }}
                    className="inline-flex h-7 items-center rounded-md border px-2 text-[11px] font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
                  >
                    {labels.cancel}
                  </button>
                </>
              ) : null}
            </li>
          ))}
        </ul>
      )}
      {hasActive ? (
        <p className="text-[11px] text-muted-foreground">
          {labels.regenerateHint}
        </p>
      ) : null}
    </section>
  );
}
