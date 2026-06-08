import Link from 'next/link';
import { redirect } from 'next/navigation';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { getSessionContext } from '@/lib/auth/session';
import { listOpenRequirements } from '@/modules/parts/public';

export const dynamic = 'force-dynamic';

/**
 * /parts — the purchasing coordinator's queue (User surface, Sprint 11). Open
 * part requirements across all cases that still need sourcing or are awaiting
 * delivery. Ordering/receiving happen from the case parts panel and dedicated
 * flows; this is the cross-case "what needs my attention" list.
 */
export default async function PartsCoordinatorPage() {
  const session = await getSessionContext();
  if (!session) redirect('/login');

  const open = await listOpenRequirements(session.context);

  return (
    <main className="mx-auto max-w-3xl space-y-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Parts queue</h1>
        <Link href="/" className="text-sm underline">
          Home
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Open requirements ({open.length})
          </CardTitle>
          <CardDescription>
            Parts needing sourcing, on order, or awaiting delivery — across all
            cases.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {open.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nothing open. All parts are sourced.
            </p>
          ) : (
            <ul className="divide-y rounded-md border">
              {open.map(({ requirement, caseNumber }) => (
                <li
                  key={requirement.id}
                  className="flex items-center justify-between gap-2 px-3 py-2 text-sm"
                >
                  <div>
                    <span className="font-medium">
                      {requirement.description}
                    </span>
                    {requirement.partNumber ? (
                      <span className="ml-2 text-xs text-muted-foreground">
                        {requirement.partNumber}
                      </span>
                    ) : null}
                  </div>
                  <span className="flex items-center gap-2 text-xs text-muted-foreground">
                    {requirement.status}
                    <Link
                      href={`/cases/${requirement.caseId}`}
                      className="underline"
                    >
                      {caseNumber}
                    </Link>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
