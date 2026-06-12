'use server';

import { redirect } from 'next/navigation';

import { getSessionContext } from '@/lib/auth/session';
import {
  createBooking,
  createCase,
  validateBookingDates,
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
        customerKind:
          | 'individual'
          | 'company'
          | 'leasing_company'
          | 'fleet_operator';
        name: string;
        primaryPhone?: string;
        primaryEmail?: string;
        /**
         * Optional structured billing address. Persisted into
         * `customers.billing_address` (JSONB) via the canonical
         * `billingAddressSchema`. Captured by the wizard's manual-entry form
         * (street/postalCode/city). Country defaults to Norwegian context
         * when unset.
         */
        billingAddress?: {
          street?: string;
          postalCode?: string;
          city?: string;
          countryCode?: string;
        };
      }
    | {
        kind: 'none';
      };
  incidentTag?: string;
  fundingSources: FundingSourceInput[];
  /**
   * Optional arrival/promise commitments captured at intake. When provided,
   * a `case_booking` row is created in the same orchestration so the new case
   * shows up on the Production Planner immediately (doc 13 § 20.4).
   * `workshopId` is REQUIRED when either date is set — booking is workshop-scoped.
   */
  booking?: {
    workshopId: string;
    expectedArrivalAt?: string; // ISO datetime
    promisedDeliveryAt?: string; // ISO datetime
    notes?: string;
    confirmImmediately?: boolean;
  };
}

export type CreateCaseFromWizardResult =
  | { ok: true; caseId: string; caseNumber: string }
  | { ok: false; message: string };

function normalizeError(err: unknown): string {
  if (err instanceof Error) {
    // Zod errors carry a JSON-array `message`; turn it into something readable.
    if (err.name === 'ZodError') {
      try {
        const issues = JSON.parse(err.message) as Array<{
          path: (string | number)[];
          message: string;
        }>;
        return issues
          .map((i) => `${i.path.join('.') || 'input'}: ${i.message}`)
          .join(' | ');
      } catch {
        return err.message;
      }
    }
    return err.message;
  }
  return 'UNKNOWN_ERROR';
}

/**
 * End-to-end wizard submit. Each create call is permission-checked + audited
 * by its own service; this action is the orchestrator. Returns a tagged union
 * — never throws to the client — so production renders friendly messages
 * instead of the generic Server Components digest screen.
 */
