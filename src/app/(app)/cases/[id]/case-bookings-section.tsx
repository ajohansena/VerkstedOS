'use client';

import { useMemo, useState, useTransition } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  cancelBookingAction,
  confirmBookingAction,
  createBookingAction,
  markBookingArrivedAction,
} from '@/app/actions/bookings';
import type { CaseBooking } from '@/modules/case/public';

/**
 * Case-detail bookings section (D2). One card with:
 *   - The active booking + status transitions (confirm / mark arrived / cancel).
 *   - A "create / replace" form for setting up a new booking.
 *   - The history of all bookings on this case (oldest at bottom).
 *
 * Status transitions are enforced server-side; this component just hides
 * buttons that don't make sense at the current status (defense-in-depth).
 */

export interface BookingSectionLabels {
  title: string;
  description: string;
  activeNone: string;
  statusTentative: string;
  statusConfirmed: string;
  statusArrived: string;
  statusCancelled: string;
  arrival: string;
  delivery: string;
  workshop: string;
  notes: string;
  cancelReason: string;
  cancelReasonRequired: string;
  create: string;
  confirm: string;
  markArrived: string;
  cancel: string;
  replace: string;
  historyTitle: string;
  historyEmpty: string;
  dateError: string;
}

export function CaseBookingsSection({
  caseId,
  workshops,
  bookings: initialBookings,
  labels,
}: {
  caseId: string;
  workshops: Array<{ id: string; name: string }>;
  bookings: CaseBooking[];
  labels: BookingSectionLabels;
}) {
  // The server re-fetches on revalidate, but optimistic-local update via
  // `useState` lets the form clear smoothly while the page re-renders.
  const [bookings] = useState<CaseBooking[]>(initialBookings);
  const [pending, start] = useTransition();
  const [actionError, setActionError] = useState<string | null>(null);

  const active = useMemo(
    () =>
      bookings.find(
        (b) =>
          b.status === 'tentative' ||
          b.status === 'confirmed' ||
          b.status === 'arrived',
      ) ?? null,
    [bookings],
  );

  return (
    <section className="space-y-4 rounded-lg border bg-card p-4">
      <header>
        <h2 className="text-base font-semibold">{labels.title}</h2>
        <p className="text-xs text-muted-foreground">{labels.description}</p>
      </header>

      {actionError ? (
        <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {actionError}
        </p>
      ) : null}

      <ActiveBookingPanel
        active={active}
        caseId={caseId}
        workshops={workshops}
        labels={labels}
        pending={pending}
        onAction={(promise) =>
          start(async () => {
            const r = await promise;
            if (!r.ok) setActionError(r.message);
            else setActionError(null);
          })
        }
      />

      <CreateBookingForm
        caseId={caseId}
        workshops={workshops}
        replaceActive={Boolean(active)}
        labels={labels}
        pending={pending}
        onSubmit={(promise) =>
          start(async () => {
            const r = await promise;
            if (!r.ok) setActionError(r.message);
            else setActionError(null);
          })
        }
      />

      <HistoryList bookings={bookings} workshops={workshops} labels={labels} />
    </section>
  );
}

function statusLabel(
  status: CaseBooking['status'],
  labels: BookingSectionLabels,
): string {
  switch (status) {
    case 'tentative':
      return labels.statusTentative;
    case 'confirmed':
      return labels.statusConfirmed;
    case 'arrived':
      return labels.statusArrived;
    case 'cancelled':
      return labels.statusCancelled;
    default:
      return status;
  }
}

function fmtDate(d: Date | string | null): string {
  if (!d) return '—';
  const date = typeof d === 'string' ? new Date(d) : d;
  return date.toLocaleString();
}

function ActiveBookingPanel({
  active,
  caseId,
  workshops,
  labels,
  pending,
  onAction,
}: {
  active: CaseBooking | null;
  caseId: string;
  workshops: Array<{ id: string; name: string }>;
  labels: BookingSectionLabels;
  pending: boolean;
  onAction: (
    promise: Promise<{ ok: true } | { ok: false; message: string }>,
  ) => void;
}) {
  const [cancelReason, setCancelReason] = useState('');

  if (!active) {
    return (
      <p className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">
        {labels.activeNone}
      </p>
    );
  }

  const workshopName =
    workshops.find((w) => w.id === active.workshopId)?.name ??
    active.workshopId.slice(0, 8);

  return (
    <div className="space-y-3 rounded-md border p-3 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="inline-flex items-center rounded-full bg-secondary px-2 py-0.5 text-xs font-medium">
          {statusLabel(active.status, labels)}
        </span>
        <span className="text-xs text-muted-foreground">
          {labels.workshop}: {workshopName}
        </span>
      </div>
      <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
        <dt className="text-muted-foreground">{labels.arrival}</dt>
        <dd>{fmtDate(active.expectedArrivalAt)}</dd>
        <dt className="text-muted-foreground">{labels.delivery}</dt>
        <dd>{fmtDate(active.promisedDeliveryAt)}</dd>
        {active.notes ? (
          <>
            <dt className="text-muted-foreground">{labels.notes}</dt>
            <dd>{active.notes}</dd>
          </>
        ) : null}
      </dl>

      <div className="flex flex-wrap gap-2">
        {active.status === 'tentative' ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={pending}
            onClick={() => onAction(confirmBookingAction(active.id, caseId))}
          >
            {labels.confirm}
          </Button>
        ) : null}
        {active.status === 'tentative' || active.status === 'confirmed' ? (
          <Button
            type="button"
            size="sm"
            disabled={pending}
            onClick={() =>
              onAction(markBookingArrivedAction(active.id, caseId))
            }
          >
            {labels.markArrived}
          </Button>
        ) : null}
      </div>

      {active.status !== 'cancelled' ? (
        <div className="flex flex-wrap items-center gap-2 border-t pt-2">
          <Input
            value={cancelReason}
            onChange={(e) => setCancelReason(e.target.value)}
            placeholder={labels.cancelReason}
            className="flex-1"
          />
          <Button
            type="button"
            size="sm"
            variant="destructive"
            disabled={pending}
            onClick={() => {
              if (!cancelReason.trim()) {
                onAction(
                  Promise.resolve({
                    ok: false,
                    message: labels.cancelReasonRequired,
                  }),
                );
                return;
              }
              onAction(
                cancelBookingAction(active.id, caseId, cancelReason.trim()),
              );
            }}
          >
            {labels.cancel}
          </Button>
        </div>
      ) : null}
    </div>
  );
}

