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
import { getDictionary, format } from '@/lib/i18n';
import { cn } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const configured = isSupabaseConfigured();
  const session = configured ? await getSessionContext() : null;
  const workshops = session ? await listWorkshops(session.context) : [];
  const t = getDictionary();

  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/30 p-6">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <CardTitle className="text-2xl">{t.home.title}</CardTitle>
          <CardDescription>{t.home.subtitle}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          {session ? (
            <>
              <div className="flex items-center justify-between gap-3">
                <p className="text-base">
                  {format(t.home.hello, { email: session.user.email })}
                </p>
                <OrgSwitcher
                  organizations={session.availableOrganizations}
                  currentOrgId={session.context.organizationId}
                />
              </div>
              <div>
                <p className="mb-2 font-medium">{t.home.workshops}</p>
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
                  <p className="text-muted-foreground">{t.home.noWorkshops}</p>
                )}
              </div>
            </>
          ) : configured ? (
            <p className="text-muted-foreground">{t.home.notSignedIn}</p>
          ) : (
            <p className="text-muted-foreground">{t.home.notConfigured}</p>
          )}
        </CardContent>
        <CardFooter className="flex-wrap gap-2">
          {session ? (
            <>
              <Link href="/cases" className={cn(buttonVariants())}>
                {t.nav.cases}
              </Link>
              <Link
                href="/production"
                className={cn(buttonVariants({ variant: 'outline' }))}
              >
                {t.nav.production}
              </Link>
              <Link
                href="/clock"
                className={cn(buttonVariants({ variant: 'outline' }))}
              >
                {t.nav.clock}
              </Link>
              <Link
                href="/customers"
                className={cn(buttonVariants({ variant: 'outline' }))}
              >
                {t.nav.customers}
              </Link>
              <Link
                href="/vehicles"
                className={cn(buttonVariants({ variant: 'outline' }))}
              >
                {t.nav.vehicles}
              </Link>
              <Link
                href="/admin"
                className={cn(buttonVariants({ variant: 'outline' }))}
              >
                {t.nav.admin}
              </Link>
            </>
          ) : (
            <Link href="/login" className={cn(buttonVariants())}>
              {t.common.signIn}
            </Link>
          )}
        </CardFooter>
      </Card>
    </main>
  );
}
