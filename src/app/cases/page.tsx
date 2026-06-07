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
import { Input } from '@/components/ui/input';
import { getSessionContext } from '@/lib/auth/session';
import { listRecentCases, searchCases } from '@/modules/case/public';
import { cn } from '@/lib/utils';

export const dynamic = 'force-dynamic';

/**
 * /cases — search + recent list (User surface). Search spans case number, claim
 * number, vehicle reg, and customer name.
 */
export default async function CasesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const session = await getSessionContext();
  if (!session) redirect('/login');

  const { q } = await searchParams;
  const cases = q?.trim()
    ? await searchCases(session.context, q)
    : await listRecentCases(session.context);

  return (
    <main className="mx-auto max-w-3xl space-y-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Cases</h1>
        <Link href="/cases/new" className={cn(buttonVariants({ size: 'sm' }))}>
          New case
        </Link>
      </div>

      <form className="flex gap-2">
        <Input
          name="q"
          defaultValue={q ?? ''}
          placeholder="Search case no., claim no., reg, customer"
        />
        <button
          className={cn(buttonVariants({ variant: 'outline' }))}
          type="submit"
        >
          Search
        </button>
      </form>

      <Card>
        <CardHeader>
          <CardTitle>{q ? `Results for "${q}"` : 'Recent cases'}</CardTitle>
          <CardDescription>{cases.length} case(s)</CardDescription>
        </CardHeader>
        <CardContent>
          {cases.length > 0 ? (
            <ul className="divide-y rounded-md border">
              {cases.map((c) => (
                <li key={c.id}>
                  <Link
                    href={`/cases/${c.id}`}
                    className="flex items-center justify-between px-3 py-2 text-sm hover:bg-muted/50"
                  >
                    <span className="font-medium">{c.caseNumber}</span>
                    <span className="text-xs text-muted-foreground">
                      {[c.registrationNumber, c.customerName]
                        .filter(Boolean)
                        .join(' · ')}{' '}
                      · {c.status}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">No cases found.</p>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
