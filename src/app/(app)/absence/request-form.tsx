'use client';

import { useTransition } from 'react';

export function AbsenceRequestForm({
  action,
  employees,
  types,
  labels,
}: {
  action: (formData: FormData) => Promise<void>;
  employees: Array<{ id: string; displayName: string }>;
  types: Array<{ id: string; label: string }>;
  labels: {
    employee: string;
    type: string;
    start: string;
    end: string;
    note: string;
    submit: string;
  };
}) {
  const [pending, startTransition] = useTransition();

  return (
    <form
      action={(fd) => {
        startTransition(async () => {
          await action(fd);
        });
      }}
      className="grid grid-cols-1 gap-3 md:grid-cols-6"
    >
      <label className="md:col-span-2">
        <span className="mb-1 block text-xs text-muted-foreground">
          {labels.employee}
        </span>
        <select
          name="employeeId"
          required
          className="w-full rounded-md border bg-background px-3 py-2 text-sm"
        >
          {employees.map((e) => (
            <option key={e.id} value={e.id}>
              {e.displayName}
            </option>
          ))}
        </select>
      </label>
      <label className="md:col-span-2">
        <span className="mb-1 block text-xs text-muted-foreground">
          {labels.type}
        </span>
        <select
          name="absenceTypeId"
          required
          className="w-full rounded-md border bg-background px-3 py-2 text-sm"
        >
          {types.map((t) => (
            <option key={t.id} value={t.id}>
              {t.label}
            </option>
          ))}
        </select>
      </label>
      <label className="md:col-span-1">
        <span className="mb-1 block text-xs text-muted-foreground">
          {labels.start}
        </span>
        <input
          type="datetime-local"
          name="startsAt"
          required
          className="w-full rounded-md border bg-background px-3 py-2 text-sm"
        />
      </label>
      <label className="md:col-span-1">
        <span className="mb-1 block text-xs text-muted-foreground">
          {labels.end}
        </span>
        <input
          type="datetime-local"
          name="endsAt"
          required
          className="w-full rounded-md border bg-background px-3 py-2 text-sm"
        />
      </label>
      <label className="md:col-span-5">
        <span className="mb-1 block text-xs text-muted-foreground">
          {labels.note}
        </span>
        <input
          type="text"
          name="note"
          className="w-full rounded-md border bg-background px-3 py-2 text-sm"
        />
      </label>
      <button
        type="submit"
        disabled={pending}
        className="md:col-span-1 rounded-md border border-foreground bg-foreground px-3 py-2 text-sm font-medium text-background hover:opacity-90 disabled:opacity-50"
      >
        {labels.submit}
      </button>
    </form>
  );
}
