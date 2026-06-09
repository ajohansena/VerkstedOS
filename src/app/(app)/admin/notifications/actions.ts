'use server';

import { revalidatePath } from 'next/cache';

import { getSessionContext } from '@/lib/auth/session';
import { setOrgNotificationRuleEnabled } from '@/modules/notifications/public';

/**
 * Admin server actions for notification rules (Sprint 17). Toggle a rule
 * on/off. Permission enforcement is in the service (`admin:config`).
 */

export async function toggleRule(formData: FormData): Promise<void> {
  const code = String(formData.get('code') ?? '');
  const enabled = String(formData.get('enabled') ?? '') === 'true';
  if (!code) return;
  const session = await getSessionContext();
  if (!session) return;
  await setOrgNotificationRuleEnabled(session.context, code, enabled);
  revalidatePath('/admin/notifications');
}
