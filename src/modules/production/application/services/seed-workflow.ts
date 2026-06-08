import { and, eq } from 'drizzle-orm';

import { getRawClient } from '@/db/client';
import { workflowDefinitions } from '@/db/schemas/production/workflow-definitions';
import { workflowStates } from '@/db/schemas/production/workflow-states';
import { workflowTransitions } from '@/db/schemas/production/workflow-transitions';
import {
  DEFAULT_WORKFLOW_NAME,
  DEFAULT_WORKFLOW_STATES,
  DEFAULT_WORKFLOW_TRANSITIONS,
} from '@/lib/seed/default-workflow';

/**
 * Seed the default Norwegian collision-repair workflow for an organization
 * (docs/10-production-domain.md, ADR-006). Idempotent: returns the existing
 * active definition id if one is already present. Runs on the service-role
 * connection (bootstrap, around org creation).
 */
export async function seedDefaultWorkflow(
  organizationId: string,
): Promise<string> {
  const db = getRawClient({ as: 'admin' });

  const existing = await db
    .select({ id: workflowDefinitions.id })
    .from(workflowDefinitions)
    .where(
      and(
        eq(workflowDefinitions.organizationId, organizationId),
        eq(workflowDefinitions.isActive, true),
      ),
    )
    .limit(1);
  if (existing[0]) return existing[0].id;

  const insertedDef = await db
    .insert(workflowDefinitions)
    .values({
      organizationId,
      name: DEFAULT_WORKFLOW_NAME,
      versionNumber: 1,
      isActive: true,
    })
    .returning({ id: workflowDefinitions.id });
  const definitionId = insertedDef[0]?.id;
  if (!definitionId) throw new Error('Failed to seed workflow definition');

  // States — keep a code → id map for transition wiring.
  const stateIdByCode = new Map<string, string>();
  let seq = 0;
  for (const s of DEFAULT_WORKFLOW_STATES) {
    const inserted = await db
      .insert(workflowStates)
      .values({
        organizationId,
        workflowDefinitionId: definitionId,
        code: s.code,
        label: s.label,
        category: s.category,
        colorHint: s.colorHint,
        isInitial: s.isInitial ?? false,
        sequenceNo: seq++,
      })
      .returning({ id: workflowStates.id });
    const id = inserted[0]?.id;
    if (id) stateIdByCode.set(s.code, id);
  }

  // Transitions.
  for (const t of DEFAULT_WORKFLOW_TRANSITIONS) {
    const fromId = stateIdByCode.get(t.from);
    const toId = stateIdByCode.get(t.to);
    if (!fromId || !toId) continue;
    await db.insert(workflowTransitions).values({
      organizationId,
      workflowDefinitionId: definitionId,
      fromStateId: fromId,
      toStateId: toId,
      trigger: t.trigger,
      eventType: t.eventType ?? null,
      requiredPermissions: (t.requiredPermissions ?? null) as never,
    });
  }

  return definitionId;
}
