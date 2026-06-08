'use client';

import { useState, useTransition } from 'react';

import { Dialog } from '@/components/ui/dialog';
import {
  createSupplierInvoiceAction,
  addInvoiceLineAction,
  bookInvoiceAction,
} from './invoice-actions';

export interface InvoiceListItem {
  id: string;
  invoiceNumber: string;
  supplierName: string | null;
  invoiceDate: string;
  totalGross: string;
  status: string;
  currency: string;
  lineCount: number;
}

export interface SupplierOption {
  id: string;
  name: string;
}

interface InvoiceLabels {
  invoices: string;
  invoicesDescription: string;
  invoicesEmpty: string;
  receiveInvoice: string;
  invoiceNumber: string;
  invoiceSupplier: string;
  invoiceDate: string;
  invoiceDueDate: string;
  invoiceTotal: string;
  invoiceMatch: string;
  invoiceAddLine: string;
  invoiceQty: string;
  invoiceLineCase: string;
  invoiceLineDescription: string;
  invoiceUnitPrice: string;
  cancel: string;
  confirm: string;
  book: string;
}

const STATUS_STYLE: Record<string, string> = {
  draft: 'bg-slate-100 text-slate-700',
  booked: 'bg-blue-100 text-blue-700',
  matched: 'bg-emerald-100 text-emerald-700',
  credited: 'bg-amber-100 text-amber-800',
};

/**
 * Supplier invoices — lives INSIDE /parts as a right-side drawer (doc 12 §6:
 * "drawers over full-page navigation"). Lists invoices and hosts the
 * register-invoice + add-line + book flow. A single invoice can span several
 * cases; each line carries case traceability.
 */
export function InvoicesPanel({
  invoices,
  suppliers,
  labels,
}: {
  invoices: InvoiceListItem[];
  suppliers: SupplierOption[];
  labels: InvoiceLabels;
}) {
  const [open, setOpen] = useState(false);
  const [createdId, setCreatedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onCreate(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const res = await createSupplierInvoiceAction(formData);
      if (!res.ok) setError(res.error);
      else setCreatedId(res.id ?? null);
    });
  }

  function onAddLine(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const res = await addInvoiceLineAction(formData);
      if (!res.ok) setError(res.error);
    });
  }

  function onBook(invoiceId: string) {
    setError(null);
    startTransition(async () => {
      const fd = new FormData();
      fd.set('invoiceId', invoiceId);
      const res = await bookInvoiceAction(fd);
      if (!res.ok) setError(res.error);
    });
  }

  return (
    <section className="rounded-lg border bg-background shadow-sm">
      <header className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-3">
        <div>
          <h2 className="text-sm font-semibold">{labels.invoices}</h2>
          <p className="text-xs text-muted-foreground">
            {labels.invoicesDescription}
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setCreatedId(null);
            setOpen(true);
          }}
          className="inline-flex h-8 items-center rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground hover:bg-primary/90"
        >
          {labels.receiveInvoice}
        </button>
      </header>

      {invoices.length === 0 ? (
        <p className="px-4 py-6 text-sm text-muted-foreground">
          {labels.invoicesEmpty}
        </p>
      ) : (
        <ul className="divide-y">
          {invoices.map((inv) => (
            <li
              key={inv.id}
              className="flex flex-wrap items-center gap-3 px-4 py-3 text-sm"
            >
              <span className="font-mono text-xs font-medium">
                {inv.invoiceNumber}
              </span>
              <span className="flex-1 truncate text-muted-foreground">
                {inv.supplierName ?? '—'}
              </span>
              <span className="tabular-nums">
                {inv.totalGross} {inv.currency}
              </span>
              <span
                className={
                  'rounded-full px-2 py-0.5 text-[11px] ' +
                  (STATUS_STYLE[inv.status] ?? 'bg-slate-100 text-slate-700')
                }
              >
                {inv.status}
              </span>
              {inv.status === 'draft' ? (
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => onBook(inv.id)}
                  className="inline-flex h-7 items-center rounded-md border px-2 text-[11px] font-medium hover:bg-muted/40 disabled:opacity-50"
                >
                  {labels.book}
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        side="right"
        ariaLabel={labels.receiveInvoice}
      >
        <div className="space-y-5 p-5">
          <h2 className="text-lg font-semibold">{labels.receiveInvoice}</h2>
          {error ? (
            <div
              role="alert"
              className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800"
            >
              {error}
            </div>
          ) : null}

          {createdId === null ? (
            <form action={onCreate} className="space-y-3">
              <Field label={labels.invoiceSupplier}>
                <select
                  name="supplierId"
                  required
                  className="h-9 w-full rounded-md border bg-background px-2 text-sm"
                >
                  <option value="">—</option>
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label={labels.invoiceNumber}>
                <input
                  name="invoiceNumber"
                  required
                  className="h-9 w-full rounded-md border bg-background px-2 text-sm"
                />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label={labels.invoiceDate}>
                  <input
                    name="invoiceDate"
                    type="date"
                    required
                    className="h-9 w-full rounded-md border bg-background px-2 text-sm"
                  />
                </Field>
                <Field label={labels.invoiceDueDate}>
                  <input
                    name="dueDate"
                    type="date"
                    className="h-9 w-full rounded-md border bg-background px-2 text-sm"
                  />
                </Field>
              </div>
              <button
                type="submit"
                disabled={pending}
                className="inline-flex h-9 w-full items-center justify-center rounded-md bg-primary text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                {labels.confirm}
              </button>
            </form>
          ) : (
            <div className="space-y-4">
              <p className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
                {labels.invoiceNumber} ✓ — {labels.invoiceAddLine}
              </p>
              <form action={onAddLine} className="space-y-3">
                <input
                  type="hidden"
                  name="supplierInvoiceId"
                  value={createdId}
                />
                <Field label={labels.invoiceLineDescription}>
                  <input
                    name="description"
                    className="h-9 w-full rounded-md border bg-background px-2 text-sm"
                  />
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label={labels.invoiceQty}>
                    <input
                      name="quantity"
                      defaultValue="1"
                      className="h-9 w-full rounded-md border bg-background px-2 text-sm"
                    />
                  </Field>
                  <Field label={labels.invoiceUnitPrice}>
                    <input
                      name="unitPriceNet"
                      defaultValue="0"
                      className="h-9 w-full rounded-md border bg-background px-2 text-sm"
                    />
                  </Field>
                </div>
                <Field label={labels.invoiceLineCase}>
                  <input
                    name="caseId"
                    placeholder="UUID"
                    className="h-9 w-full rounded-md border bg-background px-2 text-xs"
                  />
                </Field>
                <button
                  type="submit"
                  disabled={pending}
                  className="inline-flex h-9 w-full items-center justify-center rounded-md border text-sm font-medium hover:bg-muted/40 disabled:opacity-50"
                >
                  {labels.invoiceAddLine}
                </button>
              </form>
            </div>
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
    </section>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block space-y-1">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}
