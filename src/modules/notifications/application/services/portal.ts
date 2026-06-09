/**
 * Customer portal service (Sprint 17). Token issuance + resolution. The
 * portal route is unauth'd by token; resolution is server-side and strict.
 */

import type { RequestContext } from '@/lib/tenancy/context';
import type { DigitalSignature, PortalToken } from '@/db/types';
import { requirePermission } from '@/modules/identity/public';
import {
  appendCustomerPortalSignature,
  readPortalSignature,
} from '@/modules/quality/public';

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

/**
 * Customer-initiated portal signing (Sprint 20). The portal route validates
 * the token, then calls this with the customer's name + the same payload
 * the portal renders. Throws if the token is missing/expired/revoked, if the
 * customer is missing data, or if the case already has a customer signature.
 */
export interface SignByTokenInput {
  token: string;
  signerName: string;
  evidence?: Record<string, unknown>;
}

export type SignByTokenResult =
  | { ok: true; signature: DigitalSignature }
  | {
      ok: false;
      reason:
        | 'token_invalid'
        | 'token_expired'
        | 'token_revoked'
        | 'name_required'
        | 'already_signed';
    };

export async function signRepairAcceptanceByToken(
  input: SignByTokenInput,
): Promise<SignByTokenResult> {
  const resolved = await lookupInfra(input.token);
  if (!resolved) return { ok: false, reason: 'token_invalid' };
  if (!resolved.active) {
    return {
      ok: false,
      reason: resolved.reason === 'expired' ? 'token_expired' : 'token_revoked',
    };
  }
  const signerName = input.signerName.trim();
  if (signerName.length < 2) {
    return { ok: false, reason: 'name_required' };
  }

  // Existing signature short-circuit (the portal also displays this state).
  const existing = await readPortalSignature(
    resolved.token.organizationId,
    resolved.token.caseId,
  );
  if (existing) {
    return { ok: false, reason: 'already_signed' };
  }

  const payload = JSON.stringify({
    kind: 'repair_acceptance',
    caseId: resolved.token.caseId,
    signerName,
    tokenId: resolved.token.id,
  });
  try {
    const signature = await appendCustomerPortalSignature({
      organizationId: resolved.token.organizationId,
      caseId: resolved.token.caseId,
      signerName,
      payload,
      ...(input.evidence ? { evidence: input.evidence } : {}),
    });
    await recordUseInfra(resolved.token.id);
    return { ok: true, signature };
  } catch (err) {
    if (err instanceof Error && err.message === 'PORTAL_ALREADY_SIGNED') {
      return { ok: false, reason: 'already_signed' };
    }
    throw err;
  }
}

export async function readPortalSignatureByCase(
  organizationId: string,
  caseId: string,
): Promise<DigitalSignature | null> {
  return readPortalSignature(organizationId, caseId);
}
