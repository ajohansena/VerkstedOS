import { and, desc, eq } from 'drizzle-orm';

import { getRawClient } from '@/db/client';
import { rentalAgreements } from '@/db/schemas/rental/rental-agreements';
import { rentalReservations } from '@/db/schemas/rental/rental-reservations';
import { rentalReturns } from '@/db/schemas/rental/rental-returns';
import { rentalVehicles } from '@/db/schemas/rental/rental-vehicles';
import { absenceEntries } from '@/db/schemas/workforce/absence-entries';

/**
 * Cross-org rental + absence inspection (Dev surface, /dev/rental, /dev/absence).
 * Uses the platform-inspector role. Read-only.
 */

export interface PlatformRentalRow {
  readonly id: string;
  readonly organizationId: string;
  readonly registrationNumber: string;
  readonly make: string | null;
  readonly model: string | null;
  readonly status: string;
}

export async function listPlatformRentalVehicles(
  limit = 200,
): Promise<PlatformRentalRow[]> {
  const db = getRawClient({ as: 'platform-inspector' });
  return db
    .select({
      id: rentalVehicles.id,
      organizationId: rentalVehicles.organizationId,
      registrationNumber: rentalVehicles.registrationNumber,
      make: rentalVehicles.make,
      model: rentalVehicles.model,
      status: rentalVehicles.status,
    })
    .from(rentalVehicles)
    .orderBy(desc(rentalVehicles.createdAt))
    .limit(limit);
}

export interface PlatformReservationRow {
  readonly id: string;
  readonly organizationId: string;
  readonly rentalVehicleId: string;
  readonly status: string;
  readonly startsAt: Date;
  readonly endsAt: Date;
}

export async function listPlatformReservations(
  limit = 200,
): Promise<PlatformReservationRow[]> {
  const db = getRawClient({ as: 'platform-inspector' });
  return db
    .select({
      id: rentalReservations.id,
      organizationId: rentalReservations.organizationId,
      rentalVehicleId: rentalReservations.rentalVehicleId,
      status: rentalReservations.status,
      startsAt: rentalReservations.startsAt,
      endsAt: rentalReservations.endsAt,
    })
    .from(rentalReservations)
    .orderBy(desc(rentalReservations.createdAt))
    .limit(limit);
}

export interface PlatformAgreementRow {
  readonly id: string;
  readonly organizationId: string;
  readonly reservationId: string;
  readonly status: string;
  readonly signedAt: Date | null;
  readonly signedByName: string | null;
  readonly signatureId: string | null;
}

export async function listPlatformAgreements(
  limit = 200,
): Promise<PlatformAgreementRow[]> {
  const db = getRawClient({ as: 'platform-inspector' });
  return db
    .select({
      id: rentalAgreements.id,
      organizationId: rentalAgreements.organizationId,
      reservationId: rentalAgreements.reservationId,
      status: rentalAgreements.status,
      signedAt: rentalAgreements.signedAt,
      signedByName: rentalAgreements.signedByName,
      signatureId: rentalAgreements.signatureId,
    })
    .from(rentalAgreements)
    .orderBy(desc(rentalAgreements.createdAt))
    .limit(limit);
}

export interface PlatformReturnRow {
  readonly id: string;
  readonly organizationId: string;
  readonly agreementId: string;
  readonly returnedAt: Date;
  readonly odometerKm: number | null;
  readonly fuelLevelPercent: number | null;
}

export async function listPlatformReturns(
  limit = 200,
): Promise<PlatformReturnRow[]> {
  const db = getRawClient({ as: 'platform-inspector' });
  return db
    .select({
      id: rentalReturns.id,
      organizationId: rentalReturns.organizationId,
      agreementId: rentalReturns.agreementId,
      returnedAt: rentalReturns.returnedAt,
      odometerKm: rentalReturns.odometerKm,
      fuelLevelPercent: rentalReturns.fuelLevelPercent,
    })
    .from(rentalReturns)
    .orderBy(desc(rentalReturns.returnedAt))
    .limit(limit);
}

export interface PlatformAbsenceRow {
  readonly id: string;
  readonly organizationId: string;
  readonly employeeId: string;
  readonly status: string;
  readonly startsAt: Date;
  readonly endsAt: Date;
  readonly approvedByUserId: string | null;
  readonly approvedAt: Date | null;
}

export async function listPlatformAbsences(
  limit = 200,
  organizationId?: string,
): Promise<PlatformAbsenceRow[]> {
  const db = getRawClient({ as: 'platform-inspector' });
  const base = db
    .select({
      id: absenceEntries.id,
      organizationId: absenceEntries.organizationId,
      employeeId: absenceEntries.employeeId,
      status: absenceEntries.status,
      startsAt: absenceEntries.startsAt,
      endsAt: absenceEntries.endsAt,
      approvedByUserId: absenceEntries.approvedByUserId,
      approvedAt: absenceEntries.approvedAt,
    })
    .from(absenceEntries);
  if (organizationId) {
    return base
      .where(eq(absenceEntries.organizationId, organizationId))
      .orderBy(desc(absenceEntries.createdAt))
      .limit(limit);
  }
  return base.orderBy(desc(absenceEntries.createdAt)).limit(limit);
}

// Re-export `and` so any future filter helper sits next to the queries.
export { and };
