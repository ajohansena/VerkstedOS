import Link from 'next/link';
import { notFound } from 'next/navigation';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { isSupabaseConfigured } from '@/lib/supabase/server';
import { inspectUser } from '@/modules/platform/public';

export const dynamic = 'force-dynamic';

/**
 * /dev/users/[id] — read-only platform inspection of a user: memberships, role
 * assignments, and effective permissions per org (Dev surface, Sprint 3
 * deliverable). Hardened `/dev` middleware arrives in Sprint 4.
 */
export default async function DevUserPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!isSupabaseConfigured()) {
    notFound();
  }

  const user = await inspectUser(id);
  if (!user) {
    notFound();
  }

  return (
    <main className="mx-auto max-w-3xl space-y-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">{user.email}</h1>
        <Link href="/dev/orgs" className="text-sm underline">
          /dev/orgs
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{user.fullName ?? user.email}</CardTitle>
          <CardDescription>
            {user.userId} · {user.status}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {user.memberships.length === 0 ? (
            <p className="text-sm text-muted-foreground">No memberships.</p>
          ) : (
            user.memberships.map((m) => (
              <div key={m.membershipId} className="rounded-md border p-3">
                <div className="flex items-center justify-between">
                  <span className="font-medium">{m.organizationName}</span>
                  <span className="text-xs text-muted-foreground">
                    {m.status} · {m.roleNames.join(', ') || 'no role'}
                  </span>
                </div>
                <div className="mt-2 flex flex-wrap gap-1">
                  {m.effectivePermissions.length > 0 ? (
                    m.effectivePermissions.map((code) => (
                      <span
                        key={code}
                        className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs text-muted-foreground"
                      >
                        {code}
                      </span>
                    ))
                  ) : (
                    <span className="text-xs text-muted-foreground">
                      no effective permissions
                    </span>
                  )}
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </main>
  );
}
