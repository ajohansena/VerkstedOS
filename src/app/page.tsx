import Link from 'next/link';

import { OrgSwitcher } from '@/components/org-switcher';
import { buttonVariants } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { getSessionContext } from '@/lib/auth/session';
import { isSupabaseConfigured } from '@/lib/supabase/server';
import { listWorkshops } from '@/modules/identity/public';
import { cn } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const configured = isSupabaseConfigured();
  const session = configured ? await getSessionContext() : null;
  const workshops = session ? await listWorkshops(session.context) : [];

  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/30 p-6">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <CardTitle className="text-2xl">VerkstedOS</CardTitle>
          <CardDescription>
            Operating system for collision-repair workshops.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          {session ? (
            <>
              <div className="flex items-center justify-between gap-3">
                <p className="text-base">
                  Hello,{' '}
                  <span className="font-medium">{session.user.email}</span>.
                </p>
                <OrgSwitcher
                  organizations={session.availableOrganizations}
                  currentOrgId={session.context.organizationId}
                />
              </div>
              <div>
                <p className="mb-2 font-medium">Workshops</p>
                {workshops.length > 0 ? (
                  <ul className="space-y-1">
                    {workshops.map((w) => (
                      <li
                        key={w.id}
                        className="rounded-md border px-3 py-2 text-muted-foreground"
                      >
                        {w.name}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-muted-foreground">
                    No workshops in this organization yet.
                  </p>
                )}
              </div>
            </>
          ) : configured ? (
            <p className="text-muted-foreground">
              You are not signed in, or your account has no organization
              membership.
            </p>
          ) : (
            <p className="text-muted-foreground">
              Sprint 2 skeleton. Supabase auth is not configured yet — set the
              environment variables to enable sign-in and tenant resolution.
            </p>
          )}
        </CardContent>
        <CardFooter className="flex-wrap gap-2">
          {session ? (
            <>
              <Link href="/cases" className={cn(buttonVariants())}>
                Cases
              </Link>
              <Link
                href="/production"
                className={cn(buttonVariants({ variant: 'outline' }))}
              >
                Production
              </Link>
              <Link
                href="/customers"
                className={cn(buttonVariants({ variant: 'outline' }))}
              >
                Customers
              </Link>
              <Link
                href="/vehicles"
                className={cn(buttonVariants({ variant: 'outline' }))}
              >
                Vehicles
              </Link>
              <Link
                href="/admin"
                className={cn(buttonVariants({ variant: 'outline' }))}
              >
                Admin
              </Link>
            </>
          ) : (
            <Link href="/login" className={cn(buttonVariants())}>
              Sign in
            </Link>
          )}
        </CardFooter>
      </Card>
    </main>
  );
}
