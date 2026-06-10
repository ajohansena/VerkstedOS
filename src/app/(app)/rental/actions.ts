'use server';

import { revalidatePath } from 'next/cache';

import { getSessionContext } from '@/lib/auth/session';
import {
  createAgreement,
  createReservation,
  recordReturn,
  registerRentalVehicle,
  signAgreement,
} from '@/modules/rental/public';

function parseDate(value: FormDataEntryValue | null): Date {
  const s = String(value ?? '').trim();
  if (!s) throw new Error('DATE_REQUIRED');
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) throw new Error('DATE_INVALID');
  return d;
}

export async function registerVehicleAction(formData: FormData): Promise<void> {
  const session = await getSessionContext();
  if (!session) return;
  const registrationNumber = String(
    formData.get('registrationNumber') ?? '',
  ).trim();
  if (!registrationNumber) return;
  await registerRentalVehicle(session.context, {
    registrationNumber,
    make: String(formData.get('make') ?? '').trim() || null,
    model: String(formData.get('model') ?? '').trim() || null,
    dailyRate: String(formData.get('dailyRate') ?? '0').trim() || '0',
  });
  revalidatePath('/admin/rental');
  revalidatePath('/rental');
}

export async function createReservationAction(
  formData: FormData,
): Promise<void> {
  const session = await getSessionContext();
  if (!session) return;
  const rentalVehicleId = String(formData.get('rentalVehicleId') ?? '').trim();
  if (!rentalVehicleId) return;
  await createReservation(session.context, {
    rentalVehicleId,
    caseId: String(formData.get('caseId') ?? '').trim() || null,
    customerId: String(formData.get('customerId') ?? '').trim() || null,
    fundingSourceId:
      String(formData.get('fundingSourceId') ?? '').trim() || null,
    startsAt: parseDate(formData.get('startsAt')),
    endsAt: parseDate(formData.get('endsAt')),
    notes: String(formData.get('notes') ?? '').trim() || null,
  });
  revalidatePath('/rental');
}

export async function signAgreementAction(formData: FormData): Promise<void> {
  const session = await getSessionContext();
  if (!session) return;
  const reservationId = String(formData.get('reservationId') ?? '').trim();
  const signedByName = String(formData.get('signedByName') ?? '').trim();
  if (!reservationId || !signedByName) return;
  const agreement = await createAgreement(session.context, { reservationId });
  await signAgreement(session.context, agreement.id, signedByName);
  revalidatePath('/rental');
}

export async function recordReturnAction(formData: FormData): Promise<void> {
  const session = await getSessionContext();
  if (!session) return;
  const agreementId = String(formData.get('agreementId') ?? '').trim();
  if (!agreementId) return;
  const odoStr = String(formData.get('odometerKm') ?? '').trim();
  const fuelStr = String(formData.get('fuelLevelPercent') ?? '').trim();
  await recordReturn(session.context, {
    agreementId,
    returnedAt: new Date(),
    odometerKm: odoStr ? Number(odoStr) : null,
    fuelLevelPercent: fuelStr ? Number(fuelStr) : null,
    damageNotes: String(formData.get('damageNotes') ?? '').trim() || null,
    additionalChargesAmount:
      String(formData.get('additionalChargesAmount') ?? '').trim() || null,
  });
  revalidatePath('/rental');
}
