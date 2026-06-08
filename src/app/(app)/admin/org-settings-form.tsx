'use client';

import { useState, useTransition } from 'react';

import {
  createWorkshopAction,
  updateOrgSettingsAction,
} from './admin-actions';

interface Labels {
  organization: string;
  organizationName: string;
  organizationNumber: string;
  settingsLocale: string;
  settingsCaseFormat: string;
  save: string;
  saved: string;
  workshops: string;
  addWorkshop: string;
  workshopName: string;
}

/**
 * Admin → inline org-settings + workshop-create forms (Sprint 14 Track G).
 * Replaces the read-only admin card with real editing. `admin:config` is
 * enforced server-side.
 */
export function OrgSettingsForm({
  initialName,
  initialOrgNumber,
  initialLocale,
  initialCaseFormat,
  labels,
}: {
  initialName: string;
  initialOrgNumber: string;
  initialLocale: string;
  initialCaseFormat: string;
  labels: Labels;
}) {
  const [pending, startTransition] = useTransition();
  const [savedOrg, setSavedOrg] = useState(false);
  const [savedWs, setSavedWs] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function onSaveOrg(formData: FormData) {
    setError(null);
    setSavedOrg(false);
    startTransition(async () => {
      const res = await updateOrgSettingsAction(formData);
      if (res.ok) setSavedOrg(true);
      else setError(res.error);
    });
  }

  function onCreateWorkshop(formData: FormData) {
    setError(null);
    setSavedWs(false);
    startTransition(async () => {
      const res = await createWorkshopAction(formData);
      if (res.ok) setSavedWs(true);
      else setError(res.error);
    });
  }

  return (
    <div className="space-y-6">
      {error ? (
        <div
          role="alert"
          className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800"
        >
          {error}
        </div>
      ) : null}

      <form
        action={onSaveOrg}
        className="space-y-3 rounded-lg border bg-background p-4 shadow-sm"
      >
        <h2 className="text-sm font-semibold">{labels.organization}</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={labels.organizationName}>
            <input
              name="name"
              defaultValue={initialName}
              className="h-9 w-full rounded-md border bg-background px-2 text-sm"
            />
          </Field>
          <Field label={labels.organizationNumber}>
            <input
              name="orgNumber"
              defaultValue={initialOrgNumber}
              className="h-9 w-full rounded-md border bg-background px-2 text-sm"
            />
          </Field>
          <Field label={labels.settingsLocale}>
            <select
              name="locale"
              defaultValue={initialLocale}
              className="h-9 w-full rounded-md border bg-background px-2 text-sm"
            >
              <option value="nb-NO">nb-NO</option>
              <option value="en">en</option>
            </select>
          </Field>
          <Field label={labels.settingsCaseFormat}>
            <input
              name="caseNumberFormat"
              defaultValue={initialCaseFormat}
              placeholder="{YYYY}-{SEQ}"
              className="h-9 w-full rounded-md border bg-background px-2 text-sm"
            />
          </Field>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={pending}
            className="inline-flex h-9 items-center rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {labels.save}
          </button>
          {savedOrg ? (
            <span className="text-xs text-emerald-600">{labels.saved}</span>
          ) : null}
        </div>
      </form>

      <form
        action={onCreateWorkshop}
        className="space-y-3 rounded-lg border bg-background p-4 shadow-sm"
      >
        <h2 className="text-sm font-semibold">{labels.addWorkshop}</h2>
        <div className="flex gap-2">
          <input
            name="name"
            placeholder={labels.workshopName}
            required
            className="h-9 flex-1 rounded-md border bg-background px-2 text-sm"
          />
          <button
            type="submit"
            disabled={pending}
            className="inline-flex h-9 items-center rounded-md border px-3 text-sm font-medium hover:bg-muted/40 disabled:opacity-50"
          >
            {labels.addWorkshop}
          </button>
        </div>
        {savedWs ? (
          <span className="text-xs text-emerald-600">{labels.saved}</span>
        ) : null}
      </form>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block space-y-1">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}
