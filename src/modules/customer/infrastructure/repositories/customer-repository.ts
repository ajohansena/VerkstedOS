import { and, desc, eq, ilike, isNull, or, sql } from 'drizzle-orm';

import { withTransaction, type TenantTransaction } from '@/db/client';
import { customers } from '@/db/schemas/customer/customers';
import type { Customer } from '@/db/types';
import type { RequestContext } from '@/lib/tenancy/context';

/**
 * Customer repository (org-scoped). Every query filters by `organization_id`
 * explicitly (primary defense) and runs through the tenant client (RLS backstop).
 */

export async function insertCustomer(
  tx: TenantTransaction,
  ctx: RequestContext,
  values: {
    kind: Customer['kind'];
    name: string;
    identifier?: string | null;
    identifierKind?: Customer['identifierKind'];
    primaryEmail?: string | null;
    primaryPhone?: string | null;
    notes?: string | null;
  },
): Promise<Customer> {
  const rows = await tx
    .insert(customers)
    .values({
      organizationId: ctx.organizationId,
      kind: values.kind,
      name: values.name,
      identifier: values.identifier ?? null,
      identifierKind: values.identifierKind ?? null,
      primaryEmail: values.primaryEmail ?? null,
      primaryPhone: values.primaryPhone ?? null,
      notes: values.notes ?? null,
      createdBy: ctx.userId,
      updatedBy: ctx.userId,
    })
    .returning();
  const customer = rows[0];
  if (!customer) throw new Error('Failed to insert customer');
  return customer;
}

export async function findCustomerById(
  ctx: RequestContext,
  id: string,
): Promise<Customer | null> {
  return withTransaction(ctx, async (tx) => {
    const rows = await tx
      .select()
      .from(customers)
      .where(
        and(
          eq(customers.id, id),
          eq(customers.organizationId, ctx.organizationId),
          isNull(customers.deletedAt),
        ),
      )
      .limit(1);
    return rows[0] ?? null;
  });
}

/** Free-text search across name, phone, email, and identifier. */
export async function searchCustomers(
  ctx: RequestContext,
  query: string,
  limit = 25,
): Promise<Customer[]> {
  const like = `%${query.trim()}%`;
  return withTransaction(ctx, async (tx) => {
    return tx
      .select()
      .from(customers)
      .where(
        and(
          eq(customers.organizationId, ctx.organizationId),
          isNull(customers.deletedAt),
          or(
            ilike(customers.name, like),
            ilike(customers.primaryPhone, like),
            ilike(customers.primaryEmail, like),
            ilike(customers.identifier, like),
          ),
        ),
      )
      .orderBy(customers.name)
      .limit(limit);
  });
}

export async function updateCustomerRow(
  tx: TenantTransaction,
  ctx: RequestContext,
  id: string,
  changes: Partial<{
    name: string;
    identifier: string | null;
    identifierKind: Customer['identifierKind'];
    primaryEmail: string | null;
    primaryPhone: string | null;
    notes: string | null;
  }>,
): Promise<Customer> {
  const rows = await tx
    .update(customers)
    .set({ ...changes, updatedBy: ctx.userId, updatedAt: new Date() })
    .where(
      and(
        eq(customers.id, id),
        eq(customers.organizationId, ctx.organizationId),
        isNull(customers.deletedAt),
      ),
    )
    .returning();
  const customer = rows[0];
  if (!customer) throw new Error(`Customer ${id} not found`);
  return customer;
}

export async function softDeleteCustomer(
  tx: TenantTransaction,
  ctx: RequestContext,
  id: string,
): Promise<void> {
  await tx
    .update(customers)
    .set({ deletedAt: new Date(), updatedBy: ctx.userId })
    .where(
      and(
        eq(customers.id, id),
        eq(customers.organizationId, ctx.organizationId),
        isNull(customers.deletedAt),
      ),
    );
}

/** Count of live customers in the org (Admin/Dev overview). */
export async function countCustomers(ctx: RequestContext): Promise<number> {
  return withTransaction(ctx, async (tx) => {
    const rows = await tx
      .select({ n: sql<number>`count(*)::int` })
      .from(customers)
      .where(
        and(
          eq(customers.organizationId, ctx.organizationId),
          isNull(customers.deletedAt),
        ),
      );
    return rows[0]?.n ?? 0;
  });
}

/** Most-recently-updated customers (list view). */
export async function listRecentCustomers(
  ctx: RequestContext,
  limit = 25,
): Promise<Customer[]> {
  return withTransaction(ctx, async (tx) => {
    return tx
      .select()
      .from(customers)
      .where(
        and(
          eq(customers.organizationId, ctx.organizationId),
          isNull(customers.deletedAt),
        ),
      )
      .orderBy(desc(customers.updatedAt))
      .limit(limit);
  });
}
