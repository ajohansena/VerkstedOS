import Link from 'next/link';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { isSupabaseConfigured } from '@/lib/supabase/server';
import { listAllUsers } from '@/modules/platform/public';

export const dynamic = 'force-dynamic';

/**
 * /dev/users — cross-org user list (Sprint 20 — Platform Maturity).
 * Drill in via /dev/users/[id]. Limit 500 most recent.
 */
export default async function DevUsersPage() {
  const configured = isSupabaseConfigured();
  const rows = configured ? await listAllUsers() : [];

  const platformCount = rows.filter((r) => r.isPlatformUser).length;

  return (
    <main className="mx-auto max-w-4xl space-y-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Users (platform)</h1>
        <Link href="/dev" className="text-sm underline">
          /dev
        </Link>
      </div>

      {!configured ? (
        <p className="text-sm text-muted-foreground">
          Supabase / database not configured.
        </p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">No users.</p>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {rows.length} users · {platformCount} platform users
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="divide-y rounded-md border text-sm">
              {rows.map((u) => (
                <li
                  key={u.userId}
                  className="flex items-center justify-between px-3 py-2"
                >
                  <div className="min-w-0">
                    <Link
                      href={`/dev/users/${u.userId}`}
                      className="font-medium hover:underline"
                    >
                      {u.fullName ?? u.email}
                    </Link>
                    <div className="text-xs text-muted-foreground">
                      {u.email}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    {u.isPlatformUser ? (
                      <span className="rounded bg-amber-100 px-2 py-0.5 text-amber-900">
                        platform
                      </span>
                    ) : null}
                    <span>{u.membershipCount} orgs</span>
                    <span>{u.status}</span>
                  </div>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </main>
  );
}
