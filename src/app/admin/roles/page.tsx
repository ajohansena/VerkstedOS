import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';

import { buttonVariants } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { getAuthorizedSession } from '@/lib/auth/authorize';
import { listRoles } from '@/modules/identity/public';
import { cn } from '@/lib/utils';

export const dynamic = 'force-dynamic';

/**
 * /admin/roles — roles and their permission counts (Admin surface). Requires
 * `admin:users`; hidden (404) otherwise.
 */
export default async function AdminRolesPage() {
  const auth = await getAuthorizedSession();
  if (!auth) {
    redirect('/login');
  }
  if (!(await auth.can('admin:users'))) {
    notFound();
  }

  const roles = await listRoles(auth.session.context);

  return (
    <main className="mx-auto max-w-3xl space-y-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Roles</h1>
        <Link
          href="/admin"
          className={cn(buttonVariants({ variant: 'outline', size: 'sm' }))}
        >
          Back
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Roles ({roles.length})</CardTitle>
          <CardDescription>
            Standard roles ship seeded; orgs may customize their bundles.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="divide-y rounded-md border">
            {roles.map((r) => (
              <li
                key={r.id}
                className="flex items-center justify-between px-3 py-2 text-sm"
              >
                <span className="font-medium">{r.name}</span>
                <span className="text-xs text-muted-foreground">
                  {r.permissionCount} permission(s)
                  {r.isSystem ? ' · system' : ''}
                </span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </main>
  );
}
