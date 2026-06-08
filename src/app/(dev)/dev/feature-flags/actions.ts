'use server';

import { revalidatePath } from 'next/cache';

import { requirePlatformAccess } from '@/lib/platform/guard';
import { recordPlatformAudit } from '@/lib/platform/audit';
import { setFeatureFlag } from '@/modules/platform/public';

/**
 * Dev feature-flag toggle (platform-only). Guarded by requirePlatformAccess;
 * every change is recorded to platform_audit_events (feature_flag_changed) with
 * the before/after state.
 */
export async function setFeatureFlagAction(formData: FormData): Promise<void> {
  const ctx = await requirePlatformAccess();

  const key = String(formData.get('key') ?? '').trim();
  const enabled = String(formData.get('enabled') ?? '') === 'true';
  const orgIdRaw = String(formData.get('organizationId') ?? '').trim();
  const description = String(formData.get('description') ?? '').trim();
  if (!key) return;

  await setFeatureFlag({
    key,
    enabled,
    organizationId: orgIdRaw || null,
    description: description || null,
    platformUserId: ctx.platformUserId,
  });

  await recordPlatformAudit(ctx, {
    action: 'feature_flag_changed',
    targetOrgId: orgIdRaw || null,
    reason: `Set ${key} = ${enabled}`,
    after: { key, enabled, organizationId: orgIdRaw || null },
  });

  revalidatePath('/dev/feature-flags');
}
