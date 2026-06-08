import { and, desc, eq, inArray } from 'drizzle-orm';

import { getRawClient } from '@/db/client';
import { caseTransfers } from '@/db/schemas/case/case-transfers';

/**
 * Transfer inspection + repair (Dev surface, /dev/transfers). Cross-org →
 * service-role connection. Lists recent transfers and surfaces "stuck"
 * transfers (in_transit too long). The repair force-cancels a stuck transfer
 * without flipping the case (a no-op safe escape).
 */

export interface TransferRow {
  readonly id: string;
  readonly caseId: string;
  readonly fromWorkshopId: string | null;
  readonly toWorkshopId: string;
  readonly status: string;
  readonly initiatedAt: Date;
}

export async function listTransfersForOrg(
  organizationId: string,
  limit = 100,
): Promise<TransferRow[]> {
  const db = getRawClient({ as: 'platform-inspector' });
  return db
    .select({
      id: caseTransfers.id,
      caseId: caseTransfers.caseId,
      fromWorkshopId: caseTransfers.fromWorkshopId,
      toWorkshopId: caseTransfers.toWorkshopId,
      status: caseTransfers.status,
      initiatedAt: caseTransfers.initiatedAt,
    })
    .from(caseTransfers)
    .where(eq(caseTransfers.organizationId, organizationId))
    .orderBy(desc(caseTransfers.initiatedAt))
    .limit(limit);
}

/** Force-cancel a stuck transfer (in_transit/initiated) — a safe escape. */
export async function repairStuckTransfer(
  organizationId: string,
  transferId: string,
): Promise<void> {
  const db = getRawClient({ as: 'platform-inspector' });
  await db
    .update(caseTransfers)
    .set({ status: 'cancelled', updatedAt: new Date() })
    .where(
      and(
        eq(caseTransfers.id, transferId),
        eq(caseTransfers.organizationId, organizationId),
        inArray(caseTransfers.status, ['initiated', 'in_transit']),
      ),
    );
}
