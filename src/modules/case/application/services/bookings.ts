import { and, asc, desc, eq, inArray, gte, lte, isNull } from 'drizzle-orm';

import { withTransaction } from '@/db/client';
import { recordAuditEvent } from '@/lib/audit/audit-writer';
import { emitEvent } from '@/lib/events/outbox';
import { caseBookings } from '@/db/schemas/case/case-bookings';
import { cases } from '@/db/schemas/case/cases';
import type { CaseBooking } from '@/db/types';
import type { RequestContext } from '@/lib/tenancy/context';
import { requirePermission } from '@/modules/identity/public';

import { validateBookingDates } from '../calculations/bookings';

/**
 * Case-booking service (doc 10 § Booking; doc 13 § 20.4). One active booking
 * per case at a time (DB partial unique index enforces). Re-bookings supersede
 * via cancel-and-create — full history retained.
 *
 * Permissions: `case:edit` covers tentative bookings + arrival/promise capture
 * (every receptionist can book). Confirmation, arrival, cancellation are also
 * `case:edit`. Resource-segment planning still goes through the production
 * module's `assignResource` which gates on `production:plan`.
 */

export class BookingValidationError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'BookingValidationError';
  }
}

export interface CreateBookingInput {
  caseId: string;
  workshopId: string;
  expectedArrivalAt?: Date | null;
  promisedDeliveryAt?: Date | null;
  notes?: string | null;
  /** When true, marks the booking confirmed at creation (skip the tentative step). */
  confirmImmediately?: boolean;
}

async function loadActiveBooking(
  tx: Parameters<Parameters<typeof withTransaction>[1]>[0],
  ctx: RequestContext,
  caseId: string,
): Promise<CaseBooking | null> {
  const rows = await tx
    .select()
    .from(caseBookings)
    .where(
      and(
        eq(caseBookings.organizationId, ctx.organizationId),
        eq(caseBookings.caseId, caseId),
        inArray(caseBookings.status, ['tentative', 'confirmed', 'arrived']),
        isNull(caseBookings.deletedAt),
      ),
    )
    .limit(1);
  return rows[0] ?? null;
}

/**
 * Create a booking for a case. Throws if the case already has an active
 * booking (caller must `cancelBooking` first to re-book — that workflow is
 * what makes history queryable).
 */
export async function createBooking(
  ctx: RequestContext,
  input: CreateBookingInput,
): Promise<CaseBooking> {
  await requirePermission(ctx, 'case:edit');

  const problems = validateBookingDates({
    expectedArrivalAt: input.expectedArrivalAt ?? null,
    promisedDeliveryAt: input.promisedDeliveryAt ?? null,
  });
  if (problems.length > 0) {
    throw new BookingValidationError('INVALID_DATES', problems.join(' | '));
  }

  return withTransaction(ctx, async (tx) => {
    // Defense in depth — DB also enforces this via partial unique index.
    const existing = await loadActiveBooking(tx, ctx, input.caseId);
    if (existing) {
      throw new BookingValidationError(
        'ACTIVE_BOOKING_EXISTS',
        'Saken har allerede en aktiv booking. Kanseller den først.',
      );
    }

    // Verify the case exists in this org (defensive — the FK enforces existence,
    // but a cross-org caseId would be silently accepted without this check;
    // RLS prevents the read but the insert would fail later with a confusing
    // FK error message).
    const caseRow = await tx
      .select({ id: cases.id })
      .from(cases)
      .where(
        and(
          eq(cases.id, input.caseId),
          eq(cases.organizationId, ctx.organizationId),
        ),
      )
      .limit(1);
    if (caseRow.length === 0) {
      throw new BookingValidationError(
        'CASE_NOT_FOUND',
        'Saken finnes ikke i denne organisasjonen.',
      );
    }

    const inserted = await tx
      .insert(caseBookings)
      .values({
        organizationId: ctx.organizationId,
        caseId: input.caseId,
        workshopId: input.workshopId,
        status: input.confirmImmediately ? 'confirmed' : 'tentative',
        expectedArrivalAt: input.expectedArrivalAt ?? null,
        promisedDeliveryAt: input.promisedDeliveryAt ?? null,
        notes: input.notes ?? null,
        confirmedAt: input.confirmImmediately ? new Date() : null,
        confirmedByUserId: input.confirmImmediately ? ctx.userId : null,
        createdBy: ctx.userId,
        updatedBy: ctx.userId,
      })
      .returning();
    const booking = inserted[0];
    if (!booking) throw new Error('Failed to create booking');

    await recordAuditEvent(tx, ctx, {
      action: 'created',
      entityTable: 'case_bookings',
      entityId: booking.id,
      after: {
        caseId: booking.caseId,
        workshopId: booking.workshopId,
        status: booking.status,
        expectedArrivalAt: booking.expectedArrivalAt,
        promisedDeliveryAt: booking.promisedDeliveryAt,
      },
    });

    await emitEvent(tx, ctx, {
      eventType: 'case.booking.created',
      payload: {
        caseId: booking.caseId,
        bookingId: booking.id,
        workshopId: booking.workshopId,
        status: booking.status,
        expectedArrivalAt: booking.expectedArrivalAt,
        promisedDeliveryAt: booking.promisedDeliveryAt,
      },
    });

    return booking;
  });
}

