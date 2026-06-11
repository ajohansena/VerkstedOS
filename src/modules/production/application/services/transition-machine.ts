import { and, eq } from 'drizzle-orm';

import { withTransaction, type TenantTransaction } from '@/db/client';
import { recordAuditEvent } from '@/lib/audit/audit-writer';
import { emitEvent } from '@/lib/events/outbox';
import { cases } from '@/db/schemas/case/cases';
import { productionOrders } from '@/db/schemas/production/production-orders';
import { productionStateHistory } from '@/db/schemas/production/production-state-history';
import { workflowDefinitions } from '@/db/schemas/production/workflow-definitions';
import { workflowStates } from '@/db/schemas/production/workflow-states';
import { workflowTransitions } from '@/db/schemas/production/workflow-transitions';
import type { ProductionOrder } from '@/db/types';
import type { RequestContext } from '@/lib/tenancy/context';
import { requirePermission } from '@/modules/identity/public';

import { seedDefaultWorkflow } from './seed-workflow';

/**
 * Production order container + transition machine
 * (docs/10-production-domain.md, Sprint 8 guardrail).
 *
 * GUARDRAIL — status is a PROJECTION:
 *   - `production_state_history` (append-only) is the AUTHORITATIVE log.
 *   - `production_orders.current_state_id` and `cases.status` are PROJECTIONS of
 *     the latest history row, updated as a side effect of a transition.
 *   - In Sprint 10, segment/clock events drive transitions via the same machine;
 *     no rework needed because the machine already treats status as derived.
 */

/**
 * Tx-accepting variant of `ensureProductionOrder`. Used when the caller already
 * owns a transaction (e.g. `createCase` makes the ProductionOrder intrinsic to
 * Case in one atomic commit — doc 10 § ProductionOrder + CLAUDE.md § 4.4).
 * Idempotent within the tx.
 */
export async function ensureProductionOrderInTx(
  tx: TenantTransaction,
  ctx: RequestContext,
  caseId: string,
): Promise<ProductionOrder> {
  const existing = await tx
    .select()
    .from(productionOrders)
    .where(
      and(
        eq(productionOrders.organizationId, ctx.organizationId),
        eq(productionOrders.caseId, caseId),
      ),
    )
    .limit(1);
  if (existing[0]) return existing[0];

  // Resolve the active workflow definition (seed if missing). Note: the seeder
  // opens its own admin connection (no RLS) so it is safe to call inside a tx.
  let defRows = await tx
    .select({ id: workflowDefinitions.id })
    .from(workflowDefinitions)
    .where(
      and(
        eq(workflowDefinitions.organizationId, ctx.organizationId),
        eq(workflowDefinitions.isActive, true),
      ),
    )
    .limit(1);
  if (!defRows[0]) {
    await seedDefaultWorkflow(ctx.organizationId);
    defRows = await tx
      .select({ id: workflowDefinitions.id })
      .from(workflowDefinitions)
      .where(
        and(
          eq(workflowDefinitions.organizationId, ctx.organizationId),
          eq(workflowDefinitions.isActive, true),
        ),
      )
      .limit(1);
  }
  const definitionId = defRows[0]!.id;

  // Initial state.
  const initial = await tx
    .select()
    .from(workflowStates)
    .where(
      and(
        eq(workflowStates.workflowDefinitionId, definitionId),
        eq(workflowStates.isInitial, true),
      ),
    )
    .limit(1);
  const initialState = initial[0];

  const insertedOrder = await tx
    .insert(productionOrders)
    .values({
      organizationId: ctx.organizationId,
      caseId,
      workflowDefinitionId: definitionId,
      currentStateId: initialState?.id ?? null,
      createdBy: ctx.userId,
      updatedBy: ctx.userId,
    })
    .returning();
  const order = insertedOrder[0];
  if (!order) throw new Error('Failed to create production order');

  if (initialState) {
    // Append the initial state entry (authoritative log) + project onto case.
    await tx.insert(productionStateHistory).values({
      organizationId: ctx.organizationId,
      caseId,
      productionOrderId: order.id,
      fromStateId: null,
      toStateId: initialState.id,
      trigger: 'manual',
      actorUserId: ctx.userId,
      correlationId: ctx.correlationId,
    });
    await projectCaseStatus(tx, ctx, caseId, initialState.code);
  }

  await emitEvent(tx, ctx, {
    eventType: 'production.order.created',
    payload: { caseId, productionOrderId: order.id },
  });

  return order;
}

/** Ensure a 1:1 production order exists for a case (container). Idempotent. */
export async function ensureProductionOrder(
  ctx: RequestContext,
  caseId: string,
): Promise<ProductionOrder> {
  return withTransaction(ctx, async (tx) => {
    return ensureProductionOrderInTx(tx, ctx, caseId);
  });
}

