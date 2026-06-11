'use client';

import { useState, useTransition } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { createBookingAction } from '@/app/actions/bookings';

/**
 * Production Planner — Book-from-intake banner (D2).
 *
 * Shown at the top of `/production` when navigated to with `?openBooking=<caseId>`.
 * Lets the receptionist book the freshly-created case without leaving the planner.
 *
 * Keeps the form deliberately small (workshop + dates + notes) — the same set
 * the wizard offers. Re-uses `createBookingAction` (same as case-detail).
 */

export interface BookFromIntakeBannerLabels {
  title: string;
  subtitle: string;
  workshop: string;
  arrival: string;
  delivery: string;
  notes: string;
  confirm: string;
  create: string;
  dismiss: string;
  successTitle: string;
  successOpenCase: string;
  errorPrefix: string;
}

export function BookFromIntakeBanner({
  caseId,
  caseNumber,
  workshops,
  labels,
}: {
  caseId: string;
  caseNumber: string;
  workshops: Array<{ id: string; name: string }>;
  labels: BookFromIntakeBannerLabels;
}) {
  const [pending, start] = useTransition();
  const [dismissed, setDismissed] = useState(false);
  const [workshopId, setWorkshopId] = useState(workshops[0]?.id ?? '');
  const [expectedArrivalAt, setArrival] = useState('');
  const [promisedDeliveryAt, setDelivery] = useState('');
  const [notes, setNotes] = useState('');
  const [confirmImmediately, setConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  if (dismissed) return null;

  if (success) {
    return (
      <aside className="rounded-md border border-emerald-300 bg-emerald-50 p-4 text-sm text-emerald-900">
        <p className="font-medium">
          {labels.successTitle.replace('{caseNumber}', caseNumber)}
        </p>
        <div className="mt-2 flex gap-2">
          <a
            href={`/cases/${caseId}`}
            className="text-emerald-900 underline underline-offset-2"
          >
            {labels.successOpenCase}
          </a>
        </div>
      </aside>
    );
  }

  const submit = () => {
    if (!workshopId) {
      setError(labels.workshop);
      return;
    }
    setError(null);
    start(async () => {
      const result = await createBookingAction({
        caseId,
        workshopId,
        ...(expectedArrivalAt ? { expectedArrivalAt } : {}),
        ...(promisedDeliveryAt ? { promisedDeliveryAt } : {}),
        ...(notes.trim() ? { notes: notes.trim() } : {}),
        ...(confirmImmediately ? { confirmImmediately: true } : {}),
      });
      if (result.ok) {
        setSuccess(true);
      } else {
        setError(`${labels.errorPrefix}: ${result.message}`);
      }
    });
  };

  return (
    <aside className="space-y-3 rounded-md border border-blue-300 bg-blue-50 p-4">
      <header className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-blue-900">
            {labels.title.replace('{caseNumber}', caseNumber)}
          </h2>
          <p className="text-xs text-blue-900/80">{labels.subtitle}</p>
        </div>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          className="text-xs text-blue-900 underline"
        >
          {labels.dismiss}
        </button>
      </header>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1 sm:col-span-2">
          <label className="text-xs font-medium text-blue-900">
            {labels.workshop}
          </label>
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
          <label className="text-xs font-medium text-blue-900">
            {labels.arrival}
          </label>
          <Input
            type="datetime-local"
            value={expectedArrivalAt}
            onChange={(e) => setArrival(e.target.value)}
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-blue-900">
            {labels.delivery}
          </label>
          <Input
            type="datetime-local"
            value={promisedDeliveryAt}
            onChange={(e) => setDelivery(e.target.value)}
          />
        </div>
        <div className="space-y-1 sm:col-span-2">
          <label className="text-xs font-medium text-blue-900">
            {labels.notes}
          </label>
          <Input value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>
        <label className="flex items-center gap-2 text-sm text-blue-900 sm:col-span-2">
          <input
            type="checkbox"
            checked={confirmImmediately}
            onChange={(e) => setConfirm(e.target.checked)}
          />
          {labels.confirm}
        </label>
      </div>

      {error ? (
        <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      ) : null}

      <div className="flex justify-end">
        <Button type="button" onClick={submit} disabled={pending}>
          {labels.create}
        </Button>
      </div>
    </aside>
  );
}
