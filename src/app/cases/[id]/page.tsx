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
import { Input } from '@/components/ui/input';
import { addFundingAction } from '@/app/actions/case';
import { ensureOrderAction, transitionAction } from '@/app/actions/production';
import { getSessionContext } from '@/lib/auth/session';
import {
  findCaseById,
  listCaseParties,
  listFundingSources,
} from '@/modules/case/public';
import {
  listAvailableTransitions,
  listStateHistory,
} from '@/modules/production/public';
import { cn } from '@/lib/utils';

export const dynamic = 'force-dynamic';

/**
 * /cases/[id] — case detail skeleton (User surface). Shows the case header,
 * funding sources (the distinctive multi-funding view), parties, and an
 * add-funding control. The full timeline lands in later sprints.
 */
export default async function CaseDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getSessionContext();
  if (!session) redirect('/login');

  const { id } = await params;
  const case_ = await findCaseById(session.context, id);
  if (!case_) notFound();

  const [funding, parties] = await Promise.all([
    listFundingSources(session.context, id),
    listCaseParties(session.context, id),
  ]);

  const [transitions, history] = await Promise.all([
    listAvailableTransitions(session.context, id),
    listStateHistory(session.context, id),
  ]);
  const hasProductionOrder = history.length > 0;

  return (
    <main className="mx-auto max-w-3xl space-y-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">{case_.caseNumber}</h1>
        <div className="flex gap-2">
          <Link
            href={`/cases/${case_.id}/estimate`}
            className={cn(buttonVariants({ size: 'sm' }))}
          >
            Estimate
          </Link>
          <Link
            href="/cases"
            className={cn(buttonVariants({ variant: 'outline', size: 'sm' }))}
          >
            Back
          </Link>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Case</CardTitle>
          <CardDescription>
            {case_.status}
            {case_.incidentTag ? ` · ${case_.incidentTag}` : ''}
          </CardDescription>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Production</CardTitle>
          <CardDescription>
            Status is a projection of the transition log ({history.length}{' '}
            transition(s)).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {!hasProductionOrder ? (
            <form action={ensureOrderAction}>
              <input type="hidden" name="caseId" value={case_.id} />
              <Button type="submit" size="sm">
                Start production
              </Button>
            </form>
          ) : transitions.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {transitions.map((t) => (
                <form key={t.id} action={transitionAction}>
                  <input type="hidden" name="caseId" value={case_.id} />
                  <input type="hidden" name="toStateCode" value={t.code} />
                  <Button type="submit" size="sm" variant="outline">
                    → {t.label}
                  </Button>
                </form>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              No further transitions from the current state.
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Funding sources ({funding.length})
          </CardTitle>
          <CardDescription>
            Multiple payers can fund one repair visit.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {funding.length > 0 ? (
            <ul className="divide-y rounded-md border">
              {funding.map((f) => (
                <li
                  key={f.id}
                  className="flex items-center justify-between px-3 py-2 text-sm"
                >
                  <span className="font-medium">{f.label}</span>
                  <span className="text-xs text-muted-foreground">
                    {f.kind} · {f.status}
                    {f.deductibleAmount
                      ? ` · deductible ${f.deductibleAmount} ${f.currency}`
                      : ''}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">
              No funding sources yet.
            </p>
          )}

          <form
            action={addFundingAction}
            className="space-y-2 rounded-md border p-3"
          >
            <input type="hidden" name="caseId" value={case_.id} />
            <p className="text-sm font-medium">Add funding source</p>
            <select
              name="kind"
              defaultValue="private_pay"
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="private_pay">Private pay</option>
              <option value="insurance">Insurance</option>
              <option value="warranty">Warranty</option>
              <option value="goodwill">Goodwill</option>
              <option value="internal_rework">Internal rework</option>
            </select>
            <Input name="label" placeholder="Label" />
            <Button type="submit" size="sm">
              Add
            </Button>
            <p className="text-xs text-muted-foreground">
              Per-kind requirements are validated on save (e.g. insurance needs
              an insurer).
            </p>
          </form>
        </CardContent>
      </Card>

      {parties.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Parties</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="divide-y rounded-md border">
              {parties.map((p) => (
                <li
                  key={p.id}
                  className="flex items-center justify-between px-3 py-2 text-sm"
                >
                  <span>{p.name ?? 'Party'}</span>
                  <span className="text-xs text-muted-foreground">
                    {p.role}
                  </span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}
    </main>
  );
}
