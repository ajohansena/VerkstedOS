'use client';

import { useState, useTransition } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

import { createOfficeTaskAction } from '@/app/actions/office-tasks';

/**
 * Client form for adding a new office task to a case (D3 Phase E).
 *
 * Calls the tagged-union `createOfficeTaskAction`; on failure surfaces an
 * inline message rather than letting Next 16 show its production digest screen.
 */
export function CaseOfficeTaskForm({
  caseId,
  labels,
}: {
  caseId: string;
  labels: {
    title: string;
    fieldTitle: string;
    fieldKind: string;
    fieldPriority: string;
    fieldDueAt: string;
    submit: string;
    priorityLow: string;
    priorityNormal: string;
    priorityHigh: string;
    priorityUrgent: string;
    kindOrderParts: string;
    kindCustomerCall: string;
    kindInsurerFollowup: string;
    kindRentalBooking: string;
    kindInvoicePrep: string;
    kindCustomerFollowup: string;
    kindDocumentation: string;
    kindOther: string;
  };
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [kind, setKind] = useState<
    | 'order_parts'
    | 'customer_call'
    | 'insurer_followup'
    | 'rental_booking'
    | 'invoice_prep'
    | 'customer_followup'
    | 'documentation'
    | 'other'
  >('other');
  const [priority, setPriority] = useState<
    'low' | 'normal' | 'high' | 'urgent'
  >('normal');
  const [dueAt, setDueAt] = useState('');

  function submit(): void {
    if (!title.trim()) {
      setError('EMPTY_TITLE');
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await createOfficeTaskAction({
        caseId,
        title,
        kind,
        priority,
        ...(dueAt ? { dueAt: new Date(dueAt).toISOString() } : {}),
      });
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setTitle('');
      setDueAt('');
      setKind('other');
      setPriority('normal');
    });
  }

  return (
    <div className="rounded-md border bg-muted/30 p-3">
      <h3 className="mb-2 text-sm font-medium">{labels.title}</h3>
      <div className="grid gap-2 sm:grid-cols-4">
        <div className="sm:col-span-2">
          <label
            htmlFor="office-task-title"
            className="block text-xs font-medium text-muted-foreground"
          >
            {labels.fieldTitle}
          </label>
          <Input
            id="office-task-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            disabled={pending}
          />
        </div>
        <div>
          <label
            htmlFor="office-task-kind"
            className="block text-xs font-medium text-muted-foreground"
          >
            {labels.fieldKind}
          </label>
          <select
            id="office-task-kind"
            value={kind}
            onChange={(e) => setKind(e.target.value as typeof kind)}
            disabled={pending}
            className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
          >
            <option value="order_parts">{labels.kindOrderParts}</option>
            <option value="customer_call">{labels.kindCustomerCall}</option>
            <option value="insurer_followup">
              {labels.kindInsurerFollowup}
            </option>
            <option value="rental_booking">{labels.kindRentalBooking}</option>
            <option value="invoice_prep">{labels.kindInvoicePrep}</option>
            <option value="customer_followup">
              {labels.kindCustomerFollowup}
            </option>
            <option value="documentation">{labels.kindDocumentation}</option>
            <option value="other">{labels.kindOther}</option>
          </select>
        </div>
        <div>
          <label
            htmlFor="office-task-priority"
            className="block text-xs font-medium text-muted-foreground"
          >
            {labels.fieldPriority}
          </label>
          <select
            id="office-task-priority"
            value={priority}
            onChange={(e) => setPriority(e.target.value as typeof priority)}
            disabled={pending}
            className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
          >
            <option value="low">{labels.priorityLow}</option>
            <option value="normal">{labels.priorityNormal}</option>
            <option value="high">{labels.priorityHigh}</option>
            <option value="urgent">{labels.priorityUrgent}</option>
          </select>
        </div>
        <div className="sm:col-span-3">
          <label
            htmlFor="office-task-due"
            className="block text-xs font-medium text-muted-foreground"
          >
            {labels.fieldDueAt}
          </label>
          <Input
            id="office-task-due"
            type="datetime-local"
            value={dueAt}
            onChange={(e) => setDueAt(e.target.value)}
            disabled={pending}
          />
        </div>
        <div className="flex items-end">
          <Button
            type="button"
            size="sm"
            onClick={submit}
            disabled={pending || title.trim().length === 0}
          >
            {labels.submit}
          </Button>
        </div>
      </div>
      {error ? <p className="mt-2 text-xs text-red-600">{error}</p> : null}
    </div>
  );
}
