/**
 * Notification fact repository (Sprint 17). Cross-module READS that the
 * notification engine needs to gather facts. Reads only — writes always go
 * through the owning module. Pattern mirrors dashboards' kpi-repository.
 *
 * Recipient resolution: for now, all admins in the org receive every
 * triggered notification. Per-user / per-role routing arrives with the
 * permission-aware preferences UI in a later sprint.
 */

import { and, eq, isNull, sql } from 'drizzle-orm';

import { withTransaction } from '@/db/client';
import { cases } from '@/db/schemas/case/cases';
import { memberships } from '@/db/schemas/identity/memberships';
import { partRequirements } from '@/db/schemas/parts/part-requirements';
import { partLifecycleEvents } from '@/db/schemas/parts/part-lifecycle-events';
import type { RequestContext } from '@/lib/tenancy/context';

import type {
  DeliveryAtRiskFact,
  PartsDelayFact,
} from '../../application/calculations/triggers';

/** All active org members eligible to receive notifications. */
export async function listOrgRecipients(
  ctx: RequestContext,
): Promise<readonly string[]> {
  return withTransaction(ctx, async (tx) => {
    const rows = await tx
      .select({ userId: memberships.userId })
      .from(memberships)
      .where(
        and(
          eq(memberships.organizationId, ctx.organizationId),
          eq(memberships.status, 'active'),
          isNull(memberships.deletedAt),
        ),
      );
    return rows.map((r) => r.userId);
  });
}

export async function listPartsDelayFacts(
  ctx: RequestContext,
  recipients: readonly string[],
): Promise<readonly PartsDelayFact[]> {
  if (recipients.length === 0) return [];
  return withTransaction(ctx, async (tx) => {
    // Requirements still in `needed` (flagged but not yet ordered/received).
    const rows = await tx
      .select({
        requirementId: partRequirements.id,
        caseId: partRequirements.caseId,
        caseNumber: cases.caseNumber,
        workshopId: cases.currentWorkshopId,
        flaggedAt: partRequirements.createdAt,
        partName: partRequirements.description,
        status: partRequirements.status,
      })
      .from(partRequirements)
      .innerJoin(cases, eq(cases.id, partRequirements.caseId))
      .where(
        and(
          eq(partRequirements.organizationId, ctx.organizationId),
          isNull(partRequirements.deletedAt),
          isNull(cases.deletedAt),
        ),
      );
    return rows.map<PartsDelayFact>((r) => ({
      requirementId: r.requirementId,
      caseId: r.caseId,
      caseNumber: r.caseNumber,
      workshopId: r.workshopId,
      flaggedAt: r.flaggedAt,
      partName: r.partName,
      // 'progressed' means it left `needed`.
      progressed: r.status !== 'needed',
      recipientUserIds: recipients,
    }));
  });
}

/**
 * Delivery-at-risk facts: cases still open beyond NORMAL_REPAIR_DAYS. We
 * synthesize `promisedAt = openedAt + 12d` (same as the KPI module) and
 * `forecastAt = now + remaining segments time` — for Sprint 17 we use a
 * coarse approximation: forecast = now if open beyond 12d, the
 * "slip" being now - promised. Refined in Sprint 21+ when the canonical
 * forecast calculation is registered.
 */
export async function listDeliveryAtRiskFacts(
  ctx: RequestContext,
  recipients: readonly string[],
  now: Date = new Date(),
): Promise<readonly DeliveryAtRiskFact[]> {
  if (recipients.length === 0) return [];
  return withTransaction(ctx, async (tx) => {
    const rows = await tx
      .select({
        caseId: cases.id,
        caseNumber: cases.caseNumber,
        workshopId: cases.currentWorkshopId,
        openedAt: cases.openedAt,
        deliveredAt: cases.deliveredAt,
        status: cases.status,
      })
      .from(cases)
      .where(
        and(
          eq(cases.organizationId, ctx.organizationId),
          isNull(cases.deletedAt),
        ),
      );
    const NORMAL_REPAIR_DAYS = 12;
    const DAY = 86400000;
    return rows
      .filter(
        (r) =>
          r.deliveredAt === null &&
          r.status !== 'closed' &&
          r.status !== 'cancelled',
      )
      .map<DeliveryAtRiskFact>((r) => ({
        caseId: r.caseId,
        caseNumber: r.caseNumber,
        workshopId: r.workshopId,
        promisedAt: new Date(
          r.openedAt.getTime() + NORMAL_REPAIR_DAYS * DAY,
        ),
        forecastAt: now,
        recipientUserIds: recipients,
      }));
  });
}

/**
 * Supplement-pending facts. Sprint 17 ships with a placeholder query: cases
 * with multiple `active` estimate imports (which usually indicates a pending
 * supplement). The full estimate-supplement lifecycle is the canonical source
 * once the supplement module ships; this gives an MVP signal.
 */
export async function listSupplementPendingFacts(
  ctx: RequestContext,
  recipients: readonly string[],
): Promise<
  readonly {
    caseId: string;
    caseNumber: string;
    workshopId: string | null;
    supplementId: string;
    raisedAt: Date;
    settled: boolean;
    recipientUserIds: readonly string[];
  }[]
> {
  if (recipients.length === 0) return [];
  return withTransaction(ctx, async (tx) => {
    const rows = await tx.execute<{
      case_id: string;
      case_number: string;
      current_workshop_id: string | null;
      supplement_id: string;
      raised_at: Date;
    }>(sql`
      SELECT ei.case_id, c.case_number, c.current_workshop_id,
             ei.id AS supplement_id, ei.created_at AS raised_at
      FROM estimate_imports ei
      JOIN cases c ON c.id = ei.case_id
      WHERE ei.organization_id = ${ctx.organizationId}
        AND ei.kind = 'supplement'
        AND ei.status = 'active'
        AND ei.deleted_at IS NULL
        AND c.deleted_at IS NULL
    `);
    const list = Array.isArray(rows) ? rows : (rows as { rows?: typeof rows }).rows ?? [];
    return (list as readonly {
      case_id: string;
      case_number: string;
      current_workshop_id: string | null;
      supplement_id: string;
      raised_at: Date;
    }[]).map((r) => ({
      caseId: r.case_id,
      caseNumber: r.case_number,
      workshopId: r.current_workshop_id,
      supplementId: r.supplement_id,
      raisedAt: new Date(r.raised_at),
      settled: false,
      recipientUserIds: recipients,
    }));
  });
}

// Helper kept for parity though unused in MVP — silences unused-import lint.
void partLifecycleEvents;
