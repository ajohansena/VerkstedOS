'use client';

import { useState, useTransition } from 'react';

import {
  archiveResourceAction,
  updateResourceAction,
} from '@/app/actions/resources';

interface Workshop {
  readonly id: string;
  readonly name: string;
}

interface Props {
  resourceId: string;
  kind: 'person' | 'equipment' | 'facility';
  currentStatus: 'active' | 'inactive' | 'maintenance';
  currentWorkshopId: string | null;
  workshops: ReadonlyArray<Workshop>;
  labels: {
    statusActive: string;
    statusInactive: string;
    statusMaintenance: string;
    sharedAcrossOrg: string;
    saveStatus: string;
    saveWorkshop: string;
    archive: string;
    archiveConfirm: string;
    personLocked: string;
  };
}

export function ResourceRowActions({
  resourceId,
  kind,
  currentStatus,
  currentWorkshopId,
  workshops,
  labels,
}: Props) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState(currentStatus);
  const [workshopId, setWorkshopId] = useState<string>(currentWorkshopId ?? '');

  function update(values: {
    status?: 'active' | 'inactive' | 'maintenance';
    workshopId?: string | null;
  }) {
    setError(null);
    start(async () => {
      const result = await updateResourceAction({ id: resourceId, values });
      if (!result.ok) setError(result.message);
    });
  }

  function archive() {
    if (!window.confirm(labels.archiveConfirm)) return;
    setError(null);
    start(async () => {
      const result = await archiveResourceAction({ id: resourceId });
      if (!result.ok) setError(result.message);
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <select
        value={status}
        disabled={pending}
        onChange={(e) => {
          const next = e.target.value as typeof status;
          setStatus(next);
          update({ status: next });
        }}
        className="rounded-md border bg-background px-2 py-1 text-xs"
      >
        <option value="active">{labels.statusActive}</option>
        <option value="inactive">{labels.statusInactive}</option>
        <option value="maintenance">{labels.statusMaintenance}</option>
      </select>

      {kind === 'person' ? (
        <span className="text-xs text-muted-foreground">
          {labels.personLocked}
        </span>
      ) : (
        <select
          value={workshopId}
          disabled={pending}
          onChange={(e) => {
            const next = e.target.value;
            setWorkshopId(next);
            update({ workshopId: next === '' ? null : next });
          }}
          className="rounded-md border bg-background px-2 py-1 text-xs"
        >
          <option value="">{labels.sharedAcrossOrg}</option>
          {workshops.map((w) => (
            <option key={w.id} value={w.id}>
              {w.name}
            </option>
          ))}
        </select>
      )}

      <button
        type="button"
        disabled={pending}
        onClick={archive}
        className="rounded-md border border-red-300 px-2 py-1 text-xs text-red-700 disabled:opacity-50"
      >
        {labels.archive}
      </button>

      {error ? (
        <span className="text-xs text-red-600" role="alert">
          {error}
        </span>
      ) : null}
    </div>
  );
}
