import Link from 'next/link';

import { buttonVariants } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { createClient, isSupabaseConfigured } from '@/lib/supabase/server';
import { cn } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const configured = isSupabaseConfigured();
  let userEmail: string | null = null;

  if (configured) {
    const supabase = await createClient();
    const { data } = await supabase.auth.getUser();
    userEmail = data.user?.email ?? null;
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/30 p-6">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl">VerkstedOS</CardTitle>
          <CardDescription>
            Operating system for collision-repair workshops.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-sm">
          {userEmail ? (
            <p className="text-base">
              Hello, <span className="font-medium">{userEmail}</span>.
            </p>
          ) : configured ? (
            <p className="text-muted-foreground">You are not signed in.</p>
          ) : (
            <p className="text-muted-foreground">
              Sprint 1 skeleton. Supabase auth is not configured yet — set the
              environment variables to enable sign-in.
            </p>
          )}
        </CardContent>
        <CardFooter className="gap-2">
          {userEmail ? null : (
            <Link href="/login" className={cn(buttonVariants())}>
              Sign in
            </Link>
          )}
          <Link
            href="/dev/health"
            className={cn(buttonVariants({ variant: 'outline' }))}
          >
            Dev health
          </Link>
        </CardFooter>
      </Card>
    </main>
  );
}
