'use server';

import { revalidatePath } from 'next/cache';

import { requirePlatformAccess } from '@/lib/platform/guard';
import { recordPlatformAudit } from '@/lib/platform/audit';
import {
  endImpersonation,
  startImpersonation,
} from '@/modules/platform/public';

/**
 * Dev impersonation actions (platform-only). Starting/ending a session is
 * recorded in platform_impersonation_sessions AND audited to
 * platform_audit_events (impersonated_started / impersonated_ended). A reason is
 * mandatory to start.
 */
export async function startImpersonationAction(
  formData: FormData,
): Promise<void> {
  const ctx = await requirePlatformAccess();
  const targetOrgId = String(formData.get('targetOrgId') ?? '').trim();
  const reason = String(formData.get('reason') ?? '').trim();
  if (!targetOrgId || !reason) return;

  const session = await startImpersonation({
    platformUserId: ctx.platformUserId,
    targetOrgId,
    reason,
  });

  await recordPlatformAudit(ctx, {
    action: 'impersonated_started',
    targetOrgId,
    reason,
    after: { sessionId: session.id },
  });

  revalidatePath('/dev/impersonation');
}

export async function endImpersonationAction(
  formData: FormData,
): Promise<void> {
  const ctx = await requirePlatformAccess();
  const sessionId = String(formData.get('sessionId') ?? '').trim();
  if (!sessionId) return;

  const ended = await endImpersonation(sessionId);

  await recordPlatformAudit(ctx, {
    action: 'impersonated_ended',
    reason: 'Impersonation ended',
    after: { sessionId, endedAt: ended?.endedAt ?? null },
  });

  revalidatePath('/dev/impersonation');
}
