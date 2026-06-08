'use server';

import { redirect } from 'next/navigation';

import { getSessionContext } from '@/lib/auth/session';
import { createSupplier, flagPartRequirement } from '@/modules/parts/public';

/**
 * Server actions for the case parts panel (User surface) and supplier admin
 * (Admin surface). The services enforce parts:order / admin:config, write the
 * audit + lifecycle event, and emit the outbox event. Ordering/receiving/
 * withdrawing are driven from the coordinator dashboard and its own actions;
 * flagging a missing part is the technician's entry point.
 */
export async function flagPartAction(formData: FormData): Promise<void> {
  const session = await getSessionContext();
  if (!session) redirect('/login');

  const caseId = String(formData.get('caseId') ?? '');
  const description = String(formData.get('description') ?? '');
  const partNumberRaw = String(formData.get('partNumber') ?? '');
  const quantityRaw = String(formData.get('quantity') ?? '');
  const quantity = Number.parseFloat(quantityRaw);

  try {
    await flagPartRequirement(session.context, {
      caseId,
      description,
      ...(partNumberRaw ? { partNumber: partNumberRaw } : {}),
      ...(Number.isFinite(quantity) && quantity > 0 ? { quantity } : {}),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Flag part failed';
    redirect(`/cases/${caseId}?error=${encodeURIComponent(message)}`);
  }

  redirect(`/cases/${caseId}`);
}

export async function createSupplierAction(formData: FormData): Promise<void> {
  const session = await getSessionContext();
  if (!session) redirect('/login');

  const name = String(formData.get('name') ?? '');
  const orgNumberRaw = String(formData.get('orgNumber') ?? '');
  const contactEmailRaw = String(formData.get('contactEmail') ?? '');

  try {
    await createSupplier(session.context, {
      name,
      ...(orgNumberRaw ? { orgNumber: orgNumberRaw } : {}),
      ...(contactEmailRaw ? { contactEmail: contactEmailRaw } : {}),
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : 'Create supplier failed';
    redirect(`/admin/suppliers?error=${encodeURIComponent(message)}`);
  }

  redirect('/admin/suppliers');
}
