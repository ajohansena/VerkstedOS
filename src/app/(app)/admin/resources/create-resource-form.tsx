'use client';

import { useState, useTransition } from 'react';

import { createResourceAction } from '@/app/actions/resources';

interface Workshop {
  readonly id: string;
  readonly name: string;
}

interface Props {
  workshops: ReadonlyArray<Workshop>;
  labels: {
    heading: string;
    name: string;
    kind: string;
    kindEquipment: string;
    kindFacility: string;
    workshop: string;
    sharedAcrossOrg: string;
    submit: string;
    personHint: string;
  };
}

/**
 * Create form for equipment + facility resources. Person resources are
 * auto-created via /admin/employees (Phase B) and therefore not creatable
 * from this surface — see `personHint`.
 */
export function CreateResourceForm({ workshops, labels }: Props) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [kind, setKind] = useState<'equipment' | 'facility'>('equipment');
  const [workshopId, setWorkshopId] = useState<string>('');

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        start(async () => {
          const result = await createResourceAction({
            kind,
            name: name.trim(),
            workshopId: workshopId === '' ? null : workshopId,
          });
          if (!result.ok) {
            setError(result.message);
            return;
          }
          setName('');
          setWorkshopId('');
        });
      }}
      className="space-y-3"
    >
      <p className="text-xs text-muted-foreground">{labels.personHint}</p>
      <div className="grid gap-3 md:grid-cols-3">
        <label className="space-y-1 text-xs">
          <span className="font-medium">{labels.name}</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            className="w-full rounded-md border bg-background px-3 py-2 text-sm"
          />
        </label>
        <label className="space-y-1 text-xs">
          <span className="font-medium">{labels.kind}</span>
          <select
            value={kind}
            onChange={(e) => setKind(e.target.value as typeof kind)}
            className="w-full rounded-md border bg-background px-3 py-2 text-sm"
          >
            <option value="equipment">{labels.kindEquipment}</option>
            <option value="facility">{labels.kindFacility}</option>
          </select>
        </label>
        <label className="space-y-1 text-xs">
          <span className="font-medium">{labels.workshop}</span>
          <select
            value={workshopId}
            onChange={(e) => setWorkshopId(e.target.value)}
            className="w-full rounded-md border bg-background px-3 py-2 text-sm"
          >
            <option value="">{labels.sharedAcrossOrg}</option>
            {workshops.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name}
              </option>
            ))}
          </select>
        </label>
      </div>
      <button
        type="submit"
        disabled={pending || name.trim().length === 0}
        className="inline-flex h-9 items-center rounded-md border bg-background px-3 text-sm font-medium hover:bg-muted/40 disabled:opacity-50"
      >
        {labels.submit}
      </button>
      {error ? (
        <p className="text-xs text-red-600" role="alert">
          {error}
        </p>
      ) : null}
    </form>
  );
}
