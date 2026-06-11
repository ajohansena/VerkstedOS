import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';

import { Button, buttonVariants } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { getAuthorizedSession } from '@/lib/auth/authorize';
import { cn } from '@/lib/utils';
import {
  listOrgMembers,
  listRoles,
  listWorkshops,
} from '@/modules/identity/public';

import { deactivateMemberAction, reactivateMemberAction } from './actions';
import InviteEmployeeForm from './invite-form';

export const dynamic = 'force-dynamic';

/**
 * /admin/users — customer Owner surface (Sprint 20). Lists org members with
 * roles + status, lets the Owner invite new employees, and lets them
 * deactivate / reactivate members. Requires `admin:users`.
 *
 * PlatformOwner is not involved. All mutations run with the Owner's session.
 */
export default async function AdminUsersPage() {
  const auth = await getAuthorizedSession();
  if (!auth) {
    redirect('/login');
  }
  if (!(await auth.can('admin:users'))) {
    notFound();
  }

  const [members, roles, workshops] = await Promise.all([
    listOrgMembers(auth.session.context),
    listRoles(auth.session.context),
    listWorkshops(auth.session.context),
  ]);

  const statusLabel: Record<'active' | 'invited' | 'suspended', string> = {
    active: 'Active',
    invited: 'Invited',
    suspended: 'Deactivated',
  };

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
          <CardTitle>Invite employee</CardTitle>
          <CardDescription>
            Send a magic-link invite. New users receive an email and set their
            own password. Assign their role and (optionally) a default workshop.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <InviteEmployeeForm
            roles={roles.map((r) => ({ id: r.id, name: r.name }))}
            workshops={workshops.map((w) => ({ id: w.id, name: w.name }))}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Members ({members.length})</CardTitle>
          <CardDescription>
            Users with a membership in this organization. Deactivating removes
            their access without deleting their history.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {members.length > 0 ? (
            <ul className="divide-y rounded-md border">
              {members.map((m) => (
                <li
                  key={m.membershipId}
                  className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">
                        {m.fullName ?? m.email}
                      </span>
                      <span
                        className={cn(
                          'rounded px-1.5 py-0.5 text-[10px] uppercase tracking-wide',
                          m.status === 'active'
                            ? 'bg-green-100 text-green-800'
                            : m.status === 'invited'
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-muted text-muted-foreground',
                        )}
                      >
                        {statusLabel[m.status]}
                      </span>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {m.email} ·{' '}
                      {m.roleNames.length > 0
                        ? m.roleNames.join(', ')
                        : 'no role'}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {m.status === 'suspended' ? (
                      <form action={reactivateMemberAction}>
                        <input
                          type="hidden"
                          name="membershipId"
                          value={m.membershipId}
                        />
                        <Button type="submit" variant="outline" size="sm">
                          Reactivate
                        </Button>
                      </form>
                    ) : (
                      <form action={deactivateMemberAction}>
                        <input
                          type="hidden"
                          name="membershipId"
                          value={m.membershipId}
                        />
                        <Button type="submit" variant="outline" size="sm">
                          Deactivate
                        </Button>
                      </form>
                    )}
                  </div>
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
