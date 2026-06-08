import { and, eq, isNull } from 'drizzle-orm';

import { getRawClient } from '@/db/client';
import { featureFlags } from '@/db/schemas/platform/feature-flags';
import type { FeatureFlag } from '@/db/types';

/**
 * Feature flags (docs/06-developer-control-plane.md). Platform-managed toggles,
 * read in-app via `isFeatureEnabled`. A global default row (`organization_id`
 * null) can be overridden per org. All writes go through the Dev plane on the
 * service-role connection and are audited at the call site.
 */

export interface FeatureFlagRow {
  readonly id: string;
  readonly organizationId: string | null;
  readonly key: string;
  readonly enabled: boolean;
  readonly description: string | null;
}

export async function listFeatureFlags(): Promise<FeatureFlagRow[]> {
  const db = getRawClient({ as: 'platform-inspector' });
  return db
    .select({
      id: featureFlags.id,
      organizationId: featureFlags.organizationId,
      key: featureFlags.key,
      enabled: featureFlags.enabled,
      description: featureFlags.description,
    })
    .from(featureFlags)
    .orderBy(featureFlags.key);
}

/** Upsert a flag (global when organizationId is null), returning the new state. */
export async function setFeatureFlag(input: {
  key: string;
  enabled: boolean;
  organizationId?: string | null;
  description?: string | null;
  platformUserId?: string | null;
}): Promise<FeatureFlag> {
  const db = getRawClient({ as: 'platform-inspector' });
  const orgId = input.organizationId ?? null;

  const existing = await db
    .select()
    .from(featureFlags)
    .where(
      and(
        eq(featureFlags.key, input.key),
        orgId === null
          ? isNull(featureFlags.organizationId)
          : eq(featureFlags.organizationId, orgId),
      ),
    )
    .limit(1);

  if (existing[0]) {
    const updated = await db
      .update(featureFlags)
      .set({
        enabled: input.enabled,
        description: input.description ?? existing[0].description,
        updatedByPlatformUserId: input.platformUserId ?? null,
        updatedAt: new Date(),
      })
      .where(eq(featureFlags.id, existing[0].id))
      .returning();
    return updated[0]!;
  }

  const inserted = await db
    .insert(featureFlags)
    .values({
      organizationId: orgId,
      key: input.key,
      enabled: input.enabled,
      description: input.description ?? null,
      updatedByPlatformUserId: input.platformUserId ?? null,
    })
    .returning();
  return inserted[0]!;
}

/**
 * In-app read: is a feature enabled for an org? An org-specific row wins over
 * the global default; absent both, the fallback (default false) applies.
 */
export async function isFeatureEnabled(
  organizationId: string,
  key: string,
  fallback = false,
): Promise<boolean> {
  const db = getRawClient({ as: 'platform-inspector' });
  const rows = await db
    .select({
      organizationId: featureFlags.organizationId,
      enabled: featureFlags.enabled,
    })
    .from(featureFlags)
    .where(eq(featureFlags.key, key));

  const orgRow = rows.find((r) => r.organizationId === organizationId);
  if (orgRow) return orgRow.enabled;
  const globalRow = rows.find((r) => r.organizationId === null);
  if (globalRow) return globalRow.enabled;
  return fallback;
}
