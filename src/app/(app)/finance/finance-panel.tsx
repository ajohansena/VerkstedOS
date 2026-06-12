'use client';

import { useState, useTransition } from 'react';

import { formatDateTime, type Locale } from '@/lib/i18n';

import {
  exportApprovedBasesAction,
  retryExportAction,
} from './finance-actions';

export interface ApprovedBasisRow {
  id: string;
  basisNumber: string;
  payerType: string;
  kind: string;
  netAmount: string;
  vatAmount: string;
  grossAmount: string;
  currency: string;
}

export interface ExportRow {
  id: string;
  status: string;
  target: string;
  requestedAt: string;
  externalRef: string | null;
  attemptCount: number;
  errorMessage: string | null;
}

interface Labels {
  approvedTitle: string;
  approvedDescription: string;
  approvedEmpty: string;
  exportsTitle: string;
  exportsDescription: string;
  exportsEmpty: string;
  exportAll: string;
  retry: string;
  basisNumber: string;
  payer: string;
  kind: string;
  net: string;
  vat: string;
  gross: string;
  status: string;
  target: string;
  requestedAt: string;
  externalRef: string;
  attempts: string;
  tripletexNotConfigured: string;
  kindStandard: string;
  kindDeductible: string;
  kindInternal: string;
  statusPending: string;
  statusSent: string;
  statusFailed: string;
  statusAcknowledged: string;
}

const EXPORT_STATUS_STYLE: Record<string, string> = {
  pending: 'bg-slate-100 text-slate-700',
  sent: 'bg-blue-100 text-blue-700',
  acknowledged: 'bg-emerald-100 text-emerald-700',
  failed: 'bg-red-100 text-red-700',
};

export function FinancePanel({
  approved,
  exports,
  tripletexConfigured,
  locale,
  labels,
}: {
  approved: ApprovedBasisRow[];
  exports: ExportRow[];
  tripletexConfigured: boolean;
  locale: Locale;
  labels: Labels;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function kindLabel(kind: string): string {
    if (kind === 'deductible') return labels.kindDeductible;
    if (kind === 'internal') return labels.kindInternal;
    return labels.kindStandard;
  }
  function exportStatusLabel(status: string): string {
    if (status === 'sent') return labels.statusSent;
    if (status === 'acknowledged') return labels.statusAcknowledged;
    if (status === 'failed') return labels.statusFailed;
    return labels.statusPending;
  }

  function onExportAll() {
    setError(null);
    startTransition(async () => {
      const res = await exportApprovedBasesAction(new FormData());
      if (!res.ok) setError(res.error);
    });
  }

  function onRetry(exportId: string) {
    setError(null);
    startTransition(async () => {
      const fd = new FormData();
      fd.set('exportId', exportId);
      const res = await retryExportAction(fd);
      if (!res.ok) setError(res.error);
    });
  }

  return (
    <div className="space-y-6">
      {error ? (
        <div
          role="alert"
          className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800"
        >
          {error}
        </div>
      ) : null}

      {!tripletexConfigured ? (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          {labels.tripletexNotConfigured}
        </div>
      ) : null}

      {/* Approved bases ready to export */}
      <section className="rounded-lg border bg-background shadow-sm">
        <header className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-3">
          <div>
            <h2 className="text-sm font-semibold">{labels.approvedTitle}</h2>
            <p className="text-xs text-muted-foreground">
              {labels.approvedDescription}
            </p>
          </div>
          <button
            type="button"
            disabled={pending || approved.length === 0}
            onClick={onExportAll}
            className="inline-flex h-8 items-center rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {labels.exportAll}
          </button>
        </header>
        {approved.length === 0 ? (
          <p className="px-4 py-6 text-sm text-muted-foreground">
            {labels.approvedEmpty}
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="px-4 py-2 font-medium">{labels.basisNumber}</th>
                <th className="px-4 py-2 font-medium">{labels.payer}</th>
                <th className="px-4 py-2 font-medium">{labels.kind}</th>
                <th className="px-4 py-2 text-right font-medium">
                  {labels.net}
                </th>
                <th className="px-4 py-2 text-right font-medium">
                  {labels.vat}
                </th>
                <th className="px-4 py-2 text-right font-medium">
                  {labels.gross}
                </th>
              </tr>
            </thead>
            <tbody>
              {approved.map((b) => (
                <tr key={b.id} className="border-b last:border-0">
                  <td className="px-4 py-2 font-mono text-xs">
                    {b.basisNumber}
                  </td>
                  <td className="px-4 py-2 text-muted-foreground">
                    {b.payerType}
                  </td>
                  <td className="px-4 py-2">{kindLabel(b.kind)}</td>
                  <td className="px-4 py-2 text-right tabular-nums">
                    {b.netAmount}
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums">
                    {b.vatAmount}
                  </td>
                  <td className="px-4 py-2 text-right font-medium tabular-nums">
                    {b.grossAmount} {b.currency}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {/* Immutable export log */}
      <section className="rounded-lg border bg-background shadow-sm">
        <header className="border-b px-4 py-3">
          <h2 className="text-sm font-semibold">{labels.exportsTitle}</h2>
          <p className="text-xs text-muted-foreground">
            {labels.exportsDescription}
          </p>
        </header>
        {exports.length === 0 ? (
          <p className="px-4 py-6 text-sm text-muted-foreground">
            {labels.exportsEmpty}
          </p>
        ) : (
          <ul className="divide-y">
            {exports.map((e) => (
              <li
                key={e.id}
                className="flex flex-wrap items-center gap-3 px-4 py-2.5 text-sm"
              >
                <span
                  className={
                    'rounded-full px-2 py-0.5 text-[11px] font-medium ' +
                    (EXPORT_STATUS_STYLE[e.status] ??
                      'bg-slate-100 text-slate-700')
                  }
                >
                  {exportStatusLabel(e.status)}
                </span>
                <span className="text-xs uppercase tracking-wide text-muted-foreground">
                  {e.target}
                </span>
                <span className="text-xs text-muted-foreground">
                  {formatDateTime(e.requestedAt, locale)}
                </span>
                {e.externalRef ? (
                  <span className="font-mono text-xs">{e.externalRef}</span>
                ) : null}
                <span className="text-[11px] text-muted-foreground">
                  {labels.attempts}: {e.attemptCount}
                </span>
                {e.errorMessage ? (
                  <span className="truncate text-xs text-red-600">
                    {e.errorMessage}
                  </span>
                ) : null}
                {e.status === 'failed' ? (
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => onRetry(e.id)}
                    className="ml-auto inline-flex h-7 items-center rounded-md border px-2 text-[11px] font-medium hover:bg-muted/40 disabled:opacity-50"
                  >
                    {labels.retry}
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
