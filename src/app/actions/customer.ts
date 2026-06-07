'use server';

import { redirect } from 'next/navigation';

import { getSessionContext } from '@/lib/auth/session';
import {
  createCustomer,
  createVehicle,
  lookupVehicleByReg,
  type VehicleLookupResult,
} from '@/modules/customer/public';

/**
 * Server actions for customer & vehicle creation and the reg-plate lookup
 * (User surface). Each resolves the session context first; the service layer
 * enforces `case:edit` and validates input.
 */

export async function createCustomerAction(formData: FormData): Promise<void> {
  const session = await getSessionContext();
  if (!session) redirect('/login');

  const kind = String(formData.get('kind') ?? 'individual');
  const identifierKind =
    kind === 'individual'
      ? 'personal_id_no'
      : kind === 'company'
        ? 'org_no_no'
        : undefined;

  await createCustomer(session.context, {
    kind: kind as
      | 'individual'
      | 'company'
      | 'leasing_company'
      | 'fleet_operator',
    name: String(formData.get('name') ?? ''),
    identifier: String(formData.get('identifier') ?? '') || undefined,
    identifierKind,
    primaryEmail: String(formData.get('primaryEmail') ?? '') || undefined,
    primaryPhone: String(formData.get('primaryPhone') ?? '') || undefined,
  });

  redirect('/customers');
}

export async function createVehicleAction(formData: FormData): Promise<void> {
  const session = await getSessionContext();
  if (!session) redirect('/login');

  const yearRaw = String(formData.get('year') ?? '');
  await createVehicle(session.context, {
    registrationNumber:
      String(formData.get('registrationNumber') ?? '') || undefined,
    vin: String(formData.get('vin') ?? '') || undefined,
    make: String(formData.get('make') ?? '') || undefined,
    model: String(formData.get('model') ?? '') || undefined,
    year: yearRaw ? Number(yearRaw) : undefined,
    ownershipType: 'unknown',
  });

  redirect('/vehicles');
}

/** Reg-plate lookup used by the new-vehicle form (returns a serializable result). */
export async function lookupRegAction(
  reg: string,
): Promise<VehicleLookupResult | null> {
  const session = await getSessionContext();
  if (!session) return null;
  return lookupVehicleByReg(session.context, reg);
}
