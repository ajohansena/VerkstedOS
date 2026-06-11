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

  try {
    await clockIn(session.context, {
      employeeId,
      ...(segmentCode ? { segmentCode } : {}),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Clock-in failed';
    redirect(`/clock?error=${encodeURIComponent(message)}`);
  }
  redirect('/clock');
}

export async function clockOutAction(formData: FormData): Promise<void> {
  const session = await getSessionContext();
  if (!session) redirect('/login');

  const employeeId = String(formData.get('employeeId') ?? '');
  try {
    await clockOut(session.context, employeeId);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Clock-out failed';
    redirect(`/clock?error=${encodeURIComponent(message)}`);
  }
  redirect('/clock');
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
