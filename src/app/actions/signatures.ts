'use server';

import { redirect } from 'next/navigation';

import { getSessionContext } from '@/lib/auth/session';
import { appendSignature } from '@/modules/quality/public';

/**
 * Server action for digital signatures (User surface). Seals a delivery
 * handover / acceptance into the case's tamper-evident signature chain. The
 * service enforces `case:edit` and appends one chained link.
 */
export async function signCaseAction(formData: FormData): Promise<void> {
  const session = await getSessionContext();
  if (!session) redirect('/login');

  const caseId = String(formData.get('caseId') ?? '');
  const kind = String(formData.get('kind') ?? 'delivery_handover') as
    | 'repair_acceptance'
    | 'delivery_handover'
    | 'rental_agreement'
    | 'quality_signoff'
    | 'other';
  const signerName = String(formData.get('signerName') ?? '').trim();

  await appendSignature(session.context, {
    caseId,
    kind,
    signerKind: 'customer',
    ...(signerName ? { signerName } : {}),
    payload: JSON.stringify({ caseId, kind, signerName, at: Date.now() }),
    subjectType: 'case',
    subjectId: caseId,
    evidence: { source: 'case_page' },
  });

  redirect(`/cases/${caseId}`);
}
