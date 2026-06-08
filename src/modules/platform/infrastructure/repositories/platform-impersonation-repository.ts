import { and, desc, eq, isNull } from 'drizzle-orm';

import { getRawClient } from '@/db/client';
import { platformImpersonationSessions } from '@/db/schemas/platform/platform-impersonation-sessions';
import type { PlatformImpersonationSession } from '@/db/types';

/**
 * Platform impersonation (docs/06-developer-control-plane.md). Opening a session
 * lets a platform user act inside a customer org for support — fully recorded
 * here AND audited to `platform_audit_events` at the call site (start + end).
 * Service-role only.
 */

export interface StartImpersonationInput {
  platformUserId: string;
  targetOrgId: string;
  targetUserId?: string | null;
  reason: string;
}

export async function startImpersonation(
  input: StartImpersonationInput,
): Promise<PlatformImpersonationSession> {
  const db = getRawClient({ as: 'platform-inspector' });
  const inserted = await db
    .insert(platformImpersonationSessions)
    .values({
      platformUserId: input.platformUserId,
      targetOrgId: input.targetOrgId,
      targetUserId: input.targetUserId ?? null,
      reason: input.reason,
    })
    .returning();
  return inserted[0]!;
}

export async function endImpersonation(
  sessionId: string,
): Promise<PlatformImpersonationSession | null> {
  const db = getRawClient({ as: 'platform-inspector' });
  const updated = await db
    .update(platformImpersonationSessions)
    .set({ endedAt: new Date() })
    .where(
      and(
        eq(platformImpersonationSessions.id, sessionId),
        isNull(platformImpersonationSessions.endedAt),
      ),
    )
    .returning();
  return updated[0] ?? null;
}

export interface ImpersonationRow {
  readonly id: string;
  readonly platformUserId: string;
  readonly targetOrgId: string;
  readonly reason: string;
  readonly startedAt: Date;
  readonly endedAt: Date | null;
}

export async function listImpersonationSessions(
  limit = 50,
): Promise<ImpersonationRow[]> {
  const db = getRawClient({ as: 'platform-inspector' });
  return db
    .select({
      id: platformImpersonationSessions.id,
      platformUserId: platformImpersonationSessions.platformUserId,
      targetOrgId: platformImpersonationSessions.targetOrgId,
      reason: platformImpersonationSessions.reason,
      startedAt: platformImpersonationSessions.startedAt,
      endedAt: platformImpersonationSessions.endedAt,
    })
    .from(platformImpersonationSessions)
    .orderBy(desc(platformImpersonationSessions.startedAt))
    .limit(limit);
}
