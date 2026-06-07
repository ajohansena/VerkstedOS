'use server';

import { redirect } from 'next/navigation';

import { getSessionContext } from '@/lib/auth/session';
import {
  addFundingSource,
  createCase,
  listFundingSources,
  type FundingSourceInput,
} from '@/modules/case/public';

/**
 * Server actions for case intake & funding (User surface). The service layer
 * enforces `case:edit`, validates the multi-funding rules, and writes audit +
 * outbox transactionally.
 */

export async function createCaseAction(formData: FormData): Promise<void> {
  const session = await getSessionContext();
  if (!session) redirect('/login');

  const fundingSources: FundingSourceInput[] = [];

  // First funding source (optional) assembled from the simple intake form.
  const kind = String(formData.get('fundingKind') ?? '');
  if (kind) {
    const label = String(formData.get('fundingLabel') ?? '') || 'Funding';
    const fs: FundingSourceInput = {
      kind: kind as FundingSourceInput['kind'],
      label,
    };
    const payerCustomerId = String(formData.get('payerCustomerId') ?? '');
    const insuranceCompanyId = String(formData.get('insuranceCompanyId') ?? '');
    const claimNumber = String(formData.get('claimNumber') ?? '');
    if (payerCustomerId) fs.payerCustomerId = payerCustomerId;
    if (kind === 'insurance' && insuranceCompanyId) {
      fs.newClaim = {
        insuranceCompanyId,
        ...(claimNumber ? { claimNumber } : {}),
      };
    }
    fundingSources.push(fs);
  }

  const primaryCustomerId = String(formData.get('primaryCustomerId') ?? '');
  const vehicleId = String(formData.get('vehicleId') ?? '');
  const incidentTag = String(formData.get('incidentTag') ?? '');

  const created = await createCase(session.context, {
    ...(primaryCustomerId ? { primaryCustomerId } : {}),
    ...(vehicleId ? { vehicleId } : {}),
    ...(incidentTag ? { incidentTag } : {}),
    fundingSources,
  });

  redirect(`/cases/${created.id}`);
}

export async function addFundingAction(formData: FormData): Promise<void> {
  const session = await getSessionContext();
  if (!session) redirect('/login');

  const caseId = String(formData.get('caseId') ?? '');
  const kind = String(formData.get('kind') ?? '');
  const label = String(formData.get('label') ?? '') || 'Funding';

  const fs: FundingSourceInput = {
    kind: kind as FundingSourceInput['kind'],
    label,
  };
  const payerCustomerId = String(formData.get('payerCustomerId') ?? '');
  const insuranceCompanyId = String(formData.get('insuranceCompanyId') ?? '');
  if (payerCustomerId) fs.payerCustomerId = payerCustomerId;
  if (kind === 'insurance' && insuranceCompanyId) {
    fs.newClaim = { insuranceCompanyId };
  }

  const existing = await listFundingSources(session.context, caseId);
  await addFundingSource(session.context, caseId, fs, existing.length + 1);

  redirect(`/cases/${caseId}`);
}
