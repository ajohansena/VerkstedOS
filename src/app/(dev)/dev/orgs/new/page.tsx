import Link from 'next/link';

import ProvisionOrgWizard from './wizard';

export const dynamic = 'force-dynamic';

/**
 * `/dev/orgs/new` — guided organization-creation wizard (Sprint 20).
 * Composes existing identity primitives (ensureUser, createOrganizationWithOwner)
 * + Supabase Auth admin invite + a workshop insert. PlatformOwner only.
 */
export default function NewOrganizationPage() {
  return (
    <main className="mx-auto max-w-2xl space-y-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Create organization</h1>
        <Link href="/dev/orgs" className="text-sm underline">
          /dev/orgs
        </Link>
      </div>
      <ProvisionOrgWizard />
    </main>
  );
}
