/**
 * Rental management service (Sprint 18).
 *
 * - Fleet management is admin:config (rate card, vehicle registration).
 * - Reservations and agreements are case:edit (front-of-house coordinates them).
 * - Returns are case:edit (front-of-house records handover-back).
 * - Conflict detection uses the SSoT `hasConflict` (rental/availability.ts).
 */

import { recordAuditEvent } from '@/lib/audit/audit-writer';
import { withTransaction } from '@/db/client';
import { emitEvent } from '@/lib/events/outbox';
import type {
  RentalAgreement,
  RentalReservation,
  RentalReturn,
  RentalVehicle,
} from '@/db/types';
import type { RequestContext } from '@/lib/tenancy/context';
import { requirePermission } from '@/modules/identity/public';

import { hasConflict } from '../calculations/availability';
import {
  findAgreementByReservation,
  findRentalVehicleById,
  findReturnByAgreement,
  insertRentalAgreement,
  insertRentalReservation,
  insertRentalReturn,
  insertRentalVehicle,
  listReservationsForVehicleInRange,
  updateAgreement,
  updateReservationStatus,
} from '../../infrastructure/repositories/rental-repository';

export class RentalConflictError extends Error {
  readonly code = 'RENTAL_CONFLICT' as const;
  constructor(vehicleId: string) {
    super(`Vehicle ${vehicleId} is already reserved for that window.`);
  }
}

export interface CreateVehicleInput {
  registrationNumber: string;
  make?: string | null;
  model?: string | null;
  dailyRate?: string;
  workshopId?: string | null;
}

export async function registerRentalVehicle(
  ctx: RequestContext,
  input: CreateVehicleInput,
): Promise<RentalVehicle> {
  await requirePermission(ctx, 'admin:config');
  const vehicle = await insertRentalVehicle(ctx, {
    organizationId: ctx.organizationId,
    registrationNumber: input.registrationNumber,
    make: input.make ?? null,
    model: input.model ?? null,
    dailyRate: input.dailyRate ?? '0',
    workshopId: input.workshopId ?? null,
    status: 'available',
    currency: 'NOK',
  });
  await withTransaction(ctx, async (tx) => {
    await recordAuditEvent(tx, ctx, {
      action: 'created',
      entityTable: 'rental_vehicles',
      entityId: vehicle.id,
      after: { registrationNumber: vehicle.registrationNumber },
    });
    await emitEvent(tx, ctx, {
      eventType: 'rental.vehicle.registered',
      payload: { id: vehicle.id, regNo: vehicle.registrationNumber },
    });
  });
  return vehicle;
}

export interface CreateReservationInput {
  rentalVehicleId: string;
  caseId?: string | null;
  customerId?: string | null;
  fundingSourceId?: string | null;
  startsAt: Date;
  endsAt: Date;
  notes?: string | null;
}

export async function createReservation(
  ctx: RequestContext,
  input: CreateReservationInput,
): Promise<RentalReservation> {
  await requirePermission(ctx, 'case:edit');
  if (input.endsAt <= input.startsAt) {
    throw new Error('RESERVATION_RANGE_INVALID');
  }
  const vehicle = await findRentalVehicleById(ctx, input.rentalVehicleId);
  if (!vehicle) throw new Error('VEHICLE_NOT_FOUND');
  if (vehicle.status === 'decommissioned') {
    throw new Error('VEHICLE_DECOMMISSIONED');
  }
  const existing = await listReservationsForVehicleInRange(
    ctx,
    input.rentalVehicleId,
    input.startsAt,
    input.endsAt,
  );
  if (
    hasConflict(
      { startsAt: input.startsAt, endsAt: input.endsAt },
      existing.map((r) => ({
        id: r.id,
        status: r.status,
        startsAt: r.startsAt,
        endsAt: r.endsAt,
      })),
    )
  ) {
    throw new RentalConflictError(input.rentalVehicleId);
  }
  const reservation = await insertRentalReservation(ctx, {
    organizationId: ctx.organizationId,
    rentalVehicleId: input.rentalVehicleId,
    caseId: input.caseId ?? null,
    customerId: input.customerId ?? null,
    fundingSourceId: input.fundingSourceId ?? null,
    startsAt: input.startsAt,
    endsAt: input.endsAt,
    notes: input.notes ?? null,
    status: 'planned',
  });
  await withTransaction(ctx, async (tx) => {
    await recordAuditEvent(tx, ctx, {
      action: 'created',
      entityTable: 'rental_reservations',
      entityId: reservation.id,
      after: {
        vehicleId: input.rentalVehicleId,
        startsAt: input.startsAt.toISOString(),
        endsAt: input.endsAt.toISOString(),
      },
    });
    await emitEvent(tx, ctx, {
      eventType: 'rental.reservation.created',
      payload: {
        id: reservation.id,
        vehicleId: input.rentalVehicleId,
        caseId: input.caseId,
      },
    });
  });
  return reservation;
}

