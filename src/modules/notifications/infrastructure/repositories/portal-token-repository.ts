/**
 * Portal token repository (Sprint 17). The portal token is the auth — lookup
 * is unauth'd from the customer's perspective, but server-side we look up via
 * the admin Drizzle client and immediately verify the token is unrevoked and
 * not expired. All writes go through the tenant-aware client.
 */

import { randomBytes } from 'node:crypto';

import { and, eq, sql } from 'drizzle-orm';

import { getRawClient, withTransaction } from '@/db/client';
import { portalTokens } from '@/db/schemas/notifications/portal-tokens';
import type { NewPortalToken, PortalToken } from '@/db/types';
import type { RequestContext } from '@/lib/tenancy/context';

export type TokenScope = PortalToken['scope'];

export interface CreatePortalTokenInput {
  caseId: string;
  scope: TokenScope;
  expiresAt: Date;
  sentTo?: string | null;
}

/** Generate a URL-safe random token (default 24 bytes ≈ 32 chars). */
export function generatePortalToken(byteLength = 24): string {
  return randomBytes(byteLength)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

export async function createPortalToken(
  ctx: RequestContext,
  input: CreatePortalTokenInput,
): Promise<PortalToken> {
  const token = generatePortalToken();
  return withTransaction(ctx, async (tx) => {
    const values: NewPortalToken = {
      organizationId: ctx.organizationId,
      caseId: input.caseId,
      scope: input.scope,
      token,
      expiresAt: input.expiresAt,
      sentTo: input.sentTo ?? null,
      createdBy: ctx.userId,
      updatedBy: ctx.userId,
    };
    const [row] = await tx.insert(portalTokens).values(values).returning();
    if (!row) throw new Error('Failed to create portal token');
    return row;
  });
}

export interface ResolvedToken {
  readonly token: PortalToken;
  readonly active: boolean;
  readonly reason?: 'expired' | 'revoked';
}

/**
 * Look up a token without an authenticated user. Uses the admin client (the
 * token IS the credential). Returns whether the token is currently active so
 * the portal can render an expired/revoked page rather than 404.
 */
export async function lookupPortalToken(
  token: string,
): Promise<ResolvedToken | null> {
  const db = getRawClient({ as: 'admin' });
  const rows = await db
    .select()
    .from(portalTokens)
    .where(eq(portalTokens.token, token))
    .limit(1);
  const row = rows[0];
  if (!row) return null;
  const now = new Date();
  if (row.revokedAt) return { token: row, active: false, reason: 'revoked' };
  if (new Date(row.expiresAt) < now)
    return { token: row, active: false, reason: 'expired' };
  return { token: row, active: true };
}

/**
 * Mark a token as used (first use sets `first_used_at`; every use refreshes
 * `last_used_at`). Uses the admin client because the caller is unauth'd.
 */
export async function recordPortalTokenUse(tokenId: string): Promise<void> {
  const db = getRawClient({ as: 'admin' });
  await db
    .update(portalTokens)
    .set({
      firstUsedAt: sql`COALESCE(${portalTokens.firstUsedAt}, now())`,
      lastUsedAt: sql`now()`,
      updatedAt: sql`now()`,
    })
    .where(eq(portalTokens.id, tokenId));
}

export async function revokePortalToken(
  ctx: RequestContext,
  tokenId: string,
): Promise<void> {
  await withTransaction(ctx, async (tx) => {
    await tx
      .update(portalTokens)
      .set({
        revokedAt: sql`now()`,
        updatedAt: sql`now()`,
        updatedBy: ctx.userId,
      })
      .where(
        and(
          eq(portalTokens.id, tokenId),
          eq(portalTokens.organizationId, ctx.organizationId),
        ),
      );
  });
}
