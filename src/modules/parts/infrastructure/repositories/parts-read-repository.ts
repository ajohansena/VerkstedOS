import { and, eq, inArray, ne, sql } from 'drizzle-orm';

import { withTransaction } from '@/db/client';
import { cases } from '@/db/schemas/case/cases';
import { inventoryWithdrawals } from '@/db/schemas/parts/inventory-withdrawals';
import { partLifecycleEvents } from '@/db/schemas/parts/part-lifecycle-events';
import { partReceiptLines } from '@/db/schemas/parts/part-receipt-lines';
import { partRequirements } from '@/db/schemas/parts/part-requirements';
import { partReturnLines } from '@/db/schemas/parts/part-return-lines';
import { purchaseOrderLines } from '@/db/schemas/parts/purchase-order-lines';
import { purchaseOrders } from '@/db/schemas/parts/purchase-orders';
import { suppliers } from '@/db/schemas/parts/suppliers';
import type { PartLifecycleEvent, PartRequirement } from '@/db/types';
import type { RequestContext } from '@/lib/tenancy/context';

import {
  reconcilePartRequirement,
  type ReconciliationResult,
} from '../../application/calculations/reconciliation';

/**
 * Parts read model (docs/03-data-model.md). Aggregates the per-requirement
 * quantities and runs them through the canonical reconciliation calculation
 * (SSoT). Also exposes the lifecycle timeline. No business arithmetic lives in
 * presentation — only here, and only as aggregation feeding the SSoT calc.
 */

export interface ReconciledRequirement {
  requirement: PartRequirement;
  reconciliation: ReconciliationResult;
}

export async function reconcileCaseParts(
  ctx: RequestContext,
  caseId: string,
): Promise<ReconciledRequirement[]> {
  return withTransaction(ctx, async (tx) => {
    const requirements = await tx
      .select()
      .from(partRequirements)
      .where(
        and(
          eq(partRequirements.organizationId, ctx.organizationId),
          eq(partRequirements.caseId, caseId),
        ),
      )
      .orderBy(partRequirements.createdAt);

    const out: ReconciledRequirement[] = [];
    for (const requirement of requirements) {
      const ordered = await tx
        .select({
          total: sql<string>`coalesce(sum(${purchaseOrderLines.quantityOrdered}), 0)`,
        })
        .from(purchaseOrderLines)
        .where(
          and(
            eq(purchaseOrderLines.organizationId, ctx.organizationId),
            eq(purchaseOrderLines.partRequirementId, requirement.id),
          ),
        );

      const receivedFromPo = await tx
        .select({
          total: sql<string>`coalesce(sum(${partReceiptLines.quantityReceived}), 0)`,
        })
        .from(partReceiptLines)
        .where(
          and(
            eq(partReceiptLines.organizationId, ctx.organizationId),
            eq(partReceiptLines.partRequirementId, requirement.id),
          ),
        );

      const receivedFromStock = await tx
        .select({
          total: sql<string>`coalesce(sum(${inventoryWithdrawals.quantity}), 0)`,
        })
        .from(inventoryWithdrawals)
        .where(
          and(
            eq(inventoryWithdrawals.organizationId, ctx.organizationId),
            eq(inventoryWithdrawals.partRequirementId, requirement.id),
          ),
        );

      const returned = await tx
        .select({
          total: sql<string>`coalesce(sum(${partReturnLines.quantityReturned}), 0)`,
        })
        .from(partReturnLines)
        .where(
          and(
            eq(partReturnLines.organizationId, ctx.organizationId),
            eq(partReturnLines.partRequirementId, requirement.id),
          ),
        );

      const reconciliation = reconcilePartRequirement({
        quantityRequired: Number(requirement.quantity),
        quantityOrdered: Number(ordered[0]?.total ?? 0),
        quantityReceived:
          Number(receivedFromPo[0]?.total ?? 0) +
          Number(receivedFromStock[0]?.total ?? 0),
        quantityReturned: Number(returned[0]?.total ?? 0),
      });

      out.push({ requirement, reconciliation });
    }
    return out;
  });
}

/** The lifecycle timeline for a case (most recent first). */
export async function listCaseLifecycle(
  ctx: RequestContext,
  caseId: string,
): Promise<PartLifecycleEvent[]> {
  return withTransaction(ctx, async (tx) => {
    return tx
      .select()
      .from(partLifecycleEvents)
      .where(
        and(
          eq(partLifecycleEvents.organizationId, ctx.organizationId),
          eq(partLifecycleEvents.caseId, caseId),
        ),
      )
      .orderBy(sql`${partLifecycleEvents.occurredAt} desc`);
  });
}

export interface CoordinatorRequirement {
  requirement: PartRequirement;
  caseNumber: string;
}

/**
 * Open part requirements across all cases — the purchasing coordinator's queue
 * (docs/11-dashboards.md). "Open" = needs sourcing or awaiting delivery.
 */
export async function listOpenRequirements(
  ctx: RequestContext,
): Promise<CoordinatorRequirement[]> {
  return withTransaction(ctx, async (tx) => {
    const rows = await tx
      .select({
        requirement: partRequirements,
        caseNumber: cases.caseNumber,
      })
      .from(partRequirements)
      .innerJoin(cases, eq(cases.id, partRequirements.caseId))
      .where(
        and(
          eq(partRequirements.organizationId, ctx.organizationId),
          inArray(partRequirements.status, [
            'needed',
            'sourcing',
            'ordered',
            'partially_received',
            'returned',
          ]),
        ),
      )
      .orderBy(partRequirements.createdAt);
    return rows.map((r) => ({
      requirement: r.requirement,
      caseNumber: r.caseNumber,
    }));
  });
}

/**
 * Open PO lines for a single requirement — the coordinator's receive surface
 * (docs/03-data-model.md). Returns only lines that still have outstanding
 * quantity (status != 'received'), with their PO header context.
 */
export interface OpenPoLineForRequirement {
  poLineId: string;
  purchaseOrderId: string;
  poNumber: string;
  supplierName: string | null;
  description: string;
  quantityOrdered: string;
  quantityReceived: string;
}

export async function listOpenPoLinesForRequirement(
  ctx: RequestContext,
  requirementId: string,
): Promise<OpenPoLineForRequirement[]> {
  return withTransaction(ctx, async (tx) => {
    const rows = await tx
      .select({
        poLineId: purchaseOrderLines.id,
        purchaseOrderId: purchaseOrderLines.purchaseOrderId,
        poNumber: purchaseOrders.poNumber,
        supplierName: suppliers.name,
        description: purchaseOrderLines.description,
        quantityOrdered: purchaseOrderLines.quantityOrdered,
        quantityReceived: purchaseOrderLines.quantityReceived,
      })
      .from(purchaseOrderLines)
      .innerJoin(
        purchaseOrders,
        eq(purchaseOrders.id, purchaseOrderLines.purchaseOrderId),
      )
      .leftJoin(suppliers, eq(suppliers.id, purchaseOrders.supplierId))
      .where(
        and(
          eq(purchaseOrderLines.organizationId, ctx.organizationId),
          eq(purchaseOrderLines.partRequirementId, requirementId),
          ne(purchaseOrderLines.status, 'received'),
        ),
      )
      .orderBy(purchaseOrderLines.createdAt);
    return rows;
  });
}
