'use server';

import { revalidatePath } from 'next/cache';

import { getSessionContext } from '@/lib/auth/session';
import {
  cancelBooking,
  confirmBooking,
  createBooking,
  findActiveBookingForCase,
  listBookingsForCase,
  listBookingsForWorkshopInRange,
  markArrived,
  validateBookingDates,
  type CaseBooking,
} from '@/modules/case/public';

/**
 * Booking actions for the case-detail page and the planner (D2).
 *
 * All actions return a tagged union — never throw to the client — so the case
 * detail UI can surface a clean message instead of the Next 16 production
 * digest screen. Same shape as `createCaseFromWizardAction`.
 */

export type BookingActionResult<T = void> =
  | (T extends void ? { ok: true } : { ok: true; data: T })
  | { ok: false; message: string };

function normalizeError(err: unknown): string {
  if (err instanceof Error) return err.message;
  return 'UNKNOWN_ERROR';
}

export interface CreateBookingActionInput {
  caseId: string;
  workshopId: string;
  expectedArrivalAt?: string;
  promisedDeliveryAt?: string;
  notes?: string;
  confirmImmediately?: boolean;
  /**
   * When true, cancel any existing active booking (with the supplied reason)
   * before creating the new one. Powers "re-book" without two clicks.
   */
  replaceExisting?: { reason: string };
}

export async function createBookingAction(
  input: CreateBookingActionInput,
): Promise<BookingActionResult<{ bookingId: string }>> {
  try {
    const session = await getSessionContext();
    if (!session) return { ok: false, message: 'NOT_AUTHENTICATED' };

    const arrival = input.expectedArrivalAt
      ? new Date(input.expectedArrivalAt)
      : null;
    const delivery = input.promisedDeliveryAt
      ? new Date(input.promisedDeliveryAt)
      : null;
    const problems = validateBookingDates({
      expectedArrivalAt: arrival,
      promisedDeliveryAt: delivery,
    });
    if (problems.length > 0) {
      return { ok: false, message: `INVALID_DATES: ${problems.join(' | ')}` };
    }

    if (input.replaceExisting) {
      const active = await findActiveBookingForCase(
        session.context,
        input.caseId,
      );
      if (active) {
        await cancelBooking(
          session.context,
          active.id,
          input.replaceExisting.reason,
        );
      }
    }

    const created = await createBooking(session.context, {
      caseId: input.caseId,
      workshopId: input.workshopId,
      expectedArrivalAt: arrival,
      promisedDeliveryAt: delivery,
      ...(input.notes ? { notes: input.notes } : {}),
      ...(input.confirmImmediately ? { confirmImmediately: true } : {}),
    });

    revalidatePath(`/cases/${input.caseId}`);
    revalidatePath('/production');
    return { ok: true, data: { bookingId: created.id } };
  } catch (err) {
    console.error('createBookingAction failed', err);
    return { ok: false, message: normalizeError(err) };
  }
}

export async function confirmBookingAction(
  bookingId: string,
  caseId: string,
): Promise<BookingActionResult> {
  try {
    const session = await getSessionContext();
    if (!session) return { ok: false, message: 'NOT_AUTHENTICATED' };
    await confirmBooking(session.context, bookingId);
    revalidatePath(`/cases/${caseId}`);
    revalidatePath('/production');
    return { ok: true };
  } catch (err) {
    console.error('confirmBookingAction failed', err);
    return { ok: false, message: normalizeError(err) };
  }
}

export async function markBookingArrivedAction(
  bookingId: string,
  caseId: string,
): Promise<BookingActionResult> {
  try {
    const session = await getSessionContext();
    if (!session) return { ok: false, message: 'NOT_AUTHENTICATED' };
    await markArrived(session.context, bookingId);
    revalidatePath(`/cases/${caseId}`);
    revalidatePath('/production');
    return { ok: true };
  } catch (err) {
    console.error('markBookingArrivedAction failed', err);
    return { ok: false, message: normalizeError(err) };
  }
}

export async function cancelBookingAction(
  bookingId: string,
  caseId: string,
  reason: string,
): Promise<BookingActionResult> {
  try {
    const session = await getSessionContext();
    if (!session) return { ok: false, message: 'NOT_AUTHENTICATED' };
    await cancelBooking(session.context, bookingId, reason);
    revalidatePath(`/cases/${caseId}`);
    revalidatePath('/production');
    return { ok: true };
  } catch (err) {
    console.error('cancelBookingAction failed', err);
    return { ok: false, message: normalizeError(err) };
  }
}

/** List full booking history for a case (newest first). */
export async function listCaseBookingsAction(
  caseId: string,
): Promise<BookingActionResult<CaseBooking[]>> {
  try {
    const session = await getSessionContext();
    if (!session) return { ok: false, message: 'NOT_AUTHENTICATED' };
    const rows = await listBookingsForCase(session.context, caseId);
    return { ok: true, data: rows };
  } catch (err) {
    console.error('listCaseBookingsAction failed', err);
    return { ok: false, message: normalizeError(err) };
  }
}

/** List active bookings in a workshop's date range — for planner overlays. */
export async function listWorkshopBookingsAction(
  workshopId: string,
  fromIso: string,
  toIso: string,
): Promise<BookingActionResult<CaseBooking[]>> {
  try {
    const session = await getSessionContext();
    if (!session) return { ok: false, message: 'NOT_AUTHENTICATED' };
    const rows = await listBookingsForWorkshopInRange(
      session.context,
      workshopId,
      { from: new Date(fromIso), to: new Date(toIso) },
    );
    return { ok: true, data: rows };
  } catch (err) {
    console.error('listWorkshopBookingsAction failed', err);
    return { ok: false, message: normalizeError(err) };
  }
}
