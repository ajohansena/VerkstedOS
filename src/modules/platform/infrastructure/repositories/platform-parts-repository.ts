import { and, desc, eq, sql } from 'drizzle-orm';

import { getRawClient } from '@/db/client';
import { inventoryWithdrawals } from '@/db/schemas/parts/inventory-withdrawals';
import { partLifecycleEvents } from '@/db/schemas/parts/part-lifecycle-events';
import { partReceiptLines } from '@/db/schemas/parts/part-receipt-lines';
import { partRequirements } from '@/db/schemas/parts/part-requirements';
import { partReturnLines } from '@/db/schemas/parts/part-return-lines';
import { purchaseOrderLines } from '@/db/schemas/parts/purchase-order-lines';
import { reconcilePartRequirement } from '@/modules/parts/public';

/**
 * Parts inspection + repair (Dev surface, /dev/parts). Cross-org → service-role
 * connection.
 *
 * The status-rebuild tool re-derives a part requirement's status from the
 * ACTUAL ordered/received/returned quantities using the SAME canonical
 * reconciliation calculation customer code uses — so a drifted requirement
 * status can be repaired without ad-hoc SQL (CLAUDE.md § 6).
 */

export interface PartRequirementRow {
  readonly id: string;
  readonly caseId: string;
  readonly description: string;
  readonly status: string;
  readonly quantity: string;
}

export async function listRequirementsForOrg(
  organizationId: string,
  limit = 100,
): Promise<PartRequirementRow[]> {
  const db = getRawClient({ as: 'platform-inspector' });
  return db
    .select({
      id: partRequirements.id,
      caseId: partRequirements.caseId,
      description: partRequirements.description,
      status: partRequirements.status,
      quantity: partRequirements.quantity,
    })
    .from(partRequirements)
    .where(eq(partRequirements.organizationId, organizationId))
    .orderBy(desc(partRequirements.createdAt))
    .limit(limit);
}

export interface LifecycleRow {
  readonly id: string;
  readonly kind: string;
  readonly occurredAt: Date;
}

export async function listLifecycleForRequirement(
  organizationId: string,
  partRequirementId: string,
): Promise<LifecycleRow[]> {
  const db = getRawClient({ as: 'platform-inspector' });
  return db
    .select({
      id: partLifecycleEvents.id,
      kind: partLifecycleEvents.kind,
      occurredAt: partLifecycleEvents.occurredAt,
    })
    .from(partLifecycleEvents)
    .where(
      and(
        eq(partLifecycleEvents.organizationId, organizationId),
        eq(partLifecycleEvents.partRequirementId, partRequirementId),
      ),
    )
    .orderBy(desc(partLifecycleEvents.occurredAt));
}

export interface RebuildResult {
  readonly requirementId: string;
  readonly before: string;
  readonly after: string;
}

/**
 * Re-derive a requirement's status from its actual quantities (the canonical
 * reconciliation calculation). Maps the reconciliation state back onto the
 * requirement status enum. Returns before/after for the audit trail.
 */
export async function rebuildRequirementStatus(
  organizationId: string,
  partRequirementId: string,
): Promise<RebuildResult> {
  const db = getRawClient({ as: 'platform-inspector' });

  const reqRows = await db
    .select({
      status: partRequirements.status,
      quantity: partRequirements.quantity,
    })
    .from(partRequirements)
    .where(
      and(
        eq(partRequirements.id, partRequirementId),
        eq(partRequirements.organizationId, organizationId),
      ),
    )
    .limit(1);
  const req = reqRows[0];
  if (!req) throw new Error('REQUIREMENT_NOT_FOUND');
  const before = req.status;

  const ordered = await db
    .select({
      total: sql<string>`coalesce(sum(${purchaseOrderLines.quantityOrdered}), 0)`,
    })
    .from(purchaseOrderLines)
    .where(
      and(
        eq(purchaseOrderLines.organizationId, organizationId),
        eq(purchaseOrderLines.partRequirementId, partRequirementId),
      ),
    );
  const receivedPo = await db
    .select({
      total: sql<string>`coalesce(sum(${partReceiptLines.quantityReceived}), 0)`,
    })
    .from(partReceiptLines)
    .where(
      and(
        eq(partReceiptLines.organizationId, organizationId),
        eq(partReceiptLines.partRequirementId, partRequirementId),
      ),
    );
  const receivedStock = await db
    .select({
      total: sql<string>`coalesce(sum(${inventoryWithdrawals.quantity}), 0)`,
    })
    .from(inventoryWithdrawals)
    .where(
      and(
        eq(inventoryWithdrawals.organizationId, organizationId),
        eq(inventoryWithdrawals.partRequirementId, partRequirementId),
      ),
    );
  const returned = await db
    .select({
      total: sql<string>`coalesce(sum(${partReturnLines.quantityReturned}), 0)`,
    })
    .from(partReturnLines)
    .where(
      and(
        eq(partReturnLines.organizationId, organizationId),
        eq(partReturnLines.partRequirementId, partRequirementId),
      ),
    );

  const reconciliation = reconcilePartRequirement({
    quantityRequired: Number(req.quantity),
    quantityOrdered: Number(ordered[0]?.total ?? 0),
    quantityReceived:
      Number(receivedPo[0]?.total ?? 0) + Number(receivedStock[0]?.total ?? 0),
    quantityReturned: Number(returned[0]?.total ?? 0),
  });

  const after = mapReconciliationToStatus(reconciliation.state, before);

  if (after !== before) {
    await db
      .update(partRequirements)
      .set({ status: after as never, updatedAt: new Date() })
      .where(
        and(
          eq(partRequirements.id, partRequirementId),
          eq(partRequirements.organizationId, organizationId),
        ),
      );
  }

  return { requirementId: partRequirementId, before, after };
}

/** Map a reconciliation state to the requirement status enum (repair only). */
function mapReconciliationToStatus(
  state: ReturnType<typeof reconcilePartRequirement>['state'],
  current: string,
): string {
  // Terminal/manual statuses are preserved.
  if (current === 'cancelled' || current === 'fulfilled') return current;
  switch (state) {
    case 'received':
    case 'over_received':
      return 'received';
    case 'awaiting_delivery':
      return 'ordered';
    case 'under_ordered':
      return 'partially_received';
    case 'not_ordered':
    default:
      return 'needed';
  }
}
