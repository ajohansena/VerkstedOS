'use server';

import { revalidatePath } from 'next/cache';

import { replayOutboxEvent } from '@/modules/platform/public';

/**
 * Replay an outbox event from the Dev Control Plane. Resets the row to pending
 * so the publisher ships it again. (Hardened /dev guard already applied by the
 * (dev) layout; replay is platform-team only.)
 */
export async function replayEventAction(formData: FormData): Promise<void> {
  const id = String(formData.get('id') ?? '');
  if (id) {
    await replayOutboxEvent(id);
  }
  revalidatePath('/dev/events/outbox');
}
