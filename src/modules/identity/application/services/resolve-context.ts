import { randomUUID } from 'node:crypto';

import type { RequestContext } from '@/lib/tenancy/context';

import {
  listOrganizationsForUser,
  listWorkshops,
} from '../../infrastructure/repositories/identity-read-repository';

export interface ResolveContextResult {
  readonly context: RequestContext;
  readonly availableOrganizations: { id: string; name: string }[];
}

/**
 * Resolve the tenant context for an authenticated user (docs/05 step 3-4).
 *
 * Picks the requested organization when supplied and the user belongs to it;
 * otherwise the first active membership. Returns null when the user has no
 * active membership in any org. The accessible-workshop set is org-wide for
 * Sprint 2 (role-scoped narrowing arrives with RBAC in Sprint 3).
 */
export async function resolveRequestContext(
  userId: string,
  requestedOrgId?: string,
): Promise<ResolveContextResult | null> {
  const memberships = await listOrganizationsForUser(userId);
  if (memberships.length === 0) {
    return null;
  }

  const selected =
    (requestedOrgId &&
      memberships.find((m) => m.organization.id === requestedOrgId)) ||
    memberships[0];

  if (!selected) {
    return null;
  }

  const baseContext: RequestContext = {
    userId,
    organizationId: selected.organization.id,
    workshopId: selected.defaultWorkshopId,
    accessibleWorkshopIds: [],
    correlationId: randomUUID(),
  };

  const workshops = await listWorkshops(baseContext);

  const context: RequestContext = {
    ...baseContext,
    accessibleWorkshopIds: workshops.map((w) => w.id),
  };

  return {
    context,
    availableOrganizations: memberships.map((m) => ({
      id: m.organization.id,
      name: m.organization.name,
    })),
  };
}
