'use server';

import { redirect } from 'next/navigation';

import { respondViaJobCard } from '@/modules/communication/public';

/**
 * Public job-card actions (NO auth — the customer is not a system user). The
 * acceptance token is the security boundary. Used by the /jobbkort/[token] page
 * so the customer can accept or decline the repair.
 */
export async function acceptJobCardAction(formData: FormData): Promise<void> {
  const token = String(formData.get('token') ?? '');
  if (token) await respondViaJobCard(token, 'accepted');
  redirect(`/jobbkort/${token}`);
}

export async function declineJobCardAction(formData: FormData): Promise<void> {
  const token = String(formData.get('token') ?? '');
  if (token) await respondViaJobCard(token, 'declined');
  redirect(`/jobbkort/${token}`);
}
