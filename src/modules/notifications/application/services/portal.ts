/**
 * Customer portal service (Sprint 17). Token issuance + resolution. The
 * portal route is unauth'd by token; resolution is server-side and strict.
 */

import type { RequestContext } from '@/lib/tenancy/context';
import type { PortalToken } from '@/db/types';
import { requirePermission } from '@/modules/identity/public';

import {
  createPortalToken as createInfra,
  generatePortalToken,
  lookupPortalToken as lookupInfra,
  recordPortalTokenUse as recordUseInfra,
  revokePortalToken as revokeInfra,
  type CreatePortalTokenInput,
  type ResolvedToken,
} from '../../infrastructure/repositories/portal-token-repository';

const DEFAULT_TTL_DAYS = 30;
const DAY_MS = 86400000;

export async function issuePortalToken(
  ctx: RequestContext,
  input: Omit<CreatePortalTokenInput, 'expiresAt'> & {
    ttlDays?: number;
    expiresAt?: Date;
  },
): Promise<PortalToken> {
  await requirePermission(ctx, 'case:edit');
  const expiresAt =
    input.expiresAt ??
    new Date(Date.now() + (input.ttlDays ?? DEFAULT_TTL_DAYS) * DAY_MS);
  return createInfra(ctx, {
    caseId: input.caseId,
    scope: input.scope,
    sentTo: input.sentTo ?? null,
    expiresAt,
  });
}

export function resolvePortalToken(token: string): Promise<ResolvedToken | null> {
  return lookupInfra(token);
}

export async function touchPortalToken(tokenId: string): Promise<void> {
  await recordUseInfra(tokenId);
}

export async function revokePortalTokenById(
  ctx: RequestContext,
  tokenId: string,
): Promise<void> {
  await requirePermission(ctx, 'case:edit');
  await revokeInfra(ctx, tokenId);
}

// Re-export for tests / scripts.
export { generatePortalToken };
