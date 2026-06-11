import { and, desc, eq, inArray } from 'drizzle-orm';

import { getRawClient } from '@/db/client';
import { caseBookings } from '@/db/schemas/case/case-bookings';

/**
 * Booking inspection + repair (Dev surface, /dev/bookings — D2). Cross-org →
 * service-role connection. Lists recent bookings and surfaces active ones; the
 * repair force-cancels a stuck booking (tentative/confirmed/arrived) as a safe
 * escape when normal flow can't reach it.
 */

export interface BookingRow {
  readonly id: string;
  readonly caseId: string;
  readonly workshopId: string;
  readonly status: string;
  readonly expectedArrivalAt: Date | null;
  readonly promisedDeliveryAt: Date | null;
  readonly createdAt: Date;
}

export async function listBookingsForOrg(
  organizationId: string,
  limit = 100,
): Promise<BookingRow[]> {
  const db = getRawClient({ as: 'platform-inspector' });
  return db
    .select({
      id: caseBookings.id,
      caseId: caseBookings.caseId,
      workshopId: caseBookings.workshopId,
      status: caseBookings.status,
      expectedArrivalAt: caseBookings.expectedArrivalAt,
      promisedDeliveryAt: caseBookings.promisedDeliveryAt,
      createdAt: caseBookings.createdAt,
    })
    .from(caseBookings)
    .where(eq(caseBookings.organizationId, organizationId))
    .orderBy(desc(caseBookings.createdAt))
    .limit(limit);
}

/** Force-cancel a stuck booking — a safe escape. */
export async function repairStuckBooking(
  organizationId: string,
  bookingId: string,
  reason: string,
): Promise<void> {
  const db = getRawClient({ as: 'platform-inspector' });
  await db
    .update(caseBookings)
    .set({
      status: 'cancelled',
      cancelledAt: new Date(),
      cancelledReason: reason,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(caseBookings.id, bookingId),
        eq(caseBookings.organizationId, organizationId),
        inArray(caseBookings.status, ['tentative', 'confirmed', 'arrived']),
      ),
    );
}