async function loadBookingForUpdate(
  tx: Parameters<Parameters<typeof withTransaction>[1]>[0],
  ctx: RequestContext,
  bookingId: string,
): Promise<CaseBooking> {
  const rows = await tx
    .select()
    .from(caseBookings)
    .where(
      and(
        eq(caseBookings.id, bookingId),
        eq(caseBookings.organizationId, ctx.organizationId),
      ),
    )
    .limit(1);
  const booking = rows[0];
  if (!booking) {
    throw new BookingValidationError(
      'BOOKING_NOT_FOUND',
      'Booking ikke funnet.',
    );
  }
  return booking;
}

/** Confirm a tentative booking. Idempotent if already confirmed. */
export async function confirmBooking(
  ctx: RequestContext,
  bookingId: string,
): Promise<CaseBooking> {
  await requirePermission(ctx, 'case:edit');

  return withTransaction(ctx, async (tx) => {
    const booking = await loadBookingForUpdate(tx, ctx, bookingId);
    if (booking.status === 'confirmed') return booking;
    if (booking.status !== 'tentative') {
      throw new BookingValidationError(
        'INVALID_TRANSITION',
        `Kan ikke bekrefte en booking i status «${booking.status}».`,
      );
    }

    const now = new Date();
    const updated = await tx
      .update(caseBookings)
      .set({
        status: 'confirmed',
        confirmedAt: now,
        confirmedByUserId: ctx.userId,
        updatedBy: ctx.userId,
        updatedAt: now,
      })
      .where(eq(caseBookings.id, bookingId))
      .returning();
    const next = updated[0];
    if (!next) throw new Error('Failed to confirm booking');

    await recordAuditEvent(tx, ctx, {
      action: 'updated',
      entityTable: 'case_bookings',
      entityId: bookingId,
      before: { status: booking.status },
      after: { status: 'confirmed' },
    });
    await emitEvent(tx, ctx, {
      eventType: 'case.booking.confirmed',
      payload: { caseId: booking.caseId, bookingId },
    });
    return next;
  });
}

/** Mark booking as arrived (vehicle dropped off). */
export async function markArrived(
  ctx: RequestContext,
  bookingId: string,
): Promise<CaseBooking> {
  await requirePermission(ctx, 'case:edit');

  return withTransaction(ctx, async (tx) => {
    const booking = await loadBookingForUpdate(tx, ctx, bookingId);
    if (booking.status === 'arrived') return booking;
    if (booking.status !== 'tentative' && booking.status !== 'confirmed') {
      throw new BookingValidationError(
        'INVALID_TRANSITION',
        `Kan ikke markere ankomst fra status «${booking.status}».`,
      );
    }

    const now = new Date();
    const updated = await tx
      .update(caseBookings)
      .set({
        status: 'arrived',
        arrivedAt: now,
        arrivedConfirmedByUserId: ctx.userId,
        // Implicit confirm if not yet confirmed (a no-show that turns into a walk-in).
        confirmedAt: booking.confirmedAt ?? now,
        confirmedByUserId: booking.confirmedByUserId ?? ctx.userId,
        updatedBy: ctx.userId,
        updatedAt: now,
      })
      .where(eq(caseBookings.id, bookingId))
      .returning();
    const next = updated[0];
    if (!next) throw new Error('Failed to mark arrival');

    await recordAuditEvent(tx, ctx, {
      action: 'updated',
      entityTable: 'case_bookings',
      entityId: bookingId,
      before: { status: booking.status },
      after: { status: 'arrived' },
    });
    await emitEvent(tx, ctx, {
      eventType: 'case.booking.arrived',
      payload: { caseId: booking.caseId, bookingId, arrivedAt: now },
    });
    return next;
  });
}

