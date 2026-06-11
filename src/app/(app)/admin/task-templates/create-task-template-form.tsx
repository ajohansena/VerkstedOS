'use client';

import { useState, useTransition } from 'react';

import {
  createTaskTemplateAction,
  type TaskTemplateActionResult,
} from '@/app/actions/task-templates';

interface Props {
  labels: {
    name: string;
    triggerEventType: string;
    triggerEventFilter: string;
    taskKind: string;
    taskTitleTemplate: string;
    dueOffsetMinutes: string;
    dueReference: string;
    submit: string;
  };
}

const KINDS: ReadonlyArray<
  | 'order_parts'
  | 'customer_call'
  | 'insurer_followup'
  | 'rental_booking'
  | 'invoice_prep'
  | 'customer_followup'
  | 'documentation'
  | 'other'
> = [
  'order_parts',
  'customer_call',
  'insurer_followup',
  'rental_booking',
  'invoice_prep',
  'customer_followup',
  'documentation',
  'other',
];

const REFS: ReadonlyArray<
  'event_time' | 'case_expected_arrival_at' | 'case_promised_delivery_at'
> = ['event_time', 'case_expected_arrival_at', 'case_promised_delivery_at'];

export function CreateTaskTemplateForm({ labels }: Props) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  return (
    <form
      className="grid gap-3 sm:grid-cols-2"
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        setSuccess(false);
        const form = e.currentTarget;
        const fd = new FormData(form);
        const filterRaw = String(fd.get('triggerEventFilter') ?? '').trim();
        let filter: Record<string, unknown> | null = null;
        if (filterRaw) {
          try {
            const parsed = JSON.parse(filterRaw);
            if (
              parsed &&
              typeof parsed === 'object' &&
              !Array.isArray(parsed)
            ) {
              filter = parsed as Record<string, unknown>;
            } else {
              setError('triggerEventFilter must be a JSON object.');
              return;
            }
          } catch {
            setError('triggerEventFilter is not valid JSON.');
            return;
          }
        }
        const dueOffsetMinutes = Number(
          String(fd.get('dueOffsetMinutes') ?? '0'),
        );
        start(async () => {
          const result: TaskTemplateActionResult<{ templateId: string }> =
            await createTaskTemplateAction({
              name: String(fd.get('name') ?? '').trim(),
              triggerEventType: String(fd.get('triggerEventType') ?? '').trim(),
              triggerEventFilter: filter,
              taskKind: String(fd.get('taskKind') ?? 'other') as
                | 'order_parts'
                | 'customer_call'
                | 'insurer_followup'
                | 'rental_booking'
                | 'invoice_prep'
                | 'customer_followup'
                | 'documentation'
                | 'other',
              taskTitleTemplate: String(
                fd.get('taskTitleTemplate') ?? '',
              ).trim(),
              dueOffsetMinutes: Number.isFinite(dueOffsetMinutes)
                ? dueOffsetMinutes
                : 0,
              dueReference: String(fd.get('dueReference') ?? 'event_time') as
                | 'event_time'
                | 'case_expected_arrival_at'
                | 'case_promised_delivery_at',
            });
          if (!result.ok) {
            setError(result.message);
            return;
          }
          setSuccess(true);
          form.reset();
        });
      }}
    >
      <label className="text-sm font-medium sm:col-span-2">
        {labels.name}
        <input
          name="name"
          required
          className="mt-1 w-full rounded-md border bg-background px-2 py-1 text-sm"
        />
      </label>

      <label className="text-sm font-medium">
        {labels.triggerEventType}
        <input
          name="triggerEventType"
          required
          placeholder="case.booking.confirmed"
          className="mt-1 w-full rounded-md border bg-background px-2 py-1 font-mono text-xs"
        />
      </label>

      <label className="text-sm font-medium">
        {labels.triggerEventFilter}
        <input
          name="triggerEventFilter"
          placeholder='{"toStateCode":"delivered"}'
          className="mt-1 w-full rounded-md border bg-background px-2 py-1 font-mono text-xs"
        />
      </label>

      <label className="text-sm font-medium">
        {labels.taskKind}
        <select
          name="taskKind"
          defaultValue="other"
          className="mt-1 w-full rounded-md border bg-background px-2 py-1 text-sm"
        >
          {KINDS.map((k) => (
            <option key={k} value={k}>
              {k}
            </option>
          ))}
        </select>
      </label>

      <label className="text-sm font-medium">
        {labels.dueReference}
        <select
          name="dueReference"
          defaultValue="event_time"
          className="mt-1 w-full rounded-md border bg-background px-2 py-1 text-sm"
        >
          {REFS.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
      </label>

      <label className="text-sm font-medium sm:col-span-2">
        {labels.taskTitleTemplate}
        <input
          name="taskTitleTemplate"
          required
          placeholder="Bestill deler — {caseNumber}"
          className="mt-1 w-full rounded-md border bg-background px-2 py-1 text-sm"
        />
      </label>

      <label className="text-sm font-medium">
        {labels.dueOffsetMinutes}
        <input
          name="dueOffsetMinutes"
          type="number"
          defaultValue={0}
          className="mt-1 w-full rounded-md border bg-background px-2 py-1 text-sm"
        />
      </label>

      <div className="flex items-center gap-3 sm:col-span-2">
        <button
          type="submit"
          disabled={pending}
          className="rounded-md border bg-foreground px-3 py-1.5 text-sm font-medium text-background disabled:opacity-50"
        >
          {labels.submit}
        </button>
        {error ? (
          <span className="text-sm text-red-600" role="alert">
            {error}
          </span>
        ) : null}
        {success ? <span className="text-sm text-green-700">✓</span> : null}
      </div>
    </form>
  );
}
