import { sql } from 'drizzle-orm';
import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

import { requireContext, type RequestContext } from '@/lib/tenancy/context';

import * as schema from './schemas';

/**
 * Tenant-aware Drizzle client (docs/03-data-model.md, docs/05-multi-tenant-and-rbac.md).
 *
 * Service code never constructs a raw client. The only ways to query are:
 *   - `withTransaction(ctx, fn)` — runs inside a transaction that first sets
 *     `app.current_org_id` / `app.current_user_id` / `app.current_workshop_id`
 *     session vars (transaction-scoped), which RLS policies read.
 *   - `getRawClient({ as })` — an explicit, grep-able escape hatch for admin /
 *     integration / platform-inspector code paths that legitimately run without
 *     (or across) org context.
 *
 * SECURITY NOTE: RLS only constrains a connection whose role is NOT a superuser
 * and does NOT have BYPASSRLS. In production the app must connect as a dedicated
 * non-superuser role (DATABASE_URL). Admin/bootstrap/platform operations use a
 * SEPARATE service-role connection (DATABASE_URL_ADMIN) that bypasses RLS — this
 * is how pre-org-context work (membership resolution, first-org onboarding,
 * integration inbox) runs. Repositories ALSO filter by `organization_id`
 * explicitly (the primary, always-effective defense); RLS is defense-in-depth.
 */

const connectionString = process.env.DATABASE_URL ?? '';
/** Service-role connection for admin/bootstrap/platform reads & writes. Falls
 * back to the tenant connection in local dev where a single superuser is used. */
const adminConnectionString =
  process.env.DATABASE_URL_ADMIN ?? process.env.DATABASE_URL ?? '';

const queryClient = postgres(connectionString, { max: 10 });
const adminQueryClient =
  adminConnectionString === connectionString
    ? queryClient
    : postgres(adminConnectionString, { max: 5 });

const baseDb = drizzle(queryClient, { schema });
const adminDb = drizzle(adminQueryClient, { schema });

export type Database = PostgresJsDatabase<typeof schema>;
export type TenantTransaction = Parameters<
  Parameters<Database['transaction']>[0]
>[0];

/** Set transaction-scoped tenant session vars that RLS policies read. */
async function setTenantVars(
  tx: TenantTransaction,
  ctx: RequestContext,
): Promise<void> {
  await tx.execute(
    sql`select set_config('app.current_org_id', ${ctx.organizationId}, true)`,
  );
  await tx.execute(
    sql`select set_config('app.current_user_id', ${ctx.userId}, true)`,
  );
  await tx.execute(
    sql`select set_config('app.current_workshop_id', ${ctx.workshopId ?? ''}, true)`,
  );
}

/**
 * Run `fn` inside a transaction with tenant context applied. If `ctx` is
 * omitted it is read from AsyncLocalStorage (and throws if absent), so no query
 * can run without an organization context.
 */
export async function withTransaction<T>(
  ctx: RequestContext | undefined,
  fn: (tx: TenantTransaction) => Promise<T>,
): Promise<T> {
  const context = ctx ?? requireContext();
  return baseDb.transaction(async (tx) => {
    await setTenantVars(tx, context);
    return fn(tx);
  });
}

export type RawAccessMode = 'admin' | 'integration' | 'platform-inspector';

/**
 * Explicit escape hatch for code that runs without org context (seeds,
 * onboarding that creates the first org, integration inbox) or across orgs
 * (platform inspector). Returns the service-role connection that bypasses RLS.
 * Grep `getRawClient` to audit every such call site.
 */
export function getRawClient(_opts: { as: RawAccessMode }): Database {
  return adminDb;
}

/**
 * Run `fn` in platform-inspector mode against a target org: read-only access
 * across the org boundary (RLS recognizes `app.is_platform_inspector`). Writes
 * are NOT granted by this flag (see docs/06-developer-control-plane.md).
 */
export async function withPlatformInspector<T>(
  targetOrgId: string,
  fn: (tx: TenantTransaction) => Promise<T>,
): Promise<T> {
  return baseDb.transaction(async (tx) => {
    await tx.execute(
      sql`select set_config('app.is_platform_inspector', 'true', true)`,
    );
    await tx.execute(
      sql`select set_config('app.current_org_id', ${targetOrgId}, true)`,
    );
    return fn(tx);
  });
}