/**
 * Cancel an active booking (tentative, confirmed, or arrived). Reason is
 * required. Re-bookings: cancel the old one, then `createBooking` the new one.
 */
export async function cancelBooking(
  ctx: RequestContext,
  bookingId: string,
  reason: string,
): Promise<CaseBooking> {
  await requirePermission(ctx, 'case:edit');

  if (!reason.trim()) {
    throw new BookingValidationError(
      'REASON_REQUIRED',
      'Begrunnelse for kansellering er påkrevd.',
    );
  }

  return withTransaction(ctx, async (tx) => {
    const booking = await loadBookingForUpdate(tx, ctx, bookingId);
    if (booking.status === 'cancelled') return booking;

    const now = new Date();
    const updated = await tx
      .update(caseBookings)
      .set({
        status: 'cancelled',
        cancelledAt: now,
        cancelledByUserId: ctx.userId,
        cancelledReason: reason.trim(),
        updatedBy: ctx.userId,
        updatedAt: now,
      })
      .where(eq(caseBookings.id, bookingId))
      .returning();
    const next = updated[0];
    if (!next) throw new Error('Failed to cancel booking');

    await recordAuditEvent(tx, ctx, {
      action: 'updated',
      entityTable: 'case_bookings',
      entityId: bookingId,
      before: { status: booking.status },
      after: { status: 'cancelled', cancelledReason: reason.trim() },
    });
    await emitEvent(tx, ctx, {
      eventType: 'case.booking.cancelled',
      payload: { caseId: booking.caseId, bookingId, reason: reason.trim() },
    });
    return next;
  });
}

/** Return the active booking for a case (or null). */
export async function findActiveBookingForCase(
  ctx: RequestContext,
  caseId: string,
): Promise<CaseBooking | null> {
  return withTransaction(ctx, async (tx) =>
    loadActiveBooking(tx, ctx, caseId),
  );
}

/** Full booking history for a case (newest first). */
export async function listBookingsForCase(
  ctx: RequestContext,
  caseId: string,
): Promise<CaseBooking[]> {
  return withTransaction(ctx, async (tx) =>
    tx
      .select()
      .from(caseBookings)
      .where(
        and(
          eq(caseBookings.organizationId, ctx.organizationId),
          eq(caseBookings.caseId, caseId),
          isNull(caseBookings.deletedAt),
        ),
      )
      .orderBy(desc(caseBookings.createdAt)),
  );
}

/**
 * List bookings whose `expected_arrival_at` falls inside [from, to) for a
 * given workshop. Used by the planner Day/Week views to render arrival pins.
 */
export async function listBookingsForWorkshopInRange(
  ctx: RequestContext,
  workshopId: string,
  range: { from: Date; to: Date },
): Promise<CaseBooking[]> {
  return withTransaction(ctx, async (tx) =>
    tx
      .select()
      .from(caseBookings)
      .where(
        and(
          eq(caseBookings.organizationId, ctx.organizationId),
          eq(caseBookings.workshopId, workshopId),
          inArray(caseBookings.status, ['tentative', 'confirmed', 'arrived']),
          isNull(caseBookings.deletedAt),
          gte(caseBookings.expectedArrivalAt, range.from),
          lte(caseBookings.expectedArrivalAt, range.to),
        ),
      )
      .orderBy(asc(caseBookings.expectedArrivalAt)),
  );
}
