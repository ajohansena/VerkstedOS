'use client';

import { useRef } from 'react';

import { switchOrganization } from '@/app/actions/switch-organization';

interface OrgOption {
  id: string;
  name: string;
}

/**
 * Org switcher (User surface). A multi-org user picks the active organization;
 * submitting sets the org cookie server-side and reloads scoped data. Single-org
 * users see a static label instead of a control.
 */
export function OrgSwitcher({
  organizations,
  currentOrgId,
}: {
  organizations: OrgOption[];
  currentOrgId: string;
}) {
  const formRef = useRef<HTMLFormElement>(null);

  if (organizations.length <= 1) {
    const only = organizations[0];
    return (
      <span className="text-sm font-medium">{only ? only.name : '—'}</span>
    );
  }

  return (
    <form action={switchOrganization} ref={formRef}>
      <label htmlFor="organizationId" className="sr-only">
        Organization
      </label>
      <select
        id="organizationId"
        name="organizationId"
        defaultValue={currentOrgId}
        onChange={() => formRef.current?.requestSubmit()}
        className="h-9 rounded-md border border-input bg-background px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
      >
        {organizations.map((org) => (
          <option key={org.id} value={org.id}>
            {org.name}
          </option>
        ))}
      </select>
    </form>
  );
}
