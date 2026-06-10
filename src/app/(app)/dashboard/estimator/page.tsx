import Link from 'next/link';
import { redirect } from 'next/navigation';

import { getSessionContext } from '@/lib/auth/session';
import { getEstimatorDashboard } from '@/lib/dashboards/composers';
import { getDictionary, resolveLocale } from '@/lib/i18n';
import { getCurrentOrganization } from '@/modules/identity/public';

export const dynamic = 'force-dynamic';

/**
 * /dashboard/estimator — Estimator dashboard (docs/11 §Estimator, Sprint 17).
 * Three queues: arrivals today, awaiting insurer (open supplements), awaiting
 * customer (draft funding source). Cards link straight to the case workspace.
 */
export default async function EstimatorDashboardPage() {
  const session = await getSessionContext();
  if (!session) redirect('/login');

  const organization = await getCurrentOrganization(session.context);
  const locale = resolveLocale(organization?.settings);
  const t = getDictionary(locale);
  const dash = await getEstimatorDashboard(session.context);

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6 p-4 md:p-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">
          {t.estimator.title}
        </h1>
        <p className="text-sm text-muted-foreground">
          {t.estimator.description}
        </p>
      </header>

      <div className="grid gap-4 lg:grid-cols-3">
        <Queue
          title={t.estimator.arrivalsToday}
          empty={t.estimator.noArrivals}
          openLabel={t.estimator.openCase}
          rows={dash.arrivalsToday}
        />
        <Queue
          title={t.estimator.awaitingInsurance}
          empty={t.estimator.noAwaiting}
          openLabel={t.estimator.openCase}
          rows={dash.awaitingInsurer}
        />
        <Queue
          title={t.estimator.awaitingCustomer}
          empty={t.estimator.noAwaiting}
          openLabel={t.estimator.openCase}
          rows={dash.awaitingCustomer}
        />
      </div>
    </div>
  );
}

function Queue({
  title,
  empty,
  openLabel,
  rows,
}: {
  title: string;
  empty: string;
  openLabel: string;
  rows: {
    caseId: string;
    caseNumber: string;
    registrationNumber: string | null;
    vehicleLabel: string | null;
    customerName: string | null;
  }[];
}) {
  return (
    <section className="rounded-lg border bg-background">
      <header className="flex items-center justify-between border-b px-3 py-2">
        <h2 className="text-sm font-semibold">{title}</h2>
        <span className="text-xs text-muted-foreground">{rows.length}</span>
      </header>
      {rows.length === 0 ? (
        <p className="p-3 text-sm text-muted-foreground">{empty}</p>
      ) : (
        <ul className="divide-y">
          {rows.map((r) => (
            <li
              key={r.caseId}
              className="flex items-start justify-between gap-2 p-3"
            >
              <div className="min-w-0 flex-1">
                <div className="font-medium">
                  {r.caseNumber}
                  {r.registrationNumber ? (
                    <span className="ml-2 text-xs text-muted-foreground">
                      {r.registrationNumber}
                    </span>
                  ) : null}
                </div>
                <div className="truncate text-xs text-muted-foreground">
                  {[r.vehicleLabel, r.customerName].filter(Boolean).join(' · ')}
                </div>
              </div>
              <Link
                href={`/cases/${r.caseId}`}
                className="shrink-0 rounded-md border bg-background px-2 py-1 text-xs hover:bg-muted/50"
              >
                {openLabel}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
