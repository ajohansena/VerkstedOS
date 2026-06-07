import Link from 'next/link';
import { notFound } from 'next/navigation';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { inspectOrganization, type OrgHealth } from '@/modules/platform/public';

export const dynamic = 'force-dynamic';

const HEALTH_LABEL: Record<OrgHealth, string> = {
  green: '🟢 healthy',
  yellow: '🟡 attention',
  red: '🔴 suspended',
};

/**
 * /dev/orgs/[id] — read-only org inspection with a health badge (Dev surface).
 * Access enforced by the (dev) layout guard.
 */
export default async function DevOrgInspectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const org = await inspectOrganization(id);
  if (!org) {
    notFound();
  }

  return (
    <main className="mx-auto max-w-3xl space-y-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">{org.organization.name}</h1>
        <Link href="/dev/orgs" className="text-sm underline">
          /dev/orgs
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>{org.organization.name}</span>
            <span className="text-sm font-normal">
              {HEALTH_LABEL[org.health]}
            </span>
          </CardTitle>
          <CardDescription>
            {org.organization.id} · {org.organization.status} ·{' '}
            {org.memberCount} member(s)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <h2 className="mb-2 text-sm font-medium">
            Workshops ({org.workshops.length})
          </h2>
          {org.workshops.length > 0 ? (
            <ul className="divide-y rounded-md border text-sm">
              {org.workshops.map((w) => (
                <li
                  key={w.id}
                  className="flex items-center justify-between px-3 py-2"
                >
                  <span>{w.name}</span>
                  <span className="text-xs uppercase text-muted-foreground">
                    {w.status}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">No workshops.</p>
          )}

          <div className="mt-4 flex gap-3 text-sm">
            <Link
              href={`/dev/audit?org=${org.organization.id}`}
              className="underline"
            >
              Audit log
            </Link>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
