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
import { listOrgMembers } from '@/modules/identity/public';
import { cn } from '@/lib/utils';

export const dynamic = 'force-dynamic';

/**
 * /admin/users — org members and their roles (Admin surface). Requires
 * `admin:users`; users without it get a 404 (the surface is hidden, not
 * greyed-out).
 */
export default async function AdminUsersPage() {
  const auth = await getAuthorizedSession();
  if (!auth) {
    redirect('/login');
  }
  if (!(await auth.can('admin:users'))) {
    notFound();
  }

  const members = await listOrgMembers(auth.session.context);

  return (
    <main className="mx-auto max-w-3xl space-y-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Users</h1>
        <Link
          href="/admin"
          className={cn(buttonVariants({ variant: 'outline', size: 'sm' }))}
        >
          Back
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Members ({members.length})</CardTitle>
          <CardDescription>
            Users with a membership in this organization and their roles.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {members.length > 0 ? (
            <ul className="divide-y rounded-md border">
              {members.map((m) => (
                <li key={m.membershipId} className="px-3 py-2 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{m.fullName ?? m.email}</span>
                    <span className="text-xs text-muted-foreground">
                      {m.roleNames.length > 0
                        ? m.roleNames.join(', ')
                        : 'no role'}
                    </span>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {m.email}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">No members yet.</p>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