export async function createCaseFromWizardAction(
  input: CreateCaseFromWizardInput,
): Promise<CreateCaseFromWizardResult> {
  try {
    const session = await getSessionContext();
    if (!session) {
      return { ok: false, message: 'NOT_AUTHENTICATED' };
    }

    // Validate funding sources up front (we don't want to create a customer
    // and vehicle and THEN discover the funding is malformed). For `private_pay`
    // the real payer isn't known yet — it's the new customer we're about to
    // create in step 1 — so substitute a placeholder UUID for the up-front
    // sanity check (same pattern the wizard's client uses in
    // IntakeWizard.tsx). The canonical `validateFundingSet` runs again inside
    // `createCase` with the real payer (defense-in-depth, single source of
    // truth — no parallel validation logic).
    const PRIVATE_PAY_PLACEHOLDER = '00000000-0000-0000-0000-000000000000';
    const fundingProblems = validateFundingSet(
      input.fundingSources.map((fs) =>
        fs.kind === 'private_pay' && !fs.payerCustomerId
          ? { ...fs, payerCustomerId: PRIVATE_PAY_PLACEHOLDER }
          : fs,
      ),
    );
    if (fundingProblems.length > 0) {
      return {
        ok: false,
        message: `INVALID_FUNDING: ${fundingProblems.join(' | ')}`,
      };
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
        ...(input.customer.billingAddress
          ? { billingAddress: input.customer.billingAddress }
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

    // 3. Backfill funding sources that need a payer context but the wizard
    //    can't ask for it in-line (avoid surprising the user with errors that
    //    the UI doesn't expose a field for).
    const fundingSources = input.fundingSources.map((fs) => {
      if (
        fs.kind === 'private_pay' &&
        !fs.payerCustomerId &&
        primaryCustomerId
      ) {
        return { ...fs, payerCustomerId: primaryCustomerId };
      }
      return fs;
    });

    // 3b. Validate booking dates EARLY so we don't half-create state.
    if (input.booking) {
      const arrival = input.booking.expectedArrivalAt
        ? new Date(input.booking.expectedArrivalAt)
        : null;
      const delivery = input.booking.promisedDeliveryAt
        ? new Date(input.booking.promisedDeliveryAt)
        : null;
      const dateProblems = validateBookingDates({
        expectedArrivalAt: arrival,
        promisedDeliveryAt: delivery,
      });
      if (dateProblems.length > 0) {
        return {
          ok: false,
          message: `INVALID_BOOKING: ${dateProblems.join(' | ')}`,
        };
      }
    }

    // 4. Case (multi-funding supported — `validateFundingSet` runs again inside
    //    `createCase` as a defense-in-depth check).
    const created = await createCase(session.context, {
      ...(primaryCustomerId ? { primaryCustomerId } : {}),
      ...(vehicleId ? { vehicleId } : {}),
      ...(input.incidentTag ? { incidentTag: input.incidentTag } : {}),
      fundingSources,
    });

    // 5. Optional booking. The case-creation tx already committed; the booking
    //    tx is independent (both are audited). If booking creation fails after
    //    case creation, the case still exists — better than throwing away the
    //    customer/vehicle work. The error message names the partial state.
    if (input.booking) {
      try {
        await createBooking(session.context, {
          caseId: created.id,
          workshopId: input.booking.workshopId,
          expectedArrivalAt: input.booking.expectedArrivalAt
            ? new Date(input.booking.expectedArrivalAt)
            : null,
          promisedDeliveryAt: input.booking.promisedDeliveryAt
            ? new Date(input.booking.promisedDeliveryAt)
            : null,
          ...(input.booking.notes ? { notes: input.booking.notes } : {}),
          ...(input.booking.confirmImmediately
            ? { confirmImmediately: true }
            : {}),
        });
      } catch (bookingErr) {
        console.error('createBooking failed after case create', bookingErr);
        return {
          ok: false,
          message: `CASE_CREATED_BOOKING_FAILED: ${normalizeError(bookingErr)}. Sak ${created.caseNumber} ble opprettet, men booking feilet. Du kan opprette booking fra sak-siden.`,
        };
      }
    }

    return { ok: true, caseId: created.id, caseNumber: created.caseNumber };
  } catch (err) {
    // Server-side log: enough non-PII context to triage in production if the
    // operator reports an "An error occurred" digest screen (e.g. EF89842
    // / digest 2870096578 in batch 1). Vehicle plate is an operational
    // identifier (not PII); customer name / phone / email are PII and
    // intentionally omitted. Client still gets a clean tagged-union error.
    console.error(
      '[intake] createCaseFromWizardAction failed',
      JSON.stringify({
        customerKind: input.customer.kind,
        ...(input.customer.kind === 'new'
          ? { newCustomerKind: input.customer.customerKind }
          : {}),
        vehicleKind: input.vehicle.kind,
        ...(input.vehicle.kind === 'new' && input.vehicle.registrationNumber
          ? { plate: input.vehicle.registrationNumber }
          : {}),
        fundingKinds: input.fundingSources.map((fs) => fs.kind),
        hasBooking: Boolean(input.booking),
        ...(input.incidentTag ? { incidentTag: input.incidentTag } : {}),
        errorName: err instanceof Error ? err.name : typeof err,
        errorMessage: err instanceof Error ? err.message : String(err),
      }),
      err instanceof Error ? err.stack : undefined,
    );
    return { ok: false, message: normalizeError(err) };
  }
}
