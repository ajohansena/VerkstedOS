'use server';

import { revalidatePath } from 'next/cache';

import { getSessionContext } from '@/lib/auth/session';
import {
  createPurchaseOrder,
  receiveParts,
  type ReceiveLineInput,
} from '@/modules/parts/public';

type ActionResult = { ok: true } | { ok: false; error: string };

function parseQty(value: FormDataEntryValue | null): number {
  const n = Number(String(value ?? '').replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
}

/**
 * Order a single open requirement (Sprint 11, doc 11 Dashboards). Creates a
 * one-line PO via the canonical procurement service — same SSoT used by the
 * case parts panel and the Dev inspector. `parts:order` is enforced inside
 * `createPurchaseOrder`.
 */
export async function orderRequirementAction(
  formData: FormData,
): Promise<ActionResult> {
  try {
    const session = await getSessionContext();
    if (!session) return { ok: false, error: 'NOT_AUTHENTICATED' };

    const requirementId = String(formData.get('requirementId') ?? '');
    const caseId = String(formData.get('caseId') ?? '');
    const supplierId = String(formData.get('supplierId') ?? '');
    const poNumber = String(formData.get('poNumber') ?? '').trim();
    const description = String(formData.get('description') ?? '').trim();
    const quantity = parseQty(formData.get('quantity'));
    const unitPriceRaw = String(formData.get('unitPrice') ?? '').trim();

    if (!requirementId || !caseId || !supplierId || !poNumber || !description) {
      return { ok: false, error: 'MISSING_FIELDS' };
    }
    if (!(quantity > 0)) {
      return { ok: false, error: 'INVALID_QUANTITY' };
    }

    await createPurchaseOrder(session.context, {
      supplierId,
      poNumber,
      lines: [
        {
          partRequirementId: requirementId,
          caseId,
          description,
          quantity,
          ...(unitPriceRaw ? { unitPrice: unitPriceRaw } : {}),
        },
      ],
    });

    revalidatePath('/parts');
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'UNKNOWN' };
  }
}

/**
 * Receive against one or more open PO lines from the coordinator queue. The
 * caller sends `purchaseOrderId` and a JSON-encoded `lines` array of
 * `{ purchaseOrderLineId, quantityReceived }`. Calls the canonical
 * `receiveParts` service (parts:order gated).
 */
export async function receiveRequirementLinesAction(
  formData: FormData,
): Promise<ActionResult> {
  try {
    const session = await getSessionContext();
    if (!session) return { ok: false, error: 'NOT_AUTHENTICATED' };

    const purchaseOrderId = String(formData.get('purchaseOrderId') ?? '');
    const linesRaw = String(formData.get('lines') ?? '');
    if (!purchaseOrderId || !linesRaw) {
      return { ok: false, error: 'MISSING_FIELDS' };
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(linesRaw);
    } catch {
      return { ok: false, error: 'INVALID_LINES' };
    }
    if (!Array.isArray(parsed)) {
      return { ok: false, error: 'INVALID_LINES' };
    }

    const lines: ReceiveLineInput[] = [];
    for (const raw of parsed) {
      if (!raw || typeof raw !== 'object') continue;
      const obj = raw as { purchaseOrderLineId?: unknown; qty?: unknown };
      const id =
        typeof obj.purchaseOrderLineId === 'string'
          ? obj.purchaseOrderLineId
          : '';
      const qty = typeof obj.qty === 'number' ? obj.qty : Number(obj.qty);
      if (!id || !Number.isFinite(qty) || qty <= 0) continue;
      lines.push({ purchaseOrderLineId: id, quantityReceived: qty });
    }

    if (lines.length === 0) {
      return { ok: false, error: 'NO_VALID_LINES' };
    }

    await receiveParts(session.context, { purchaseOrderId, lines });

    revalidatePath('/parts');
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'UNKNOWN' };
  }
}