function CreateBookingForm({
  caseId,
  workshops,
  replaceActive,
  labels,
  pending,
  onSubmit,
}: {
  caseId: string;
  workshops: Array<{ id: string; name: string }>;
  replaceActive: boolean;
  labels: BookingSectionLabels;
  pending: boolean;
  onSubmit: (
    promise: Promise<
      { ok: true; data: { bookingId: string } } | { ok: false; message: string }
    >,
  ) => void;
}) {
  const [workshopId, setWorkshopId] = useState(workshops[0]?.id ?? '');
  const [arrival, setArrival] = useState('');
  const [delivery, setDelivery] = useState('');
  const [notes, setNotes] = useState('');
  const [confirmImmediately, setConfirm] = useState(false);
  const [replaceReason, setReplaceReason] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);

  const dateError =
    arrival && delivery && new Date(delivery) < new Date(arrival)
      ? labels.dateError
      : null;

  if (workshops.length === 0) return null;

  const submit = () => {
    setLocalError(null);
    if (dateError) {
      setLocalError(dateError);
      return;
    }
    if (replaceActive && !replaceReason.trim()) {
      setLocalError(labels.cancelReasonRequired);
      return;
    }
    onSubmit(
      createBookingAction({
        caseId,
        workshopId,
        ...(arrival ? { expectedArrivalAt: arrival } : {}),
        ...(delivery ? { promisedDeliveryAt: delivery } : {}),
        ...(notes.trim() ? { notes: notes.trim() } : {}),
        ...(confirmImmediately ? { confirmImmediately: true } : {}),
        ...(replaceActive
          ? { replaceExisting: { reason: replaceReason.trim() } }
          : {}),
      }),
    );
    setArrival('');
    setDelivery('');
    setNotes('');
    setReplaceReason('');
    setConfirm(false);
  };

  return (
    <div className="space-y-3 rounded-md border border-dashed p-3">
      <h3 className="text-sm font-medium">
        {replaceActive ? labels.replace : labels.create}
      </h3>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1 sm:col-span-2">
          <label className="text-xs font-medium">{labels.workshop}</label>
          <select
            className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
            value={workshopId}
            onChange={(e) => setWorkshopId(e.target.value)}
          >
            {workshops.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium">{labels.arrival}</label>
          <Input
            type="datetime-local"
            value={arrival}
            onChange={(e) => setArrival(e.target.value)}
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium">{labels.delivery}</label>
          <Input
            type="datetime-local"
            value={delivery}
            onChange={(e) => setDelivery(e.target.value)}
          />
        </div>
        <div className="space-y-1 sm:col-span-2">
          <label className="text-xs font-medium">{labels.notes}</label>
          <Input value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>
        <label className="flex items-center gap-2 text-sm sm:col-span-2">
          <input
            type="checkbox"
            checked={confirmImmediately}
            onChange={(e) => setConfirm(e.target.checked)}
          />
          {labels.confirm}
        </label>
        {replaceActive ? (
          <div className="space-y-1 sm:col-span-2">
            <label className="text-xs font-medium">{labels.cancelReason}</label>
            <Input
              value={replaceReason}
              onChange={(e) => setReplaceReason(e.target.value)}
              placeholder={labels.cancelReasonRequired}
            />
          </div>
        ) : null}
      </div>
      {localError ? (
        <p className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          {localError}
        </p>
      ) : null}
      <div className="flex justify-end">
        <Button type="button" disabled={pending} onClick={submit}>
          {replaceActive ? labels.replace : labels.create}
        </Button>
      </div>
    </div>
  );
}

function HistoryList({
  bookings,
  workshops,
  labels,
}: {
  bookings: CaseBooking[];
  workshops: Array<{ id: string; name: string }>;
  labels: BookingSectionLabels;
}) {
  if (bookings.length === 0) {
    return (
      <div className="border-t pt-3">
        <p className="text-xs text-muted-foreground">{labels.historyEmpty}</p>
      </div>
    );
  }
  return (
    <div className="border-t pt-3">
      <h3 className="mb-2 text-sm font-medium">{labels.historyTitle}</h3>
      <ol className="space-y-1 text-xs text-muted-foreground">
        {bookings.map((b) => {
          const wn =
            workshops.find((w) => w.id === b.workshopId)?.name ??
            b.workshopId.slice(0, 8);
          return (
            <li key={b.id} className="flex items-center justify-between">
              <span>
                {statusLabel(b.status, labels)} · {wn} ·{' '}
                {fmtDate(b.expectedArrivalAt)} → {fmtDate(b.promisedDeliveryAt)}
              </span>
              {b.cancelledReason ? <span>({b.cancelledReason})</span> : null}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
