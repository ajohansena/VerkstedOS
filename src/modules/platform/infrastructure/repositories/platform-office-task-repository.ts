import { and, asc, desc, eq, inArray, isNull } from 'drizzle-orm';

import { getRawClient } from '@/db/client';
import { officeTasks } from '@/db/schemas/workforce/office-tasks';

/**
 * Office-task inspection + repair (Dev surface, /dev/office-tasks — D3 Phase B).
 *
 * Cross-org reads via the platform-inspector connection. The repair tool
 * force-cancels a stuck task — used when a Phase F template generated a wave
 * of bad tasks and we need to retire them without normal "cancel with reason"
 * paperwork in every org.
 */

export interface OfficeTaskRow {
  readonly id: string;
  readonly caseId: string | null;
  readonly workshopId: string | null;
  readonly title: string;
  readonly kind: string;
  readonly priority: string;
  readonly status: string;
  readonly dueAt: Date | null;
  readonly assigneeResourceId: string | null;
  readonly assigneeUserId: string | null;
  readonly generatedFromTemplateId: string | null;
  readonly createdAt: Date;
}

export async function listOfficeTasksForOrgPlatform(
  organizationId: string,
  limit = 200,
): Promise<OfficeTaskRow[]> {
  const db = getRawClient({ as: 'platform-inspector' });
  return db
    .select({
      id: officeTasks.id,
      caseId: officeTasks.caseId,
      workshopId: officeTasks.workshopId,
      title: officeTasks.title,
      kind: officeTasks.kind,
      priority: officeTasks.priority,
      status: officeTasks.status,
      dueAt: officeTasks.dueAt,
      assigneeResourceId: officeTasks.assigneeResourceId,
      assigneeUserId: officeTasks.assigneeUserId,
      generatedFromTemplateId: officeTasks.generatedFromTemplateId,
      createdAt: officeTasks.createdAt,
    })
    .from(officeTasks)
    .where(
      and(
        eq(officeTasks.organizationId, organizationId),
        isNull(officeTasks.deletedAt),
      ),
    )
    .orderBy(asc(officeTasks.status), desc(officeTasks.createdAt))
    .limit(limit);
}

/** Force-cancel an office task — a safe escape for bad bulk-generated tasks. */
export async function repairCancelOfficeTask(
  organizationId: string,
  taskId: string,
  reason: string,
): Promise<void> {
  const db = getRawClient({ as: 'platform-inspector' });
  await db
    .update(officeTasks)
    .set({
      status: 'cancelled',
      cancelledAt: new Date(),
      cancelledReason: reason,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(officeTasks.id, taskId),
        eq(officeTasks.organizationId, organizationId),
        inArray(officeTasks.status, ['open', 'in_progress']),
      ),
    );
}
