'use server';

import { revalidatePath } from 'next/cache';
import { headers } from 'next/headers';

import { signRepairAcceptanceByToken } from '@/modules/notifications/public';

/**
 * Customer portal e-signing Server Action (Sprint 20). Caller is UNAUTH —
 * the portal token in the URL is the credential. Validates the token,
 * captures IP + User-Agent as evidence, appends a tamper-evident signature
 * to the case's chain. Idempotent: a second submit on an already-signed
 * case is a no-op (the UI shows the already-signed state).
 */
export async function signRepairAcceptanceAction(
  formData: FormData,
): Promise<{ ok: boolean; reason?: string }> {
  const token = String(formData.get('token') ?? '').trim();
  const consent = String(formData.get('consent') ?? '') === 'on';
  const signerName = String(formData.get('signerName') ?? '').trim();
  if (!token) return { ok: false, reason: 'token_invalid' };
  if (!consent) return { ok: false, reason: 'consent_required' };

  const hdrs = await headers();
  const ip =
    hdrs.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    hdrs.get('x-real-ip') ??
    null;
  const userAgent = hdrs.get('user-agent') ?? null;

  const result = await signRepairAcceptanceByToken({
    token,
    signerName,
    evidence: {
      ip,
      userAgent,
      submittedAt: new Date().toISOString(),
    },
  });

  if (result.ok) {
    revalidatePath(`/portal/${token}`);
    return { ok: true };
  }
  return { ok: false, reason: result.reason };
}
