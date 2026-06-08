import { and, eq, isNull } from 'drizzle-orm';

import { withTransaction } from '@/db/client';
import { recordAuditEvent } from '@/lib/audit/audit-writer';
import { emitEvent } from '@/lib/events/outbox';
import { partRequirements } from '@/db/schemas/parts/part-requirements';
import { purchaseOrderLines } from '@/db/schemas/parts/purchase-order-lines';
import { purchaseOrders } from '@/db/schemas/parts/purchase-orders';
import { suppliers } from '@/db/schemas/parts/suppliers';
import type { PurchaseOrder, PurchaseOrderLine, Supplier } from '@/db/types';
import type { RequestContext } from '@/lib/tenancy/context';
import { requirePermission } from '@/modules/identity/public';

import { appendLifecycleEvent } from './lifecycle';

/**
 * Procurement — suppliers + purchase orders (docs/03-data-model.md). ONE PO can
 * span MANY cases: each line links a per-case part requirement, preserving
 * case-level traceability (TakstKontroll, § 4.7). `parts:order` required.
 */

export async function createSupplier(
  ctx: RequestContext,
  input: { name: string; orgNumber?: string; contactEmail?: string },
): Promise<Supplier> {
  await requirePermission(ctx, 'admin:config');

  return withTransaction(ctx, async (tx) => {
    const inserted = await tx
      .insert(suppliers)
      .values({
        organizationId: ctx.organizationId,
        name: input.name,
        orgNumber: input.orgNumber ?? null,
        contactEmail: input.contactEmail ?? null,
        createdBy: ctx.userId,
        updatedBy: ctx.userId,
      })
      .returning();
    const supplier = inserted[0];
    if (!supplier) throw new Error('Failed to create supplier');

    await recordAuditEvent(tx, ctx, {
      action: 'created',
      entityTable: 'suppliers',
      entityId: supplier.id,
      after: { name: input.name },
    });

    return supplier;
  });
}

export async function listSuppliers(ctx: RequestContext): Promise<Supplier[]> {
  return withTransaction(ctx, async (tx) => {
    return tx
      .select()
      .from(suppliers)
      .where(
        and(
          eq(suppliers.organizationId, ctx.organizationId),
          isNull(suppliers.deletedAt),
        ),
      )
      .orderBy(suppliers.name);
  });
}

export interface OrderLineInput {
  partRequirementId: string;
  caseId: string;
  description: string;
  partNumber?: string;
  quantity?: number;
  unitPrice?: string | null;
  fundingSourceId?: string | null;
}

export interface CreatePurchaseOrderInput {
  supplierId: string;
  poNumber: string;
  workshopId?: string | null;
  lines: OrderLineInput[];
}

/**
 * Create a purchase order with its lines (status `draft`). Each line moves its
 * part requirement to `ordered` and appends an `ordered` lifecycle event.
 */
export async function createPurchaseOrder(
  ctx: RequestContext,
  input: CreatePurchaseOrderInput,
): Promise<PurchaseOrder> {
  await requirePermission(ctx, 'parts:order');

  return withTransaction(ctx, async (tx) => {
    const insertedPo = await tx
      .insert(purchaseOrders)
      .values({
        organizationId: ctx.organizationId,
        supplierId: input.supplierId,
        workshopId: input.workshopId ?? ctx.workshopId ?? null,
        poNumber: input.poNumber,
        status: 'draft',
        orderedByUserId: ctx.userId,
        createdBy: ctx.userId,
        updatedBy: ctx.userId,
      })
      .returning();
    const po = insertedPo[0];
    if (!po) throw new Error('Failed to create purchase order');

    for (const line of input.lines) {
      await tx.insert(purchaseOrderLines).values({
        organizationId: ctx.organizationId,
        purchaseOrderId: po.id,
        partRequirementId: line.partRequirementId,
        caseId: line.caseId,
        fundingSourceId: line.fundingSourceId ?? null,
        partNumber: line.partNumber ?? null,
        description: line.description,
        quantityOrdered: line.quantity != null ? String(line.quantity) : '1',
        unitPrice: line.unitPrice ?? null,
        status: 'open',
        createdBy: ctx.userId,
        updatedBy: ctx.userId,
      });

      // Move the requirement to ordered.
      await tx
        .update(partRequirements)
        .set({
          status: 'ordered',
          updatedBy: ctx.userId,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(partRequirements.id, line.partRequirementId),
            eq(partRequirements.organizationId, ctx.organizationId),
          ),
        );

      await appendLifecycleEvent(tx, ctx, {
        partRequirementId: line.partRequirementId,
        caseId: line.caseId,
        kind: 'ordered',
        detail: { poNumber: input.poNumber, quantity: line.quantity ?? 1 },
      });
    }

    await recordAuditEvent(tx, ctx, {
      action: 'created',
      entityTable: 'purchase_orders',
      entityId: po.id,
      after: { poNumber: input.poNumber, lineCount: input.lines.length },
    });

    await emitEvent(tx, ctx, {
      eventType: 'parts.po.created',
      payload: { purchaseOrderId: po.id, poNumber: input.poNumber },
    });

    return po;
  });
}

/** Mark a draft PO as sent to the supplier. */
export async function sendPurchaseOrder(
  ctx: RequestContext,
  purchaseOrderId: string,
): Promise<void> {
  await requirePermission(ctx, 'parts:order');

  await withTransaction(ctx, async (tx) => {
    await tx
      .update(purchaseOrders)
      .set({ status: 'sent', sentAt: new Date(), updatedBy: ctx.userId })
      .where(
        and(
          eq(purchaseOrders.id, purchaseOrderId),
          eq(purchaseOrders.organizationId, ctx.organizationId),
        ),
      );

    const lines = await tx
      .select()
      .from(purchaseOrderLines)
      .where(
        and(
          eq(purchaseOrderLines.purchaseOrderId, purchaseOrderId),
          eq(purchaseOrderLines.organizationId, ctx.organizationId),
        ),
      );
    for (const line of lines) {
      if (line.partRequirementId && line.caseId) {
        await appendLifecycleEvent(tx, ctx, {
          partRequirementId: line.partRequirementId,
          caseId: line.caseId,
          kind: 'po_sent',
          detail: { purchaseOrderId },
        });
      }
    }

    await recordAuditEvent(tx, ctx, {
      action: 'transitioned',
      entityTable: 'purchase_orders',
      entityId: purchaseOrderId,
      reason: 'PO sent to supplier',
      after: { status: 'sent' },
    });

    await emitEvent(tx, ctx, {
      eventType: 'parts.po.sent',
      payload: { purchaseOrderId },
    });
  });
}

export async function listPurchaseOrderLines(
  ctx: RequestContext,
  purchaseOrderId: string,
): Promise<PurchaseOrderLine[]> {
  return withTransaction(ctx, async (tx) => {
    return tx
      .select()
      .from(purchaseOrderLines)
      .where(
        and(
          eq(purchaseOrderLines.organizationId, ctx.organizationId),
          eq(purchaseOrderLines.purchaseOrderId, purchaseOrderId),
        ),
      );
  });
}
