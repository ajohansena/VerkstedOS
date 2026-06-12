'use client';

import { useMemo, useState, useTransition } from 'react';

import { Dialog } from '@/components/ui/dialog';

import { receiveRequirementLinesAction } from './requirement-actions';

export interface ReceiveRequirementCellLabels {
  receive: string;
  receivedQty: string;
  invoiceQty: string;
  cancel: string;
  confirm: string;
  noOpenPoLines: string;
  poNumber: string;
}

export interface ReceivablePoLine {
  poLineId: string;
  purchaseOrderId: string;
  poNumber: string;
  supplierName: string | null;
  description: string;
  quantityOrdered: string;
  quantityReceived: string;
}

/**
 * Inline "Receive" action on the parts coordinator queue. Drawer shows the
 * open PO lines for one requirement and lets the coordinator enter received
 * quantities per line. Always posts back to the canonical `receiveParts`
 * service (lifecycle event + requirement status advance happen there — SSoT).
 *
 * Multi-line per requirement is rare (usually 1 PO line per requirement), but
 * supported because the spine allows it.
 */
export function ReceiveRequirementCell({
  poLines,
  labels,
}: {
  poLines: ReceivablePoLine[];
  labels: ReceiveRequirementCellLabels;
}) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [qtyByLine, setQtyByLine] = useState<Record<string, string>>({});
  const [pending, startTransition] = useTransition();

  // Group lines by PO header (a requirement can be on lines of more than one
  // PO if it was partially ordered then re-ordered — keep it visible).
  const groups = useMemo(() => {
    const m = new Map<
      string,
      {
        purchaseOrderId: string;
        poNumber: string;
        supplierName: string | null;
        lines: ReceivablePoLine[];
      }
    >();
    for (const l of poLines) {
      const g = m.get(l.purchaseOrderId);
      if (g) g.lines.push(l);
      else
        m.set(l.purchaseOrderId, {
          purchaseOrderId: l.purchaseOrderId,
          poNumber: l.poNumber,
          supplierName: l.supplierName,
          lines: [l],
        });
    }
    return Array.from(m.values());
  }, [poLines]);

  function onSubmitGroup(purchaseOrderId: string) {
    setError(null);
    const lines = groups
      .find((g) => g.purchaseOrderId === purchaseOrderId)
      ?.lines.map((l) => ({
        purchaseOrderLineId: l.poLineId,
        qty: Number(String(qtyByLine[l.poLineId] ?? '').replace(',', '.')),
      }))
      .filter((l) => Number.isFinite(l.qty) && l.qty > 0);

    if (!lines || lines.length === 0) {
      setError('NO_VALID_LINES');
      return;
    }

    startTransition(async () => {
      const fd = new FormData();
      fd.set('purchaseOrderId', purchaseOrderId);
      fd.set('lines', JSON.stringify(lines));
      const res = await receiveRequirementLinesAction(fd);
      if (!res.ok) setError(res.error);
      else {
        setOpen(false);
        setQtyByLine({});
      }
    });
  }

  if (poLines.length === 0) {
    return null;
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setError(null);
          setQtyByLine({});
          setOpen(true);
        }}
        className="inline-flex h-7 items-center rounded-md border px-2 text-[11px] font-medium hover:bg-muted/40"
      >
        {labels.receive}
      </button>

      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        side="right"
        ariaLabel={labels.receive}
      >
        <div className="space-y-5 p-5">
          <h2 className="text-lg font-semibold">{labels.receive}</h2>
          {error ? (
            <div
              role="alert"
              className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800"
            >
              {error}
            </div>
          ) : null}

          {groups.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {labels.noOpenPoLines}
            </p>
          ) : (
            groups.map((g) => {
              const outstandingTotal = g.lines.reduce(
                (acc, l) =>
                  acc +
                  Math.max(
                    0,
                    Number(l.quantityOrdered) - Number(l.quantityReceived),
                  ),
                0,
              );
              return (
                <div
                  key={g.purchaseOrderId}
                  className="space-y-2 rounded-md border p-3"
                >
                  <div className="flex items-baseline justify-between text-xs">
                    <span className="font-medium">
                      {labels.poNumber}: {g.poNumber}
                    </span>
                    <span className="text-muted-foreground">
                      {g.supplierName ?? '—'}
                    </span>
                  </div>
                  <ul className="space-y-2">
                    {g.lines.map((l) => {
                      const outstanding = Math.max(
                        0,
                        Number(l.quantityOrdered) - Number(l.quantityReceived),
                      );
                      return (
                        <li
                          key={l.poLineId}
                          className="flex items-center gap-2 text-xs"
                        >
                          <span className="flex-1 truncate">
                            {l.description}
                          </span>
                          <span className="tabular-nums text-muted-foreground">
                            {l.quantityReceived}/{l.quantityOrdered}
                          </span>
                          <input
                            type="text"
                            inputMode="decimal"
                            placeholder={labels.invoiceQty}
                            defaultValue={
                              outstanding > 0 ? String(outstanding) : ''
                            }
                            onChange={(e) =>
                              setQtyByLine((prev) => ({
                                ...prev,
                                [l.poLineId]: e.target.value,
                              }))
                            }
                            className="h-7 w-16 rounded-md border bg-background px-2 text-xs"
                          />
                        </li>
                      );
                    })}
                  </ul>
                  <button
                    type="button"
                    onClick={() => onSubmitGroup(g.purchaseOrderId)}
                    disabled={pending || outstandingTotal <= 0}
                    className="inline-flex h-8 w-full items-center justify-center rounded-md bg-primary text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                  >
                    {labels.confirm}
                  </button>
                </div>
              );
            })
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
