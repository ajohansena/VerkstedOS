'use client';

import { useState, useTransition } from 'react';

import { Dialog } from '@/components/ui/dialog';

import { orderRequirementAction } from './requirement-actions';

export interface OrderRequirementCellLabels {
  order: string;
  poNumber: string;
  invoiceSupplier: string;
  invoiceLineDescription: string;
  invoiceQty: string;
  invoiceUnitPrice: string;
  cancel: string;
  confirm: string;
}

export interface OrderRequirementSupplier {
  id: string;
  name: string;
}

/**
 * Inline "Order" action on the parts coordinator queue (Sprint 11 + doc 11
 * Dashboards). Opens a right-side drawer that creates a one-line PO via the
 * canonical procurement service. Per doc 12 §6 ("drawers over full-page
 * navigation").
 */
export function OrderRequirementCell({
  requirementId,
  caseId,
  description,
  defaultQuantity,
  suppliers,
  labels,
}: {
  requirementId: string;
  caseId: string;
  description: string;
  defaultQuantity: string;
  suppliers: OrderRequirementSupplier[];
  labels: OrderRequirementCellLabels;
}) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const res = await orderRequirementAction(formData);
      if (!res.ok) setError(res.error);
      else setOpen(false);
    });
  }

  const defaultPoNumber = `PO-${formatStamp(new Date())}`;

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setError(null);
          setOpen(true);
        }}
        disabled={suppliers.length === 0}
        title={suppliers.length === 0 ? 'No suppliers configured' : undefined}
        className="inline-flex h-7 items-center rounded-md border px-2 text-[11px] font-medium hover:bg-muted/40 disabled:opacity-50"
      >
        {labels.order}
      </button>

      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        side="right"
        ariaLabel={labels.order}
      >
        <form action={onSubmit} className="space-y-4 p-5">
          <h2 className="text-lg font-semibold">{labels.order}</h2>
          {error ? (
            <div
              role="alert"
              className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800"
            >
              {error}
            </div>
          ) : null}

          <input type="hidden" name="requirementId" value={requirementId} />
          <input type="hidden" name="caseId" value={caseId} />

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

          <Field label={labels.poNumber}>
            <input
              name="poNumber"
              required
              defaultValue={defaultPoNumber}
              className="h-9 w-full rounded-md border bg-background px-2 text-sm"
            />
          </Field>

          <Field label={labels.invoiceLineDescription}>
            <input
              name="description"
              required
              defaultValue={description}
              className="h-9 w-full rounded-md border bg-background px-2 text-sm"
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label={labels.invoiceQty}>
              <input
                name="quantity"
                required
                inputMode="decimal"
                defaultValue={defaultQuantity}
                className="h-9 w-full rounded-md border bg-background px-2 text-sm"
              />
            </Field>
            <Field label={labels.invoiceUnitPrice}>
              <input
                name="unitPrice"
                inputMode="decimal"
                placeholder="0"
                className="h-9 w-full rounded-md border bg-background px-2 text-sm"
              />
            </Field>
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="inline-flex h-9 flex-1 items-center justify-center rounded-md border text-sm font-medium hover:bg-muted/40"
            >
              {labels.cancel}
            </button>
            <button
              type="submit"
              disabled={pending}
              className="inline-flex h-9 flex-1 items-center justify-center rounded-md bg-primary text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {labels.confirm}
            </button>
          </div>
        </form>
      </Dialog>
    </>
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
    <label className="block text-xs">
      <span className="mb-1 block text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

function formatStamp(d: Date): string {
  const pad = (n: number) => n.toString().padStart(2, '0');
  return (
    d.getFullYear().toString() +
    pad(d.getMonth() + 1) +
    pad(d.getDate()) +
    '-' +
    pad(d.getHours()) +
    pad(d.getMinutes())
  );
}
