import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Plus } from 'lucide-react';

import { getSessionContext } from '@/lib/auth/session';
import { getDictionary, resolveLocale } from '@/lib/i18n';
import { getCurrentOrganization } from '@/modules/identity/public';
import { listRecentCases, searchCases } from '@/modules/case/public';
import { NORMAL_REPAIR_DAYS } from '@/lib/operations/snapshot';

export const dynamic = 'force-dynamic';

const STATUS_STYLE: Record<string, string> = {
  intake: 'bg-slate-100 text-slate-700',
  estimating: 'bg-indigo-100 text-indigo-700',
  in_production: 'bg-blue-100 text-blue-700',
  quality_control: 'bg-purple-100 text-purple-700',
  ready: 'bg-emerald-100 text-emerald-700',
  delivered: 'bg-green-100 text-green-700',
  closed: 'bg-slate-100 text-slate-500',
  cancelled: 'bg-red-100 text-red-700',
};

/**
 * /cases — Linear-style case list (Sprint 14 Track G). Compact, scannable
 * rows: case number, status pill, vehicle, customer, opened date, and an
 * at-risk dot for long-open active cases. Search spans case/claim/reg/customer.
 */
export default async function CasesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const session = await getSessionContext();
  if (!session) redirect('/login');

  const organization = await getCurrentOrganization(session.context);
  const locale = resolveLocale(organization?.settings);
  const t = getDictionary(locale);

  const { q } = await searchParams;
  const rows = q?.trim()
    ? await searchCases(session.context, q)
    : await listRecentCases(session.context);

  const now = Date.now();

  return (
    <div className="mx-auto w-full max-w-5xl space-y-5 p-4 md:p-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {t.casesList.title}
          </h1>
          <p className="text-sm text-muted-foreground">
            {t.casesList.description}
          </p>
        </div>
        <Link
          href="/cases/new"
          className="inline-flex h-9 items-center gap-2 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" aria-hidden />
          {t.casesList.newCase}
        </Link>
      </header>

      <form className="flex gap-2">
        <input
          name="q"
          defaultValue={q ?? ''}
          placeholder={t.casesList.searchPlaceholder}
          className="h-9 flex-1 rounded-md border bg-background px-3 text-sm"
        />
        <button
          type="submit"
          className="inline-flex h-9 items-center rounded-md border px-3 text-sm font-medium hover:bg-muted/40"
        >
          {t.intake.search}
        </button>
      </form>

      <div className="overflow-hidden rounded-lg border bg-background shadow-sm">
        {rows.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-muted-foreground">
            {q ? t.casesList.noResults : t.casesList.empty}
          </p>
        ) : (
          <ul className="divide-y">
            {rows.map((c) => {
              const ageDays = Math.floor(
                (now - new Date(c.openedAt).getTime()) /
                  (24 * 60 * 60 * 1000),
              );
              const isActive =
                c.status !== 'delivered' &&
                c.status !== 'closed' &&
                c.status !== 'cancelled';
              const atRisk = isActive && ageDays >= NORMAL_REPAIR_DAYS;
              return (
                <li key={c.id}>
                  <Link
                    href={`/cases/${c.id}`}
                    className="flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-muted/30"
                  >
                    {atRisk ? (
                      <span
                        className="h-2 w-2 shrink-0 rounded-full bg-red-500"
                        title={`${ageDays} d`}
                        aria-hidden
                      />
                    ) : (
                      <span className="h-2 w-2 shrink-0" aria-hidden />
                    )}
                    <span className="w-28 shrink-0 font-medium tracking-tight">
                      {c.caseNumber}
                    </span>
                    <span
                      className={
                        'shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ' +
                        (STATUS_STYLE[c.status] ?? 'bg-slate-100 text-slate-700')
                      }
                    >
                      {c.status}
                    </span>
                    {c.registrationNumber ? (
                      <span className="shrink-0 font-mono text-[11px] uppercase tracking-wide text-muted-foreground">
                        {c.registrationNumber}
                      </span>
                    ) : null}
                    <span className="flex-1 truncate text-muted-foreground">
                      {c.customerName ?? ''}
                    </span>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {new Date(c.openedAt).toLocaleDateString()}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
