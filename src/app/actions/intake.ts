'use server';

import { redirect } from 'next/navigation';

import { getSessionContext } from '@/lib/auth/session';
import {
  createCase,
  findCaseById,
  validateFundingSet,
  type FundingSourceInput,
} from '@/modules/case/public';
import {
  createCustomer,
  createVehicle,
  findVehicleById,
  lookupByPhone,
  lookupVehicleByReg,
  searchCustomers,
  searchVehicles,
  type PhoneLookupResult,
  type VehicleLookupResult,
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

// ───────────────────────── Wizard server actions ──────────────────────────
//
// The unified Intake Wizard (single adaptive experience — no "Simple vs
// Advanced") calls these. They are JSON-returning actions (not formData)
// because the wizard is a client component orchestrating multiple steps.

/** Vegvesen plate lookup (cache-first, transparent fallback). */
export async function lookupVegvesenAction(
  registrationNumber: string,
): Promise<VehicleLookupResult> {
  const session = await getSessionContext();
  if (!session) {
    return {
      found: false,
      registrationNumber,
      source: 'not_configured',
    };
  }
  return lookupVehicleByReg(session.context, registrationNumber);
}

/** 1881 phone lookup (cache-first, transparent fallback). */
export async function lookup1881Action(
  phone: string,
): Promise<PhoneLookupResult> {
  const session = await getSessionContext();
  if (!session) {
    return {
      found: false,
      phone,
      source: 'not_configured',
    };
  }
  return lookupByPhone(session.context, phone);
}

/**
 * Wizard input — exactly the data the client builds up across the steps. The
 * action materializes customer + vehicle + case (with funding sources) in ONE
 * coordinated flow, reusing the canonical services. Each branch is explicit;
 * no clever generic dispatcher.
 */
export interface CreateCaseFromWizardInput {
  vehicle:
    | {
        kind: 'existing';
        vehicleId: string;
      }
    | {
        kind: 'new';
        registrationNumber?: string;
        vin?: string;
        make?: string;
        model?: string;
        year?: number;
        colour?: string;
      };
  customer:
    | {
        kind: 'existing';
        customerId: string;
      }
    | {
        kind: 'new';
        customerKind: 'individual' | 'company' | 'leasing_company' | 'fleet_operator';
        name: string;
        primaryPhone?: string;
        primaryEmail?: string;
      }
    | {
        kind: 'none';
      };
  incidentTag?: string;
  fundingSources: FundingSourceInput[];
}

export interface CreateCaseFromWizardResult {
  caseId: string;
  caseNumber: string;
}

/**
 * End-to-end wizard submit. Each create call is permission-checked + audited
 * by its own service; this action is the orchestrator. Validation problems are
 * raised eagerly so the wizard can show them inline (no half-created data).
 */
export async function createCaseFromWizardAction(
  input: CreateCaseFromWizardInput,
): Promise<CreateCaseFromWizardResult> {
  const session = await getSessionContext();
  if (!session) {
    throw new Error('NOT_AUTHENTICATED');
  }

  // Validate funding sources up front (we don't want to create a customer
  // and vehicle and THEN discover the funding is malformed).
  const fundingProblems = validateFundingSet(input.fundingSources);
  if (fundingProblems.length > 0) {
    throw new Error(`INVALID_FUNDING:${fundingProblems.join(' | ')}`);
  }

  // 1. Customer.
  let primaryCustomerId: string | undefined;
  if (input.customer.kind === 'existing') {
    primaryCustomerId = input.customer.customerId;
  } else if (input.customer.kind === 'new') {
    const customer = await createCustomer(session.context, {
      kind: input.customer.customerKind,
      name: input.customer.name,
      ...(input.customer.primaryPhone
        ? { primaryPhone: input.customer.primaryPhone }
        : {}),
      ...(input.customer.primaryEmail
        ? { primaryEmail: input.customer.primaryEmail }
        : {}),
    });
    primaryCustomerId = customer.id;
  }

  // 2. Vehicle.
  let vehicleId: string | undefined;
  if (input.vehicle.kind === 'existing') {
    vehicleId = input.vehicle.vehicleId;
  } else {
    const v = input.vehicle;
    const vehicle = await createVehicle(session.context, {
      ...(v.registrationNumber
        ? { registrationNumber: v.registrationNumber }
        : {}),
      ...(v.vin ? { vin: v.vin } : {}),
      ...(v.make ? { make: v.make } : {}),
      ...(v.model ? { model: v.model } : {}),
      ...(v.year ? { year: v.year } : {}),
      ...(v.colour ? { colour: v.colour } : {}),
      ownershipType: 'unknown',
      ...(primaryCustomerId ? { ownerCustomerId: primaryCustomerId } : {}),
    });
    vehicleId = vehicle.id;
  }

  // 3. Case (multi-funding supported — `validateFundingSet` runs again inside
  //    `createCase` as a defense-in-depth check).
  const created = await createCase(session.context, {
    ...(primaryCustomerId ? { primaryCustomerId } : {}),
    ...(vehicleId ? { vehicleId } : {}),
    ...(input.incidentTag ? { incidentTag: input.incidentTag } : {}),
    fundingSources: input.fundingSources,
  });

  return { caseId: created.id, caseNumber: created.caseNumber };
}