export async function activateReservation(
  ctx: RequestContext,
  id: string,
): Promise<RentalReservation> {
  await requirePermission(ctx, 'case:edit');
  return updateReservationStatus(ctx, id, 'active');
}

export async function completeReservation(
  ctx: RequestContext,
  id: string,
): Promise<RentalReservation> {
  await requirePermission(ctx, 'case:edit');
  return updateReservationStatus(ctx, id, 'completed');
}

export async function cancelReservation(
  ctx: RequestContext,
  id: string,
): Promise<RentalReservation> {
  await requirePermission(ctx, 'case:edit');
  return updateReservationStatus(ctx, id, 'cancelled');
}

export interface CreateAgreementInput {
  reservationId: string;
  terms?: string | null;
}

export async function createAgreement(
  ctx: RequestContext,
  input: CreateAgreementInput,
): Promise<RentalAgreement> {
  await requirePermission(ctx, 'case:edit');
  const existing = await findAgreementByReservation(ctx, input.reservationId);
  if (existing) return existing;
  const agreement = await insertRentalAgreement(ctx, {
    organizationId: ctx.organizationId,
    reservationId: input.reservationId,
    status: 'draft',
    terms: input.terms ?? null,
  });
  await withTransaction(ctx, async (tx) => {
    await recordAuditEvent(tx, ctx, {
      action: 'created',
      entityTable: 'rental_agreements',
      entityId: agreement.id,
      after: { reservationId: input.reservationId },
    });
  });
  return agreement;
}

export async function signAgreement(
  ctx: RequestContext,
  id: string,
  signedByName: string,
  signatureId: string | null = null,
): Promise<RentalAgreement> {
  await requirePermission(ctx, 'case:edit');
  if (!signedByName || signedByName.trim().length === 0) {
    throw new Error('SIGNER_NAME_REQUIRED');
  }
  const agreement = await updateAgreement(ctx, id, {
    status: 'signed',
    signedAt: new Date(),
    signedByName,
    signatureId,
  });
  await withTransaction(ctx, async (tx) => {
    await recordAuditEvent(tx, ctx, {
      action: 'updated',
      entityTable: 'rental_agreements',
      entityId: id,
      after: { status: 'signed', signedByName },
    });
    await emitEvent(tx, ctx, {
      eventType: 'rental.agreement.signed',
      payload: { id, signedByName },
    });
  });
  return agreement;
}

export interface RecordReturnInput {
  agreementId: string;
  returnedAt: Date;
  odometerKm?: number | null;
  fuelLevelPercent?: number | null;
  damageNotes?: string | null;
  additionalChargesAmount?: string | null;
}

export async function recordReturn(
  ctx: RequestContext,
  input: RecordReturnInput,
): Promise<RentalReturn> {
  await requirePermission(ctx, 'case:edit');
  const existing = await findReturnByAgreement(ctx, input.agreementId);
  if (existing) return existing;
  const returnRow = await insertRentalReturn(ctx, {
    organizationId: ctx.organizationId,
    agreementId: input.agreementId,
    returnedAt: input.returnedAt,
    odometerKm: input.odometerKm ?? null,
    fuelLevelPercent: input.fuelLevelPercent ?? null,
    damageNotes: input.damageNotes ?? null,
    additionalChargesAmount: input.additionalChargesAmount ?? null,
  });
  await updateAgreement(ctx, input.agreementId, { status: 'closed' });
  await withTransaction(ctx, async (tx) => {
    await recordAuditEvent(tx, ctx, {
      action: 'created',
      entityTable: 'rental_returns',
      entityId: returnRow.id,
      after: { agreementId: input.agreementId },
    });
    await emitEvent(tx, ctx, {
      eventType: 'rental.return.recorded',
      payload: { id: returnRow.id, agreementId: input.agreementId },
    });
  });
  return returnRow;
}
