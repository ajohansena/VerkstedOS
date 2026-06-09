'use server';

import { revalidatePath } from 'next/cache';

import { getSessionContext } from '@/lib/auth/session';
import {
  dismissMyNotification,
  markAllMyNotificationsRead,
  markMyNotificationRead,
} from '@/modules/notifications/public';

/**
 * Notification server actions (Sprint 17). Thin wrappers that resolve the
 * session, call the canonical service, then revalidate the affected route so
 * the bell + list reflect the change immediately.
 */

export async function markRead(formData: FormData): Promise<void> {
  const id = String(formData.get('id') ?? '');
  if (!id) return;
  const session = await getSessionContext();
  if (!session) return;
  await markMyNotificationRead(session.context, id);
  revalidatePath('/notifications');
  revalidatePath('/');
}

export async function markAllRead(): Promise<void> {
  const session = await getSessionContext();
  if (!session) return;
  await markAllMyNotificationsRead(session.context);
  revalidatePath('/notifications');
  revalidatePath('/');
}

export async function dismiss(formData: FormData): Promise<void> {
  const id = String(formData.get('id') ?? '');
  if (!id) return;
  const session = await getSessionContext();
  if (!session) return;
  await dismissMyNotification(session.context, id);
  revalidatePath('/notifications');
  revalidatePath('/');
}
