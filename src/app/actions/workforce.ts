'use server';

import { redirect } from 'next/navigation';

import { getSessionContext } from '@/lib/auth/session';
import { clockIn, clockOut, createEmployee } from '@/modules/workforce/public';

/**
 * Workforce server actions (User + Admin surfaces). Clock actions require
 * `time:self`; employee creation requires `admin:config` (enforced in services).
 */

export async function clockInAction(formData: FormData): Promise<void> {
  const session = await getSessionContext();
  if (!session) redirect('/login');

  const employeeId = String(formData.get('employeeId') ?? '');
  const segmentCode = String(formData.get('segmentCode') ?? '') || undefined;
  const caseId = String(formData.get('caseId') ?? '') || undefined;
  const workSegmentId =
    String(formData.get('workSegmentId') ?? '') || undefined;
  const returnToRaw = String(formData.get('returnTo') ?? '');
  const returnTo = normaliseReturnTo(returnToRaw) ?? '/clock';

  try {
    await clockIn(session.context, {
      employeeId,
      ...(segmentCode ? { segmentCode } : {}),
      ...(caseId ? { caseId } : {}),
      ...(workSegmentId ? { workSegmentId } : {}),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Clock-in failed';
    redirect(`${returnTo}?error=${encodeURIComponent(message)}`);
  }
  redirect(returnTo);
}

export async function clockOutAction(formData: FormData): Promise<void> {
  const session = await getSessionContext();
  if (!session) redirect('/login');

  const employeeId = String(formData.get('employeeId') ?? '');
  const returnToRaw = String(formData.get('returnTo') ?? '');
  const returnTo = normaliseReturnTo(returnToRaw) ?? '/clock';
  try {
    await clockOut(session.context, employeeId);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Clock-out failed';
    redirect(`${returnTo}?error=${encodeURIComponent(message)}`);
  }
  redirect(returnTo);
}

/**
 * Only allow same-origin relative paths so a malicious form cannot redirect
 * the user off-site after a clock action (OWASP A01).
 */
function normaliseReturnTo(raw: string): string | null {
  if (!raw) return null;
  if (!raw.startsWith('/')) return null;
  if (raw.startsWith('//')) return null;
  return raw;
}

export async function createEmployeeAction(formData: FormData): Promise<void> {
  const session = await getSessionContext();
  if (!session) redirect('/login');

  const fullName = String(formData.get('fullName') ?? '');
  const skillsRaw = String(formData.get('skills') ?? '');
  const skills = skillsRaw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((skillCode) => ({ skillCode, proficiency: 'qualified' as const }));
  const excludeFromPlanning =
    String(formData.get('excludeFromPlanning') ?? '') === 'on';

  await createEmployee(session.context, {
    fullName,
    skills,
    excludeFromPlanning,
  });
  redirect('/admin/employees');
}
