import { and, asc, desc, eq, gte, isNull, lt, sql } from 'drizzle-orm';

import { withTransaction } from '@/db/client';
import { rentalAgreements } from '@/db/schemas/rental/rental-agreements';
import { rentalReservations } from '@/db/schemas/rental/rental-reservations';
import { rentalReturns } from '@/db/schemas/rental/rental-returns';
import { rentalVehicles } from '@/db/schemas/rental/rental-vehicles';
import type {
  NewRentalAgreement,
  NewRentalReservation,
  NewRentalReturn,
  NewRentalVehicle,
  RentalAgreement,
  RentalReservation,
  RentalReturn,
  RentalVehicle,
} from '@/db/types';
import type { RequestContext } from '@/lib/tenancy/context';

// --- Vehicles --------------------------------------------------------------

export async function insertRentalVehicle(
  ctx: RequestContext,
  input: NewRentalVehicle,
): Promise<RentalVehicle> {
  return withTransaction(ctx, async (tx) => {
    const rows = await tx
      .insert(rentalVehicles)
      .values({
        ...input,
        organizationId: ctx.organizationId,
        createdBy: ctx.userId,
        updatedBy: ctx.userId,
      })
      .returning();
    return rows[0]!;
  });
}

export async function listRentalVehicles(
  ctx: RequestContext,
): Promise<RentalVehicle[]> {
  return withTransaction(ctx, async (tx) => {
    return tx
      .select()
      .from(rentalVehicles)
      .where(
        and(
          eq(rentalVehicles.organizationId, ctx.organizationId),
          isNull(rentalVehicles.deletedAt),
        ),
      )
      .orderBy(asc(rentalVehicles.registrationNumber));
  });
}

export async function findRentalVehicleById(
  ctx: RequestContext,
  id: string,
): Promise<RentalVehicle | null> {
  return withTransaction(ctx, async (tx) => {
    const rows = await tx
      .select()
      .from(rentalVehicles)
      .where(
        and(
          eq(rentalVehicles.id, id),
          eq(rentalVehicles.organizationId, ctx.organizationId),
        ),
      )
      .limit(1);
    return rows[0] ?? null;
  });
}

// --- Reservations ----------------------------------------------------------

export async function insertRentalReservation(
  ctx: RequestContext,
  input: NewRentalReservation,
): Promise<RentalReservation> {
  return withTransaction(ctx, async (tx) => {
    const rows = await tx
      .insert(rentalReservations)
      .values({
        ...input,
        organizationId: ctx.organizationId,
        createdBy: ctx.userId,
        updatedBy: ctx.userId,
      })
      .returning();
    return rows[0]!;
  });
}

export async function listReservationsForVehicleInRange(
  ctx: RequestContext,
  vehicleId: string,
  rangeStart: Date,
  rangeEnd: Date,
): Promise<RentalReservation[]> {
  return withTransaction(ctx, async (tx) => {
    return tx
      .select()
      .from(rentalReservations)
      .where(
        and(
          eq(rentalReservations.organizationId, ctx.organizationId),
          eq(rentalReservations.rentalVehicleId, vehicleId),
          lt(rentalReservations.startsAt, rangeEnd),
          gte(rentalReservations.endsAt, rangeStart),
          isNull(rentalReservations.deletedAt),
        ),
      )
      .orderBy(asc(rentalReservations.startsAt));
  });
}

export async function listActiveReservationsForOrg(
  ctx: RequestContext,
): Promise<RentalReservation[]> {
  return withTransaction(ctx, async (tx) => {
    return tx
      .select()
      .from(rentalReservations)
      .where(
        and(
          eq(rentalReservations.organizationId, ctx.organizationId),
          isNull(rentalReservations.deletedAt),
          sql`${rentalReservations.status} in ('planned', 'active')`,
        ),
      )
      .orderBy(desc(rentalReservations.startsAt));
  });
}

export async function updateReservationStatus(
  ctx: RequestContext,
  id: string,
  status: RentalReservation['status'],
): Promise<RentalReservation> {
  return withTransaction(ctx, async (tx) => {
    const rows = await tx
      .update(rentalReservations)
      .set({ status, updatedAt: new Date(), updatedBy: ctx.userId })
      .where(
        and(
          eq(rentalReservations.id, id),
          eq(rentalReservations.organizationId, ctx.organizationId),
        ),
      )
      .returning();
    if (rows.length === 0) throw new Error('RESERVATION_NOT_FOUND');
    return rows[0]!;
  });
}

// --- Agreements ------------------------------------------------------------

export async function insertRentalAgreement(
  ctx: RequestContext,
  input: NewRentalAgreement,
): Promise<RentalAgreement> {
  return withTransaction(ctx, async (tx) => {
    const rows = await tx
      .insert(rentalAgreements)
      .values({
        ...input,
        organizationId: ctx.organizationId,
        createdBy: ctx.userId,
        updatedBy: ctx.userId,
      })
      .returning();
    return rows[0]!;
  });
}

export async function updateAgreement(
  ctx: RequestContext,
  id: string,
  set: Partial<RentalAgreement>,
): Promise<RentalAgreement> {
  return withTransaction(ctx, async (tx) => {
    const rows = await tx
      .update(rentalAgreements)
      .set({ ...set, updatedAt: new Date(), updatedBy: ctx.userId })
      .where(
        and(
          eq(rentalAgreements.id, id),
          eq(rentalAgreements.organizationId, ctx.organizationId),
        ),
      )
      .returning();
    if (rows.length === 0) throw new Error('AGREEMENT_NOT_FOUND');
    return rows[0]!;
  });
}

export async function findAgreementByReservation(
  ctx: RequestContext,
  reservationId: string,
): Promise<RentalAgreement | null> {
  return withTransaction(ctx, async (tx) => {
    const rows = await tx
      .select()
      .from(rentalAgreements)
      .where(
        and(
          eq(rentalAgreements.reservationId, reservationId),
          eq(rentalAgreements.organizationId, ctx.organizationId),
        ),
      )
      .limit(1);
    return rows[0] ?? null;
  });
}

// --- Returns ---------------------------------------------------------------

export async function insertRentalReturn(
  ctx: RequestContext,
  input: NewRentalReturn,
): Promise<RentalReturn> {
  return withTransaction(ctx, async (tx) => {
    const rows = await tx
      .insert(rentalReturns)
      .values({
        ...input,
        organizationId: ctx.organizationId,
        createdBy: ctx.userId,
        updatedBy: ctx.userId,
      })
      .returning();
    return rows[0]!;
  });
}

export async function findReturnByAgreement(
  ctx: RequestContext,
  agreementId: string,
): Promise<RentalReturn | null> {
  return withTransaction(ctx, async (tx) => {
    const rows = await tx
      .select()
      .from(rentalReturns)
      .where(
        and(
          eq(rentalReturns.agreementId, agreementId),
          eq(rentalReturns.organizationId, ctx.organizationId),
        ),
      )
      .limit(1);
    return rows[0] ?? null;
  });
}
