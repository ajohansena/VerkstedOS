import { and, asc, desc, eq, inArray, isNull, or } from 'drizzle-orm';

import { withTransaction } from '@/db/client';
import { officeTasks } from '@/db/schemas/workforce/office-tasks';
import type { OfficeTask } from '@/db/types';
import type { RequestContext } from '@/lib/tenancy/context';

/**
 * Office-task reads. The service-layer mutators (create / assign / complete /
 * cancel) run inside their own `withTransaction` and write the row + audit +
 * outbox event atomically; this repository owns the read side + helpers.
 *
 * All reads go through the tenant-aware client so RLS is always in scope.
 */

export async function findOfficeTaskById(
  ctx: RequestContext,
  id: string,
): Promise<OfficeTask | null> {
  return withTransaction(ctx, async (tx) => {
    const rows = await tx
      .select()
      .from(officeTasks)
      .where(
        and(
          eq(officeTasks.id, id),
          eq(officeTasks.organizationId, ctx.organizationId),
          isNull(officeTasks.deletedAt),
        ),
      )
      .limit(1);
    return rows[0] ?? null;
  });
}

export async function listOfficeTasksForCase(
  ctx: RequestContext,
  caseId: string,
): Promise<OfficeTask[]> {
  return withTransaction(ctx, async (tx) =>
    tx
      .select()
      .from(officeTasks)
      .where(
        and(
          eq(officeTasks.organizationId, ctx.organizationId),
          eq(officeTasks.caseId, caseId),
          isNull(officeTasks.deletedAt),
        ),
      )
      .orderBy(asc(officeTasks.dueAt), desc(officeTasks.createdAt)),
  );
}

/**
 * Tasks assigned to the current user — directly OR via a resource the user is
 * the employee for. The resource link is the planner's primary path (a
 * technician is a `person` resource); the direct user link is the fallback for
 * office staff who aren't modeled as resources.
 *
 * `resourceIds` is the resolved set of resource ids that map back to the
 * current `ctx.userId`; the caller computes it.
 */
export async function listMyOpenOfficeTasks(
  ctx: RequestContext,
  resourceIds: ReadonlyArray<string>,
): Promise<OfficeTask[]> {
  return withTransaction(ctx, async (tx) => {
    const baseConds = [
      eq(officeTasks.organizationId, ctx.organizationId),
      inArray(officeTasks.status, ['open', 'in_progress']),
      isNull(officeTasks.deletedAt),
    ];
    const ownership = ctx.userId
      ? resourceIds.length > 0
        ? or(
            eq(officeTasks.assigneeUserId, ctx.userId),
            inArray(officeTasks.assigneeResourceId, [...resourceIds]),
          )
        : eq(officeTasks.assigneeUserId, ctx.userId)
      : resourceIds.length > 0
        ? inArray(officeTasks.assigneeResourceId, [...resourceIds])
        : null;
    if (!ownership) return [];
    return tx
      .select()
      .from(officeTasks)
      .where(and(...baseConds, ownership))
      .orderBy(asc(officeTasks.dueAt));
  });
}

export async function listOpenOfficeTasksForWorkshop(
  ctx: RequestContext,
  workshopId: string,
): Promise<OfficeTask[]> {
  return withTransaction(ctx, async (tx) =>
    tx
      .select()
      .from(officeTasks)
      .where(
        and(
          eq(officeTasks.organizationId, ctx.organizationId),
          eq(officeTasks.workshopId, workshopId),
          inArray(officeTasks.status, ['open', 'in_progress']),
          isNull(officeTasks.deletedAt),
        ),
      )
      .orderBy(asc(officeTasks.dueAt)),
  );
}

export async function listOpenOfficeTasksForOrg(
  ctx: RequestContext,
  limit = 500,
): Promise<OfficeTask[]> {
  return withTransaction(ctx, async (tx) =>
    tx
      .select()
      .from(officeTasks)
      .where(
        and(
          eq(officeTasks.organizationId, ctx.organizationId),
          inArray(officeTasks.status, ['open', 'in_progress']),
          isNull(officeTasks.deletedAt),
        ),
      )
      .orderBy(asc(officeTasks.dueAt))
      .limit(limit),
  );
}
