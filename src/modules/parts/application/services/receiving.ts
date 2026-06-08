import { and, eq } from 'drizzle-orm';

import { withTransaction } from '@/db/client';
import { recordAuditEvent } from '@/lib/audit/audit-writer';
import { emitEvent } from '@/lib/events/outbox';
import { partReceiptLines } from '@/db/schemas/parts/part-receipt-lines';
import { partReceipts } from '@/db/schemas/parts/part-receipts';
import { partRequirements } from '@/db/schemas/parts/part-requirements';
import { purchaseOrderLines } from '@/db/schemas/parts/purchase-order-lines';
import { purchaseOrders } from '@/db/schemas/parts/purchase-orders';
import type { PartReceipt } from '@/db/types';
import type { RequestContext } from '@/lib/tenancy/context';
import { requirePermission } from '@/modules/identity/public';

import { appendLifecycleEvent } from './lifecycle';

/**
 * Receiving — record a delivery against a purchase order
 * (docs/03-data-model.md). Updates each PO line's quantity_received and line
 * status, advances the part requirement toward received/fulfilled, and appends
 * a `received` lifecycle event. `parts:order` required.
 */

export interface ReceiveLineInput {
  purchaseOrderLineId: string;
  quantityReceived: number;
}

export interface ReceivePartsInput {
  purchaseOrderId: string;
  lines: ReceiveLineInput[];
  note?: string;
}

export async function receiveParts(
  ctx: RequestContext,
  input: ReceivePartsInput,
): Promise<PartReceipt> {
  await requirePermission(ctx, 'parts:order');

  return withTransaction(ctx, async (tx) => {
    const insertedReceipt = await tx
      .insert(partReceipts)
      .values({
        organizationId: ctx.organizationId,
        purchaseOrderId: input.purchaseOrderId,
        receivedByUserId: ctx.userId,
        note: input.note ?? null,
        createdBy: ctx.userId,
        updatedBy: ctx.userId,
      })
      .returning();
    const receipt = insertedReceipt[0];
    if (!receipt) throw new Error('Failed to create part receipt');

    for (const line of input.lines) {
      const poLineRows = await tx
        .select()
        .from(purchaseOrderLines)
        .where(
          and(
            eq(purchaseOrderLines.id, line.purchaseOrderLineId),
            eq(purchaseOrderLines.organizationId, ctx.organizationId),
          ),
        )
        .limit(1);
      const poLine = poLineRows[0];
      if (!poLine) throw new Error('PO_LINE_NOT_FOUND');

      await tx.insert(partReceiptLines).values({
        organizationId: ctx.organizationId,
        partReceiptId: receipt.id,
        purchaseOrderLineId: poLine.id,
        partRequirementId: poLine.partRequirementId,
        quantityReceived: String(line.quantityReceived),
        createdBy: ctx.userId,
        updatedBy: ctx.userId,
      });

      // Update the PO line's received quantity + status.
      const newReceived =
        Number(poLine.quantityReceived) + line.quantityReceived;
      const ordered = Number(poLine.quantityOrdered);
      const lineStatus =
        newReceived >= ordered ? 'received' : 'partially_received';
      await tx
        .update(purchaseOrderLines)
        .set({
          quantityReceived: String(newReceived),
          status: lineStatus,
          updatedBy: ctx.userId,
          updatedAt: new Date(),
        })
        .where(eq(purchaseOrderLines.id, poLine.id));

      // Advance the requirement.
      if (poLine.partRequirementId && poLine.caseId) {
        const reqStatus =
          newReceived >= ordered ? 'received' : 'partially_received';
        await tx
          .update(partRequirements)
          .set({
            status: reqStatus,
            updatedBy: ctx.userId,
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(partRequirements.id, poLine.partRequirementId),
              eq(partRequirements.organizationId, ctx.organizationId),
            ),
          );

        await appendLifecycleEvent(tx, ctx, {
          partRequirementId: poLine.partRequirementId,
          caseId: poLine.caseId,
          kind: 'received',
          detail: { quantity: line.quantityReceived, poLineId: poLine.id },
        });
      }
    }

    // Roll the PO header status forward if every line is received.
    const remaining = await tx
      .select({ id: purchaseOrderLines.id })
      .from(purchaseOrderLines)
      .where(
        and(
          eq(purchaseOrderLines.purchaseOrderId, input.purchaseOrderId),
          eq(purchaseOrderLines.organizationId, ctx.organizationId),
          eq(purchaseOrderLines.status, 'open'),
        ),
      );
    const partial = await tx
      .select({ id: purchaseOrderLines.id })
      .from(purchaseOrderLines)
      .where(
        and(
          eq(purchaseOrderLines.purchaseOrderId, input.purchaseOrderId),
          eq(purchaseOrderLines.organizationId, ctx.organizationId),
          eq(purchaseOrderLines.status, 'partially_received'),
        ),
      );
    const headerStatus =
      remaining.length === 0 && partial.length === 0
        ? 'received'
        : 'partially_received';
    await tx
      .update(purchaseOrders)
      .set({
        status: headerStatus,
        updatedBy: ctx.userId,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(purchaseOrders.id, input.purchaseOrderId),
          eq(purchaseOrders.organizationId, ctx.organizationId),
        ),
      );

    await recordAuditEvent(tx, ctx, {
      action: 'created',
      entityTable: 'part_receipts',
      entityId: receipt.id,
      after: { purchaseOrderId: input.purchaseOrderId },
    });

    await emitEvent(tx, ctx, {
      eventType: 'parts.po.line_received',
      payload: {
        purchaseOrderId: input.purchaseOrderId,
        receiptId: receipt.id,
      },
    });

    return receipt;
  });
}
