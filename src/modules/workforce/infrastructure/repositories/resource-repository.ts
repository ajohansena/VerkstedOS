import { and, eq, isNull } from 'drizzle-orm';

import { withTransaction, type TenantTransaction } from '@/db/client';
import { resources } from '@/db/schemas/workforce/resources';
import type { Resource } from '@/db/types';
import type { RequestContext } from '@/lib/tenancy/context';

/**
 * Resource repository (org-scoped). Resources are the SSoT for capacity
 * planning (docs/10-production-domain.md § Resource model) — people, equipment
 * and facilities are all first-class. A `person` resource links to an employee
 * so the capacity engine can subtract approved absence minutes.
 */

export interface InsertResourceValues {
  kind: Resource['kind'];
  name: string;
  workshopId?: string | null;
  employeeId?: string | null;
  metadata?: Record<string, unknown> | null;
  status?: Resource['status'];
}

export async function insertResourceInTx(
  tx: TenantTransaction,
  ctx: RequestContext,
  values: InsertResourceValues,
): Promise<Resource> {
  const rows = await tx
    .insert(resources)
    .values({
      organizationId: ctx.organizationId,
      workshopId: values.workshopId ?? ctx.workshopId ?? null,
      kind: values.kind,
      name: values.name,
      employeeId: values.employeeId ?? null,
      metadata: (values.metadata ?? null) as never,
      status: values.status ?? 'active',
      createdBy: ctx.userId,
      updatedBy: ctx.userId,
    })
    .returning();
  const resource = rows[0];
  if (!resource) throw new Error('Failed to insert resource');
  return resource;
}

export async function findResourceByEmployeeIdInTx(
  tx: TenantTransaction,
  ctx: RequestContext,
  employeeId: string,
): Promise<Resource | null> {
  const rows = await tx
    .select()
    .from(resources)
    .where(
      and(
        eq(resources.organizationId, ctx.organizationId),
        eq(resources.employeeId, employeeId),
        isNull(resources.deletedAt),
      ),
    )
    .limit(1);
  return rows[0] ?? null;
}

export async function findResourceById(
  ctx: RequestContext,
  id: string,
): Promise<Resource | null> {
  return withTransaction(ctx, async (tx) => {
    const rows = await tx
      .select()
      .from(resources)
      .where(
        and(
          eq(resources.id, id),
          eq(resources.organizationId, ctx.organizationId),
        ),
      )
      .limit(1);
    return rows[0] ?? null;
  });
}

export async function listResources(ctx: RequestContext): Promise<Resource[]> {
  return withTransaction(ctx, async (tx) => {
    return tx
      .select()
      .from(resources)
      .where(
        and(
          eq(resources.organizationId, ctx.organizationId),
          isNull(resources.deletedAt),
        ),
      )
      .orderBy(resources.kind, resources.name);
  });
}

export interface UpdateResourceValues {
  name?: string;
  status?: Resource['status'];
  workshopId?: string | null;
  metadata?: Record<string, unknown> | null;
}

export async function updateResourceInTx(
  tx: TenantTransaction,
  ctx: RequestContext,
  id: string,
  values: UpdateResourceValues,
): Promise<Resource | null> {
  const patch: {
    updatedBy: string | null;
    updatedAt: Date;
    name?: string;
    status?: Resource['status'];
    workshopId?: string | null;
    metadata?: Record<string, unknown> | null;
  } = {
    updatedBy: ctx.userId,
    updatedAt: new Date(),
  };
  if (values.name !== undefined) patch.name = values.name;
  if (values.status !== undefined) patch.status = values.status;
  if (values.workshopId !== undefined) patch.workshopId = values.workshopId;
  if (values.metadata !== undefined) patch.metadata = values.metadata;

  const rows = await tx
    .update(resources)
    .set(patch)
    .where(
      and(
        eq(resources.id, id),
        eq(resources.organizationId, ctx.organizationId),
      ),
    )
    .returning();
  return rows[0] ?? null;
}

export async function archiveResourceInTx(
  tx: TenantTransaction,
  ctx: RequestContext,
  id: string,
): Promise<Resource | null> {
  const rows = await tx
    .update(resources)
    .set({
      deletedAt: new Date(),
      updatedAt: new Date(),
      updatedBy: ctx.userId,
    })
    .where(
      and(
        eq(resources.id, id),
        eq(resources.organizationId, ctx.organizationId),
        isNull(resources.deletedAt),
      ),
    )
    .returning();
  return rows[0] ?? null;
}
