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
import {
  importEstimateAction,
  importEstimateFromPdfAction,
  lockEstimateAction,
} from '@/app/actions/estimate';
import { getSessionContext } from '@/lib/auth/session';
import { findCaseById } from '@/modules/case/public';
import {
  getTotals,
  listImportsForCase,
  listOperations,
  listParts,
  periodsToHours,
} from '@/modules/estimating/public';
import { cn } from '@/lib/utils';

export const dynamic = 'force-dynamic';

const SAMPLE = JSON.stringify(
  {
    oppdragsId: '26079539T2',
    skadenr: '79536781,675',
    document: {
      estimateNumber: 'EN64251',
      insurerName: 'Gjensidige, Øst',
      vehicleDescription: 'CITROEN E-C4',
      normalRepairDays: 12,
    },
    operations: [
      {
        description: 'H Forskjerm',
        action: 'Skift',
        side: 'H',
        timePeriods: 3260,
        laborRate: 955,
      },
    ],
    paintLines: [
      { description: 'Lakkarbeide', timePeriods: 1091, laborRate: 1175 },
    ],
    parts: [
      { partNumber: '9831194480', description: 'H Forskjerm', amount: 4083.66 },
    ],
    totals: {
      bodyLaborPeriods: 3260,
      paintLaborPeriods: 1091,
      totalAmount: 311841,
    },
  },
  null,
  2,
);

/**
 * /cases/[id]/estimate — DBS estimate import + view (User surface). Shows the
 * latest import's operations (with periods → hours), parts, and totals, and lets
 * an estimator import a normalized DBS payload and lock it. Labor time is shown
 * in hours via the SSoT `periodsToHours` (DBS periods: 100 = 1 hour).
 */
export default async function EstimatePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const session = await getSessionContext();
  if (!session) redirect('/login');

  const { id } = await params;
  const { error } = await searchParams;
  const case_ = await findCaseById(session.context, id);
  if (!case_) notFound();

  const imports = await listImportsForCase(session.context, id);
  const latest = imports[0];
  const [operations, parts, totals] = latest
    ? await Promise.all([
        listOperations(session.context, latest.id),
        listParts(session.context, latest.id),
        getTotals(session.context, latest.id),
      ])
    : [[], [], null];

  const totalLaborHours = operations.reduce(
    (sum, op) => sum + periodsToHours(op.timePeriods),
    0,
  );

  return (
    <main className="mx-auto max-w-3xl space-y-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">
          Estimate · {case_.caseNumber}
        </h1>
        <Link
          href={`/cases/${case_.id}`}
          className={cn(buttonVariants({ variant: 'outline', size: 'sm' }))}
        >
          Back to case
        </Link>
      </div>

      {error ? (
        <p className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      ) : null}

      {latest ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Version {latest.versionNumber} · {latest.kind}
            </CardTitle>
            <CardDescription>
              {latest.status}
              {latest.oppdragsId
                ? ` · Oppdrag ${latest.oppdragsId}`
                : ''} · {totalLaborHours.toFixed(2)} labor hours
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h2 className="mb-2 text-sm font-medium">
                Operations ({operations.length})
              </h2>
              <ul className="divide-y rounded-md border">
                {operations.map((op) => (
                  <li
                    key={op.id}
                    className="flex items-center justify-between px-3 py-2 text-sm"
                  >
                    <span>
                      {op.side ? `${op.side} ` : ''}
                      {op.description}
                      {op.action ? ` · ${op.action}` : ''}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {periodsToHours(op.timePeriods).toFixed(2)} h
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            {parts.length > 0 ? (
              <div>
                <h2 className="mb-2 text-sm font-medium">
                  Parts ({parts.length})
                </h2>
                <ul className="divide-y rounded-md border">
                  {parts.map((p) => (
                    <li
                      key={p.id}
                      className="flex items-center justify-between px-3 py-2 text-sm"
                    >
                      <span>
                        {p.partNumber ? `${p.partNumber} · ` : ''}
                        {p.description}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {p.amount ? `${p.amount} ${p.currency}` : ''}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {totals ? (
              <div className="rounded-md border px-3 py-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Total</span>
                  <span className="font-medium">
                    {totals.totalAmount ?? '—'} {totals.currency}
                  </span>
                </div>
              </div>
            ) : null}

            {latest.status !== 'locked' && latest.status !== 'superseded' ? (
              <form action={lockEstimateAction}>
                <input type="hidden" name="caseId" value={case_.id} />
                <input type="hidden" name="importId" value={latest.id} />
                <Button type="submit" size="sm">
                  Lock estimate
                </Button>
              </form>
            ) : (
              <p className="text-xs text-muted-foreground">
                Locked estimates are immutable. Corrections create a new
                version.
              </p>
            )}
          </CardContent>
        </Card>
      ) : (
        <p className="text-sm text-muted-foreground">
          No estimate imported yet.
        </p>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Last opp DBS-takstrapport</CardTitle>
          <CardDescription>
            Velg PDF-en fra DBS (f.eks. <code>EN64251.pdf</code>). Tall, parter
            og identifikatorer leses ut automatisk og kan importeres som en ny
            versjon. Rådata fra PDF-en lagres for revisjon og replay.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            action={importEstimateFromPdfAction}
            className="space-y-3"
            encType="multipart/form-data"
          >
            <input type="hidden" name="caseId" value={case_.id} />
            <input
              type="file"
              name="pdf"
              accept="application/pdf,.pdf"
              required
              className="block w-full text-sm file:mr-3 file:rounded-md file:border-0 file:bg-primary file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-primary-foreground hover:file:bg-primary/90"
            />
            <Button type="submit">Importer fra PDF</Button>
          </form>
        </CardContent>
      </Card>

      <details className="rounded-md border bg-card">
        <summary className="cursor-pointer select-none px-4 py-3 text-sm font-medium">
          Avansert: lim inn normalisert DBS JSON
        </summary>
        <div className="space-y-3 border-t px-4 py-3">
          <p className="text-xs text-muted-foreground">
            Brukes når takst kommer fra integrasjon (SOAP/REST) eller når
            PDF-uthenting feiler. Lim inn ferdig normalisert payload-JSON.
          </p>
          <form action={importEstimateAction} className="space-y-3">
            <input type="hidden" name="caseId" value={case_.id} />
            <textarea
              name="payload"
              rows={10}
              defaultValue={SAMPLE}
              className="w-full rounded-md border border-input bg-background p-3 font-mono text-xs"
            />
            <Button type="submit" variant="outline">
              Importer JSON
            </Button>
          </form>
        </div>
      </details>
    </main>
  );
}
