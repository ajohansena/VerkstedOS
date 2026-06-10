'use server';

import { revalidatePath } from 'next/cache';

import { getAuthorizedSession } from '@/lib/auth/authorize';
import { inviteEmployee, setMembershipStatus } from '@/modules/identity/public';

/**
 * Customer Owner admin actions (Sprint 20 — Platform Maturity).
 *
 * All run in tenant context; the underlying services require `admin:users`.
 * PlatformOwner is not involved.
 */

interface InviteState {
  readonly ok: boolean;
  readonly message: string;
}

export async function inviteEmployeeAction(
  _prev: InviteState,
  formData: FormData,
): Promise<InviteState> {
  const auth = await getAuthorizedSession();
  if (!auth) return { ok: false, message: 'Not authorised.' };
  const email = String(formData.get('email') ?? '').trim().toLowerCase();
  const fullName = String(formData.get('fullName') ?? '').trim();
  const roleId = String(formData.get('roleId') ?? '');
  const workshopIdRaw = String(formData.get('workshopId') ?? '').trim();
  const workshopId = workshopIdRaw === '' ? null : workshopIdRaw;

  if (!email || !fullName || !roleId) {
    return { ok: false, message: 'Email, name and role are required.' };
  }

  try {
    const r = await inviteEmployee(auth.session.context, {
      email,
      fullName,
      roleId,
      workshopId,
    });
    revalidatePath('/admin/users');
    return {
      ok: true,
      message: r.alreadyMember
        ? `Role assigned to existing member ${email}.`
        : r.inviteEmailSent
          ? `Invite email sent to ${email}.`
          : `User ${email} already had an account; membership + role created (no email sent).`,
    };
  } catch (err) {
    return {
      ok: false,
      message: err instanceof Error ? err.message : 'Unknown error',
    };
  }
}

export async function deactivateMemberAction(
  formData: FormData,
): Promise<void> {
  const auth = await getAuthorizedSession();
  if (!auth) throw new Error('Not authorised.');
  const membershipId = String(formData.get('membershipId') ?? '');
  if (!membershipId) throw new Error('membershipId required.');
  await setMembershipStatus(auth.session.context, {
    membershipId,
    status: 'suspended',
  });
  revalidatePath('/admin/users');
}

export async function reactivateMemberAction(
  formData: FormData,
): Promise<void> {
  const auth = await getAuthorizedSession();
  if (!auth) throw new Error('Not authorised.');
  const membershipId = String(formData.get('membershipId') ?? '');
  if (!membershipId) throw new Error('membershipId required.');
  await setMembershipStatus(auth.session.context, {
    membershipId,
    status: 'active',
  });
  revalidatePath('/admin/users');
}
