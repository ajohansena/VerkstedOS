'use server';

import { redirect } from 'next/navigation';

import { getSessionContext } from '@/lib/auth/session';
import { createCase, findCaseById } from '@/modules/case/public';
import {
  createCustomer,
  createVehicle,
  findVehicleById,
  searchCustomers,
  searchVehicles,
} from '@/modules/customer/public';

/**
 * Case intake actions (User surface, Sprint 12 UX). Norwegian workshops start a
 * case from a REGISTRATION NUMBER or a PHONE NUMBER, not by scrolling a customer
 * list. These actions reuse the existing customer/vehicle/case services — no
 * domain, tenancy, or RBAC change. `case:edit` is enforced by those services.
 */

export interface IntakeSearchResult {
  vehicles: Array<{
    id: string;
    registrationNumber: string | null;
    make: string | null;
    model: string | null;
    ownerCustomerId: string | null;
  }>;
  customers: Array<{
    id: string;
    name: string;
    primaryPhone: string | null;
  }>;
}

/** Search vehicles (reg/VIN) and customers (name/phone/email) in one call. */
export async function searchIntakeAction(
  query: string,
): Promise<IntakeSearchResult> {
  const session = await getSessionContext();
  if (!session) return { vehicles: [], customers: [] };
  const trimmed = query.trim();
  if (trimmed.length < 2) return { vehicles: [], customers: [] };

  const [vehicles, customers] = await Promise.all([
    searchVehicles(session.context, trimmed, 10),
    searchCustomers(session.context, trimmed, 10),
  ]);

  return {
    vehicles: vehicles.map((v) => ({
      id: v.id,
      registrationNumber: v.registrationNumber,
      make: v.make,
      model: v.model,
      ownerCustomerId: v.ownerCustomerId,
    })),
    customers: customers.map((c) => ({
      id: c.id,
      name: c.name,
      primaryPhone: c.primaryPhone,
    })),
  };
}

/** Start a case from an existing vehicle (owner becomes primary customer). */
export async function caseFromVehicleAction(formData: FormData): Promise<void> {
  const session = await getSessionContext();
  if (!session) redirect('/login');
  const vehicleId = String(formData.get('vehicleId') ?? '');
  if (!vehicleId) redirect('/cases/new');

  const vehicle = await findVehicleById(session.context, vehicleId);
  const created = await createCase(session.context, {
    vehicleId,
    ...(vehicle?.ownerCustomerId
      ? { primaryCustomerId: vehicle.ownerCustomerId }
      : {}),
    fundingSources: [],
  });
  redirect(`/cases/${created.id}`);
}

/** Start a case from an existing customer. */
export async function caseFromCustomerAction(
  formData: FormData,
): Promise<void> {
  const session = await getSessionContext();
  if (!session) redirect('/login');
  const customerId = String(formData.get('customerId') ?? '');
  if (!customerId) redirect('/cases/new');

  const created = await createCase(session.context, {
    primaryCustomerId: customerId,
    fundingSources: [],
  });
  redirect(`/cases/${created.id}`);
}

/**
 * Fast path: create a customer and/or vehicle from minimal input, then open a
 * new case. Used when search finds nothing — the receptionist types the reg +
 * name + phone and goes straight to the case.
 */
export async function quickIntakeAction(formData: FormData): Promise<void> {
  const session = await getSessionContext();
  if (!session) redirect('/login');

  const registrationNumber = String(
    formData.get('registrationNumber') ?? '',
  ).trim();
  const customerName = String(formData.get('customerName') ?? '').trim();
  const customerPhone = String(formData.get('customerPhone') ?? '').trim();

  let primaryCustomerId: string | undefined;
  if (customerName) {
    const customer = await createCustomer(session.context, {
      kind: 'individual',
      name: customerName,
      ...(customerPhone ? { primaryPhone: customerPhone } : {}),
    });
    primaryCustomerId = customer.id;
  }

  let vehicleId: string | undefined;
  if (registrationNumber) {
    const vehicle = await createVehicle(session.context, {
      registrationNumber,
      ownershipType: 'private',
      ...(primaryCustomerId ? { ownerCustomerId: primaryCustomerId } : {}),
    });
    vehicleId = vehicle.id;
  }

  const created = await createCase(session.context, {
    ...(primaryCustomerId ? { primaryCustomerId } : {}),
    ...(vehicleId ? { vehicleId } : {}),
    fundingSources: [],
  });

  // Defensive: confirm the case is readable before redirecting.
  await findCaseById(session.context, created.id);
  redirect(`/cases/${created.id}`);
}
