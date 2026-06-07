import Link from 'next/link';
import { redirect } from 'next/navigation';

import { buttonVariants } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { getSessionContext } from '@/lib/auth/session';
import {
  getCurrentOrganization,
  listWorkshops,
} from '@/modules/identity/public';
import { cn } from '@/lib/utils';

export const dynamic = 'force-dynamic';

/**
 * Admin shell (Admin surface) — minimal in Sprint 2: the active organization
 * and its workshops. User/role management arrives with RBAC in Sprint 3.
 */
export default async function AdminPage() {
  const session = await getSessionContext();
  if (!session) {
    redirect('/login');
  }

  const [organization, workshops] = await Promise.all([
    getCurrentOrganization(session.context),
    listWorkshops(session.context),
  ]);

  return (
    <main className="mx-auto max-w-3xl space-y-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Administration</h1>
        <Link
          href="/"
          className={cn(buttonVariants({ variant: 'outline', size: 'sm' }))}
        >
          Back
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{organization?.name ?? 'Organization'}</CardTitle>
          <CardDescription>
            {organization?.orgNumber
              ? `Org. no. ${organization.orgNumber}`
              : 'Active organization'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <h2 className="mb-2 text-sm font-medium">
            Workshops ({workshops.length})
          </h2>
          {workshops.length > 0 ? (
            <ul className="divide-y rounded-md border">
              {workshops.map((w) => (
                <li
                  key={w.id}
                  className="flex items-center justify-between px-3 py-2 text-sm"
                >
                  <span>{w.name}</span>
                  <span className="text-xs uppercase text-muted-foreground">
                    {w.status}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">No workshops yet.</p>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
