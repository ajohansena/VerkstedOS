import { withTransaction, type TenantTransaction } from '@/db/client';
import { recordAuditEvent } from '@/lib/audit/audit-writer';
import { emitEvent } from '@/lib/events/outbox';
import type { Resource } from '@/db/types';
import type { RequestContext } from '@/lib/tenancy/context';
import { requirePermission } from '@/modules/identity/public';

import {
  archiveResourceInTx,
  findResourceByEmployeeIdInTx,
  insertResourceInTx,
  updateResourceInTx,
  type InsertResourceValues,
  type UpdateResourceValues,
} from '../../infrastructure/repositories/resource-repository';

/**
 * Resource management (Admin surface). Permission: `admin:config`.
 *
 * Resources are the SSoT for capacity planning (docs/10-production-domain.md §
 * Resource model). People, equipment and facilities are first-class. Person
 * resources optionally link to an `employee` so the capacity engine can
 * subtract approved absence minutes.
 */

export interface CreateResourceInput {
  kind: Resource['kind'];
  name: string;
  workshopId?: string | null;
  employeeId?: string | null;
  metadata?: Record<string, unknown> | null;
}

export async function createResource(
  ctx: RequestContext,
  input: CreateResourceInput,
): Promise<Resource> {
  await requirePermission(ctx, 'admin:config');
  return withTransaction(ctx, async (tx) => {
    const resource = await insertResourceInTx(tx, ctx, input);
    await recordAuditEvent(tx, ctx, {
      action: 'created',
      entityTable: 'resources',
      entityId: resource.id,
      after: { name: resource.name, kind: resource.kind },
    });
    await emitEvent(tx, ctx, {
      eventType: 'workforce.resource.created',
      payload: {
        resourceId: resource.id,
        kind: resource.kind,
        employeeId: resource.employeeId,
      },
    });
    return resource;
  });
}

export async function updateResource(
  ctx: RequestContext,
  id: string,
  values: UpdateResourceValues,
): Promise<Resource | null> {
  await requirePermission(ctx, 'admin:config');
  return withTransaction(ctx, async (tx) => {
    const updated = await updateResourceInTx(tx, ctx, id, values);
    if (updated) {
      await recordAuditEvent(tx, ctx, {
        action: 'updated',
        entityTable: 'resources',
        entityId: updated.id,
        after: values as Record<string, unknown>,
      });
    }
    return updated;
  });
}

export async function archiveResource(
  ctx: RequestContext,
  id: string,
): Promise<Resource | null> {
  await requirePermission(ctx, 'admin:config');
  return withTransaction(ctx, async (tx) => {
    const archived = await archiveResourceInTx(tx, ctx, id);
    if (archived) {
      await recordAuditEvent(tx, ctx, {
        action: 'updated',
        entityTable: 'resources',
        entityId: archived.id,
        after: { archivedAt: archived.deletedAt },
      });
      await emitEvent(tx, ctx, {
        eventType: 'workforce.resource.archived',
        payload: { resourceId: archived.id },
      });
    }
    return archived;
  });
}

/**
 * Helper used during `createEmployee` to auto-create the matching person
 * Resource in the SAME transaction (Sprint 22, doc 10 § Resource model). The
 * helper is idempotent: if a resource already links to the employee it is
 * returned unchanged.
 */
export async function ensurePersonResourceForEmployeeInTx(
  tx: TenantTransaction,
  ctx: RequestContext,
  args: {
    employeeId: string;
    name: string;
    workshopId?: string | null;
  },
): Promise<Resource> {
  const existing = await findResourceByEmployeeIdInTx(tx, ctx, args.employeeId);
  if (existing) return existing;

  const values: InsertResourceValues = {
    kind: 'person',
    name: args.name,
    employeeId: args.employeeId,
    workshopId: args.workshopId ?? null,
  };
  const resource = await insertResourceInTx(tx, ctx, values);
  await recordAuditEvent(tx, ctx, {
    action: 'created',
    entityTable: 'resources',
    entityId: resource.id,
    after: {
      name: resource.name,
      kind: resource.kind,
      autoCreated: 'from_employee',
    },
  });
  await emitEvent(tx, ctx, {
    eventType: 'workforce.resource.created',
    payload: {
      resourceId: resource.id,
      kind: 'person',
      employeeId: args.employeeId,
      autoCreated: true,
    },
  });
  return resource;
}
