import { and, desc, eq, isNull } from 'drizzle-orm';

import { getRawClient } from '@/db/client';
import { taskTemplates } from '@/db/schemas/workforce/task-templates';

/**
 * Task-template inspection (Dev surface, /dev/task-templates — D3 Phase F).
 *
 * Cross-org reads via the platform-inspector connection. Read-only — repair
 * (force-disable a runaway template) is exposed as a separate function so it
 * stays auditable via the dev actions route.
 */

export interface TaskTemplateRow {
  readonly id: string;
  readonly name: string;
  readonly triggerEventType: string;
  readonly triggerEventFilter: unknown;
  readonly taskKind: string;
  readonly taskTitleTemplate: string;
  readonly dueOffsetMinutes: number;
  readonly dueReference: string;
  readonly isActive: boolean;
  readonly createdAt: Date;
}

export async function listTaskTemplatesForOrgPlatform(
  organizationId: string,
  limit = 200,
): Promise<TaskTemplateRow[]> {
  const db = getRawClient({ as: 'platform-inspector' });
  return db
    .select({
      id: taskTemplates.id,
      name: taskTemplates.name,
      triggerEventType: taskTemplates.triggerEventType,
      triggerEventFilter: taskTemplates.triggerEventFilter,
      taskKind: taskTemplates.taskKind,
      taskTitleTemplate: taskTemplates.taskTitleTemplate,
      dueOffsetMinutes: taskTemplates.dueOffsetMinutes,
      dueReference: taskTemplates.dueReference,
      isActive: taskTemplates.isActive,
      createdAt: taskTemplates.createdAt,
    })
    .from(taskTemplates)
    .where(
      and(
        eq(taskTemplates.organizationId, organizationId),
        isNull(taskTemplates.deletedAt),
      ),
    )
    .orderBy(desc(taskTemplates.createdAt))
    .limit(limit);
}

/**
 * Force-disable a task template — used when a template is producing bad office
 * tasks across an org and the admin team can't reach it in time.
 */
export async function repairDisableTaskTemplate(
  organizationId: string,
  templateId: string,
): Promise<void> {
  const db = getRawClient({ as: 'platform-inspector' });
  await db
    .update(taskTemplates)
    .set({ isActive: false, updatedAt: new Date() })
    .where(
      and(
        eq(taskTemplates.id, templateId),
        eq(taskTemplates.organizationId, organizationId),
      ),
    );
}
