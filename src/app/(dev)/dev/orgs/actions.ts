'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import { requirePlatformAccess } from '@/lib/platform/guard';
import {
  archiveOrganization,
  deactivateOrganization,
  provisionOrganization,
  reactivateOrganization,
  unarchiveOrganization,
} from '@/modules/platform/public';

/**
 * Server actions for `/dev/orgs/*` mutations (Sprint 20 — Platform Maturity).
 *
 * All actions require an active PlatformOwner context. The (dev) layout guard
 * already enforces platform access; the services additionally check the
 * PlatformOwner role.
 */

interface ActionState {
  readonly ok: boolean;
  readonly message: string;
  readonly redirectTo?: string;
}

export async function provisionOrganizationAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const ctx = await requirePlatformAccess();
  const orgName = String(formData.get('orgName') ?? '').trim();
  const orgNumber = String(formData.get('orgNumber') ?? '').trim();
  const workshopName = String(formData.get('workshopName') ?? '').trim();
  const ownerFullName = String(formData.get('ownerFullName') ?? '').trim();
  const ownerEmail = String(formData.get('ownerEmail') ?? '')
    .trim()
    .toLowerCase();

  if (!orgName || !workshopName || !ownerFullName || !ownerEmail) {
    return { ok: false, message: 'All fields are required.' };
  }

  try {
    const result = await provisionOrganization(ctx, {
      orgName,
      orgNumber: orgNumber || null,
      workshopName,
      ownerFullName,
      ownerEmail,
    });
    revalidatePath('/dev/orgs');
    revalidatePath('/dev');
    return {
      ok: true,
      message: `Organization "${result.organization.name}" created. ${
        result.inviteEmailSent
          ? `Invite email sent to ${result.ownerEmail}.`
          : `User ${result.ownerEmail} already existed; no invite sent.`
      }`,
      redirectTo: `/dev/orgs/${result.organization.id}`,
    };
  } catch (err) {
    return {
      ok: false,
      message: err instanceof Error ? err.message : 'Unknown error',
    };
  }
}

export async function deactivateOrgAction(formData: FormData): Promise<void> {
  const ctx = await requirePlatformAccess();
  const id = String(formData.get('id') ?? '');
  if (!id) throw new Error('Organization id required.');
  await deactivateOrganization(ctx, id);
  revalidatePath(`/dev/orgs/${id}`);
  revalidatePath('/dev/orgs');
}

export async function reactivateOrgAction(formData: FormData): Promise<void> {
  const ctx = await requirePlatformAccess();
  const id = String(formData.get('id') ?? '');
  if (!id) throw new Error('Organization id required.');
  await reactivateOrganization(ctx, id);
  revalidatePath(`/dev/orgs/${id}`);
  revalidatePath('/dev/orgs');
}

export async function archiveOrgAction(formData: FormData): Promise<void> {
  const ctx = await requirePlatformAccess();
  const id = String(formData.get('id') ?? '');
  if (!id) throw new Error('Organization id required.');
  await archiveOrganization(ctx, id);
  revalidatePath('/dev/orgs');
  redirect('/dev/orgs');
}

export async function unarchiveOrgAction(formData: FormData): Promise<void> {
  const ctx = await requirePlatformAccess();
  const id = String(formData.get('id') ?? '');
  if (!id) throw new Error('Organization id required.');
  await unarchiveOrganization(ctx, id);
  revalidatePath(`/dev/orgs/${id}`);
  revalidatePath('/dev/orgs');
}
