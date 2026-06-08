import { and, desc, eq, inArray, isNull, sql } from 'drizzle-orm';

import { withTransaction } from '@/db/client';
import { cases } from '@/db/schemas/case/cases';
import { customers } from '@/db/schemas/customer/customers';
import { vehicles } from '@/db/schemas/customer/vehicles';
import { partRequirements } from '@/db/schemas/parts/part-requirements';
import { productionHolds } from '@/db/schemas/production/production-holds';
import { productionOrders } from '@/db/schemas/production/production-orders';
import { productionStateHistory } from '@/db/schemas/production/production-state-history';
import { resourceAssignments } from '@/db/schemas/production/resource-assignments';
import { workSegments } from '@/db/schemas/production/work-segments';
import { workflowDefinitions } from '@/db/schemas/production/workflow-definitions';
import { workflowStates } from '@/db/schemas/production/workflow-states';
import { workflowTransitions } from '@/db/schemas/production/workflow-transitions';
import { employees } from '@/db/schemas/workforce/employees';
import { resources } from '@/db/schemas/workforce/resources';
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

// ── Rich board / operations reads ───────────────────────────────────────────

export interface RichBoardItem {
  readonly caseId: string;
  readonly caseNumber: string;
  readonly openedAt: Date;
  readonly stateCode: string | null;
  readonly stateLabel: string | null;
  readonly stateCategory: 'active' | 'waiting' | 'terminal' | null;
  readonly stateSequenceNo: number | null;
  readonly colorHint: 'green' | 'yellow' | 'red' | 'grey' | null;
  readonly registrationNumber: string | null;
  readonly vehicleMake: string | null;
  readonly vehicleModel: string | null;
  readonly vehicleYear: number | null;
  readonly customerName: string | null;
  readonly activeSegmentLabel: string | null;
  readonly activeSegmentProgressPct: number | null;
  readonly assignedTechName: string | null;
  readonly openPartsCount: number;
  readonly onHold: boolean;
  readonly holdReason: string | null;
}

/**
 * Rich board read — the operationally-meaningful card data the Production
 * Board v2 and the Operations Center both consume (docs/12 §6).
 *
 * Composed from a base SELECT plus a few per-case rollups (active segment,
 * tech, parts, holds). Returns one row per case with a production order.
 */
export async function listProductionBoardRich(
  ctx: RequestContext,
): Promise<RichBoardItem[]> {
  return withTransaction(ctx, async (tx) => {
    const base = await tx
      .select({
        caseId: cases.id,
        caseNumber: cases.caseNumber,
        openedAt: cases.openedAt,
        stateCode: workflowStates.code,
        stateLabel: workflowStates.label,
        stateCategory: workflowStates.category,
        stateSequenceNo: workflowStates.sequenceNo,
        colorHint: workflowStates.colorHint,
        registrationNumber: vehicles.registrationNumber,
        vehicleMake: vehicles.make,
        vehicleModel: vehicles.model,
        vehicleYear: vehicles.year,
        customerName: customers.name,
      })
      .from(productionOrders)
      .innerJoin(cases, eq(cases.id, productionOrders.caseId))
      .leftJoin(vehicles, eq(vehicles.id, cases.vehicleId))
      .leftJoin(customers, eq(customers.id, cases.primaryCustomerId))
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

    if (base.length === 0) return [];
    const caseIds = base.map((b) => b.caseId);

    // Active in-progress segment per case (highest sequenceNo).
    const activeRows = await tx
      .select({
        caseId: workSegments.caseId,
        segmentId: workSegments.id,
        label: workSegments.label,
        planned: workSegments.plannedMinutes,
        actual: workSegments.actualMinutes,
        sequenceNo: workSegments.sequenceNo,
      })
      .from(workSegments)
      .where(
        and(
          eq(workSegments.organizationId, ctx.organizationId),
          inArray(workSegments.caseId, caseIds),
          eq(workSegments.status, 'in_progress'),
        ),
      )
      .orderBy(desc(workSegments.sequenceNo));
    const activeByCase = new Map<
      string,
      { segmentId: string; label: string; planned: number; actual: number }
    >();
    for (const row of activeRows) {
      if (!activeByCase.has(row.caseId)) {
        activeByCase.set(row.caseId, {
          segmentId: row.segmentId,
          label: row.label,
          planned: row.planned,
          actual: row.actual,
        });
      }
    }

    // Open parts per case.
    const partsRows =
      caseIds.length > 0
        ? await tx
            .select({
              caseId: partRequirements.caseId,
              n: sql<number>`count(*)::int`,
            })
            .from(partRequirements)
            .where(
              and(
                eq(partRequirements.organizationId, ctx.organizationId),
                inArray(partRequirements.caseId, caseIds),
                inArray(partRequirements.status, [
                  'needed',
                  'sourcing',
                  'ordered',
                  'partially_received',
                  'returned',
                ]),
              ),
            )
            .groupBy(partRequirements.caseId)
        : [];
    const partsByCase = new Map<string, number>();
    for (const row of partsRows) {
      partsByCase.set(row.caseId, Number(row.n));
    }

    // Open holds per case (one most-recent reason wins for the card).
    const holdRows = await tx
      .select({
        caseId: productionHolds.caseId,
        reason: productionHolds.reason,
        createdAt: productionHolds.createdAt,
      })
      .from(productionHolds)
      .where(
        and(
          eq(productionHolds.organizationId, ctx.organizationId),
          inArray(productionHolds.caseId, caseIds),
          isNull(productionHolds.resolvedAt),
          isNull(productionHolds.deletedAt),
        ),
      )
      .orderBy(desc(productionHolds.createdAt));
    const holdByCase = new Map<string, string | null>();
    for (const row of holdRows) {
      if (!holdByCase.has(row.caseId)) {
        holdByCase.set(row.caseId, row.reason ?? null);
      }
    }

    // Tech name on the active segment (primary assignee, employee resource).
    const techByCase = new Map<string, string>();
    const activeSegmentIds = [...activeByCase.values()].map((v) => v.segmentId);
    if (activeSegmentIds.length > 0) {
      const techRows = await tx
        .select({
          segmentId: resourceAssignments.workSegmentId,
          name: employees.fullName,
        })
        .from(resourceAssignments)
        .innerJoin(resources, eq(resources.id, resourceAssignments.resourceId))
        .innerJoin(employees, eq(employees.id, resources.employeeId))
        .where(
          and(
            eq(resourceAssignments.organizationId, ctx.organizationId),
            inArray(resourceAssignments.workSegmentId, activeSegmentIds),
            eq(resourceAssignments.role, 'primary'),
            isNull(resourceAssignments.deletedAt),
          ),
        );
      // map segment -> case
      const segToCase = new Map<string, string>();
      for (const [caseId, seg] of activeByCase) {
        segToCase.set(seg.segmentId, caseId);
      }
      for (const row of techRows) {
        const caseId = segToCase.get(row.segmentId);
        if (caseId && !techByCase.has(caseId)) {
          techByCase.set(caseId, row.name);
        }
      }
    }

    return base.map((b) => {
      const active = activeByCase.get(b.caseId) ?? null;
      const progress =
        active && active.planned > 0
          ? Math.min(100, Math.round((active.actual / active.planned) * 100))
          : null;
      return {
        caseId: b.caseId,
        caseNumber: b.caseNumber,
        openedAt: b.openedAt,
        stateCode: b.stateCode,
        stateLabel: b.stateLabel,
        stateCategory: b.stateCategory,
        stateSequenceNo: b.stateSequenceNo,
        colorHint: b.colorHint as RichBoardItem['colorHint'],
        registrationNumber: b.registrationNumber,
        vehicleMake: b.vehicleMake,
        vehicleModel: b.vehicleModel,
        vehicleYear: b.vehicleYear,
        customerName: b.customerName,
        activeSegmentLabel: active?.label ?? null,
        activeSegmentProgressPct: progress,
        assignedTechName: techByCase.get(b.caseId) ?? null,
        openPartsCount: partsByCase.get(b.caseId) ?? 0,
        onHold: holdByCase.has(b.caseId),
        holdReason: holdByCase.get(b.caseId) ?? null,
      };
    });
  });
}

