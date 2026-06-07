import type { TenantTransaction } from '@/db/client';
import type { PermissionCode } from '@/lib/permissions/catalog';
import type { RequestContext } from '@/lib/tenancy/context';

import { hasPermission, type PermissionScope } from './permission-resolver';

/**
 * Thrown when a permission check fails. Carries the missing permission so the
 * presentation layer can render a clear, specific message
 * (CLAUDE.md authorization pipeline step 3).
 */
export class PermissionDeniedError extends Error {
  readonly code = 'PERMISSION_DENIED';
  constructor(
    readonly permission: PermissionCode,
    readonly scope: PermissionScope,
  ) {
    super(`Missing permission: ${permission}`);
    this.name = 'PermissionDeniedError';
  }
}

/**
 * Service-layer authorization guard. Call FIRST in every use-case
 * (docs/05-multi-tenant-and-rbac.md § Authorization in code). Throws
 * `PermissionDeniedError` when the permission is absent at the requested scope.
 *
 * This is the rich, business-aware layer; RLS in Postgres is the coarse
 * defense-in-depth backstop. Both are required.
 */
export async function requirePermission(
  ctx: RequestContext,
  permission: PermissionCode,
  scope: PermissionScope = {},
  tx?: TenantTransaction,
): Promise<void> {
  const allowed = await hasPermission(ctx, permission, scope, tx);
  if (!allowed) {
    throw new PermissionDeniedError(permission, scope);
  }
}