export interface TransitionInput {
  caseId: string;
  toStateCode: string;
  reason?: string;
  /** Allows the segment-event driver (Sprint 10) to mark the trigger source. */
  trigger?: 'manual' | 'automatic' | 'event_driven';
  triggerEventType?: string;
}

/**
 * Transition a case to a new state. Validates the transition is defined in the
 * case's workflow, checks `production:transition`, appends to the authoritative
 * history log, and updates the projections (order + case status). Emits
 * `production.state.transitioned`.
 */
export async function transitionState(
  ctx: RequestContext,
  input: TransitionInput,
): Promise<void> {
  await requirePermission(ctx, 'production:transition');

  await withTransaction(ctx, async (tx) => {
    const orderRows = await tx
      .select()
      .from(productionOrders)
      .where(
        and(
          eq(productionOrders.organizationId, ctx.organizationId),
          eq(productionOrders.caseId, input.caseId),
        ),
      )
      .limit(1);
    const order = orderRows[0];
    if (!order) throw new Error('PRODUCTION_ORDER_NOT_FOUND');

    // Resolve target state by code within the order's workflow.
    const toRows = await tx
      .select()
      .from(workflowStates)
      .where(
        and(
          eq(workflowStates.workflowDefinitionId, order.workflowDefinitionId),
          eq(workflowStates.code, input.toStateCode),
        ),
      )
      .limit(1);
    const toState = toRows[0];
    if (!toState) throw new Error('TARGET_STATE_NOT_FOUND');

    // Validate the transition exists from the current state (unless first move).
    if (order.currentStateId) {
      const allowed = await tx
        .select({ id: workflowTransitions.id })
        .from(workflowTransitions)
        .where(
          and(
            eq(
              workflowTransitions.workflowDefinitionId,
              order.workflowDefinitionId,
            ),
            eq(workflowTransitions.fromStateId, order.currentStateId),
            eq(workflowTransitions.toStateId, toState.id),
          ),
        )
        .limit(1);
      if (!allowed[0]) {
        throw new Error('TRANSITION_NOT_ALLOWED');
      }
    }

    // Append the authoritative history row.
    await tx.insert(productionStateHistory).values({
      organizationId: ctx.organizationId,
      caseId: input.caseId,
      productionOrderId: order.id,
      fromStateId: order.currentStateId,
      toStateId: toState.id,
      trigger: input.trigger ?? 'manual',
      triggerEventType: input.triggerEventType ?? null,
      reason: input.reason ?? null,
      actorUserId: ctx.userId,
      correlationId: ctx.correlationId,
    });

    // Project: update the order pointer + the case status headline.
    await tx
      .update(productionOrders)
      .set({
        currentStateId: toState.id,
        updatedBy: ctx.userId,
        updatedAt: new Date(),
      })
      .where(eq(productionOrders.id, order.id));
    await projectCaseStatus(tx, ctx, input.caseId, toState.code);

    await recordAuditEvent(tx, ctx, {
      action: 'transitioned',
      entityTable: 'production_orders',
      entityId: order.id,
      reason: input.reason ?? 'State transition',
      after: { toState: toState.code, category: toState.category },
    });

    await emitEvent(tx, ctx, {
      eventType: 'production.state.transitioned',
      payload: {
        caseId: input.caseId,
        productionOrderId: order.id,
        fromStateId: order.currentStateId,
        toStateCode: toState.code,
        category: toState.category,
      },
    });
  });
}

/**
 * Project a workflow state code onto `cases.status`. The case status enum is a
 * coarse headline (intake/active/on_hold/delivered/closed/cancelled); we map the
 * workflow state's CATEGORY onto it. This is the projection — never the source
 * of truth.
 */
async function projectCaseStatus(
  tx: TenantTransaction,
  ctx: RequestContext,
  caseId: string,
  toStateCode: string,
): Promise<void> {
  const status = mapStateToCaseStatus(toStateCode);
  await tx
    .update(cases)
    .set({ status, updatedBy: ctx.userId, updatedAt: new Date() })
    .where(
      and(eq(cases.id, caseId), eq(cases.organizationId, ctx.organizationId)),
    );
}

/** Map a default workflow state code → the coarse case-status headline. */
function mapStateToCaseStatus(
  code: string,
): 'intake' | 'active' | 'on_hold' | 'delivered' | 'closed' | 'cancelled' {
  switch (code) {
    case 'received':
    case 'estimated':
      return 'intake';
    case 'awaiting_parts':
    case 'awaiting_approval':
    case 'awaiting_customer':
    case 'in_paint_cure':
      return 'on_hold';
    case 'delivered':
      return 'delivered';
    case 'cancelled':
    case 'total_loss':
      return 'cancelled';
    default:
      return 'active';
  }
}

/** Optionally invoked at org creation to pre-seed the workflow. */
export async function ensureWorkflowSeeded(
  organizationId: string,
): Promise<void> {
  await seedDefaultWorkflow(organizationId);
}