export interface OrgHold {
  readonly caseId: string;
  readonly caseNumber: string;
  readonly holdKind: string;
  readonly reason: string | null;
  readonly createdAt: Date;
}

/** Active holds across the org (Operations Center attention zone). */
export async function listActiveHoldsForOrg(
  ctx: RequestContext,
  limit = 10,
): Promise<OrgHold[]> {
  return withTransaction(ctx, async (tx) => {
    return tx
      .select({
        caseId: productionHolds.caseId,
        caseNumber: cases.caseNumber,
        holdKind: productionHolds.holdKind,
        reason: productionHolds.reason,
        createdAt: productionHolds.createdAt,
      })
      .from(productionHolds)
      .innerJoin(cases, eq(cases.id, productionHolds.caseId))
      .where(
        and(
          eq(productionHolds.organizationId, ctx.organizationId),
          isNull(productionHolds.resolvedAt),
          isNull(productionHolds.deletedAt),
        ),
      )
      .orderBy(desc(productionHolds.createdAt))
      .limit(limit);
  });
}

/**
 * Current production state label + code for a single case. Cheap one-row
 * lookup used by the Case Workspace side panel.
 */
export async function findCaseProductionState(
  ctx: RequestContext,
  caseId: string,
): Promise<{ code: string; label: string; category: string } | null> {
  return withTransaction(ctx, async (tx) => {
    const rows = await tx
      .select({
        code: workflowStates.code,
        label: workflowStates.label,
        category: workflowStates.category,
      })
      .from(productionOrders)
      .innerJoin(
        workflowStates,
        eq(workflowStates.id, productionOrders.currentStateId),
      )
      .where(
        and(
          eq(productionOrders.organizationId, ctx.organizationId),
          eq(productionOrders.caseId, caseId),
        ),
      )
      .limit(1);
    return rows[0] ?? null;
  });
}

/**
 * Adjacency map of the active workflow keyed by state CODE — used by the
 * Production Board v2 to gate drag-to-transition client-side (the server
 * still re-validates via `transitionState`). Returns empty when no workflow.
 */
export async function listWorkflowAdjacency(
  ctx: RequestContext,
): Promise<Record<string, string[]>> {
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
    if (!def[0]) return {};
    const states = await tx
      .select({ id: workflowStates.id, code: workflowStates.code })
      .from(workflowStates)
      .where(eq(workflowStates.workflowDefinitionId, def[0].id));
    const codeById = new Map(states.map((s) => [s.id, s.code]));
    const trans = await tx
      .select({
        fromStateId: workflowTransitions.fromStateId,
        toStateId: workflowTransitions.toStateId,
      })
      .from(workflowTransitions)
      .where(eq(workflowTransitions.workflowDefinitionId, def[0].id));
    const out: Record<string, string[]> = {};
    for (const t of trans) {
      const from = codeById.get(t.fromStateId);
      const to = codeById.get(t.toStateId);
      if (!from || !to) continue;
      (out[from] ??= []).push(to);
    }
    return out;
  });
}
