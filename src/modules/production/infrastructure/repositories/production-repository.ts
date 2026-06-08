import { and, desc, eq, isNull } from 'drizzle-orm';

import { withTransaction } from '@/db/client';
import { cases } from '@/db/schemas/case/cases';
import { productionHolds } from '@/db/schemas/production/production-holds';
import { productionOrders } from '@/db/schemas/production/production-orders';
import { productionStateHistory } from '@/db/schemas/production/production-state-history';
import { workflowDefinitions } from '@/db/schemas/production/workflow-definitions';
import { workflowStates } from '@/db/schemas/production/workflow-states';
import { workflowTransitions } from '@/db/schemas/production/workflow-transitions';
import type {
  ProductionHold,
  ProductionStateHistory,
  WorkflowState,
} from '@/db/types';
import type { RequestContext } from '@/lib/tenancy/context';

/**
 * Production read repository (org-scoped). The board reads the projected current
 * state per case; the timeline reads the authoritative append-only history.
 */

export interface BoardItem {
  readonly caseId: string;
  readonly caseNumber: string;
  readonly stateCode: string | null;
  readonly stateLabel: string | null;
  readonly category: string | null;
  readonly colorHint: string | null;
}

/** All active cases with their current (projected) production state. */
export async function listProductionBoard(
  ctx: RequestContext,
): Promise<BoardItem[]> {
  return withTransaction(ctx, async (tx) => {
    return tx
      .select({
        caseId: cases.id,
        caseNumber: cases.caseNumber,
        stateCode: workflowStates.code,
        stateLabel: workflowStates.label,
        category: workflowStates.category,
        colorHint: workflowStates.colorHint,
      })
      .from(productionOrders)
      .innerJoin(cases, eq(cases.id, productionOrders.caseId))
      .leftJoin(
        workflowStates,
        eq(workflowStates.id, productionOrders.currentStateId),
      )
      .where(
        and(
          eq(productionOrders.organizationId, ctx.organizationId),
          isNull(cases.deletedAt),
        ),
      )
      .orderBy(workflowStates.sequenceNo, cases.caseNumber);
  });
}

/** Append-only transition timeline for a case (authoritative log). */
export async function listStateHistory(
  ctx: RequestContext,
  caseId: string,
): Promise<ProductionStateHistory[]> {
  return withTransaction(ctx, async (tx) => {
    return tx
      .select()
      .from(productionStateHistory)
      .where(
        and(
          eq(productionStateHistory.organizationId, ctx.organizationId),
          eq(productionStateHistory.caseId, caseId),
        ),
      )
      .orderBy(desc(productionStateHistory.occurredAt));
  });
}

/** States reachable from the case's current state (for the transition UI). */
export async function listAvailableTransitions(
  ctx: RequestContext,
  caseId: string,
): Promise<WorkflowState[]> {
  return withTransaction(ctx, async (tx) => {
    const orderRows = await tx
      .select({
        currentStateId: productionOrders.currentStateId,
        workflowDefinitionId: productionOrders.workflowDefinitionId,
      })
      .from(productionOrders)
      .where(
        and(
          eq(productionOrders.organizationId, ctx.organizationId),
          eq(productionOrders.caseId, caseId),
        ),
      )
      .limit(1);
    const order = orderRows[0];
    if (!order?.currentStateId) return [];

    return tx
      .select({
        id: workflowStates.id,
        organizationId: workflowStates.organizationId,
        workflowDefinitionId: workflowStates.workflowDefinitionId,
        code: workflowStates.code,
        label: workflowStates.label,
        category: workflowStates.category,
        sequenceNo: workflowStates.sequenceNo,
        colorHint: workflowStates.colorHint,
        isInitial: workflowStates.isInitial,
        createdAt: workflowStates.createdAt,
        updatedAt: workflowStates.updatedAt,
        deletedAt: workflowStates.deletedAt,
        createdBy: workflowStates.createdBy,
        updatedBy: workflowStates.updatedBy,
      })
      .from(workflowTransitions)
      .innerJoin(
        workflowStates,
        eq(workflowStates.id, workflowTransitions.toStateId),
      )
      .where(
        and(
          eq(workflowTransitions.organizationId, ctx.organizationId),
          eq(workflowTransitions.fromStateId, order.currentStateId),
        ),
      )
      .orderBy(workflowStates.sequenceNo);
  });
}

/** Open holds on a case. */
export async function listOpenHolds(
  ctx: RequestContext,
  caseId: string,
): Promise<ProductionHold[]> {
  return withTransaction(ctx, async (tx) => {
    return tx
      .select()
      .from(productionHolds)
      .where(
        and(
          eq(productionHolds.organizationId, ctx.organizationId),
          eq(productionHolds.caseId, caseId),
          isNull(productionHolds.resolvedAt),
          isNull(productionHolds.deletedAt),
        ),
      );
  });
}

/** The active workflow's states (Admin surface — workflow viewer). */
export async function listWorkflowStates(
  ctx: RequestContext,
): Promise<WorkflowState[]> {
  return withTransaction(ctx, async (tx) => {
    const def = await tx
      .select({ id: workflowDefinitions.id })
      .from(workflowDefinitions)
      .where(
        and(
          eq(workflowDefinitions.organizationId, ctx.organizationId),
          eq(workflowDefinitions.isActive, true),
        ),
      )
      .limit(1);
    if (!def[0]) return [];
    return tx
      .select()
      .from(workflowStates)
      .where(
        and(
          eq(workflowStates.organizationId, ctx.organizationId),
          eq(workflowStates.workflowDefinitionId, def[0].id),
        ),
      )
      .orderBy(workflowStates.sequenceNo);
  });
}
