import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Plus } from 'lucide-react';

import { getSessionContext } from '@/lib/auth/session';
import { formatDate, getDictionary, resolveLocale } from '@/lib/i18n';
import { getCurrentOrganization } from '@/modules/identity/public';
import { listVehiclesWithCaseStats } from '@/modules/customer/public';

export const dynamic = 'force-dynamic';

/**
 * /vehicles — rich vehicle list (Sprint 14 Track G). Each row carries the
 * operationally useful facts: plate, vehicle, owner-type, last visit, and the
 * count of currently-active cases. Search by reg/VIN.
 */
export default async function VehiclesPage({
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
  const rows = await listVehiclesWithCaseStats(session.context, q);

  return (
    <div className="mx-auto w-full max-w-5xl space-y-5 p-4 md:p-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {t.vehicles.title}
          </h1>
          <p className="text-sm text-muted-foreground">
            {t.vehicles.description}
          </p>
        </div>
        <Link
          href="/vehicles/new"
          className="inline-flex h-9 items-center gap-2 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" aria-hidden />
          {t.vehicles.addVehicle}
        </Link>
      </header>

      <form className="flex gap-2">
        <input
          name="q"
          defaultValue={q ?? ''}
          placeholder={t.vehicles.searchPlaceholder}
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
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <th className="px-4 py-2 font-medium">{t.vehicles.columnReg}</th>
              <th className="px-4 py-2 font-medium">
                {t.vehicles.columnVehicle}
              </th>
              <th className="px-4 py-2 font-medium">
                {t.vehicles.columnOwner}
              </th>
              <th className="px-4 py-2 font-medium">
                {t.vehicles.columnLastVisit}
              </th>
              <th className="px-4 py-2 text-right font-medium">
                {t.vehicles.columnActiveCases}
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td
                  colSpan={5}
                  className="px-4 py-8 text-center text-muted-foreground"
                >
                  {q ? t.vehicles.noResults : t.vehicles.noVehicles}
                </td>
              </tr>
            ) : (
              rows.map(({ vehicle, activeCaseCount, lastVisitAt }) => (
                <tr
                  key={vehicle.id}
                  className="border-b last:border-0 hover:bg-muted/30"
                >
                  <td className="px-4 py-2.5">
                    <span className="font-mono text-xs font-medium uppercase tracking-wide">
                      {vehicle.registrationNumber ?? vehicle.vin ?? '—'}
                    </span>
                  </td>
                  <td className="px-4 py-2.5">
                    {[vehicle.make, vehicle.model, vehicle.year]
                      .filter(Boolean)
                      .join(' ') || '—'}
                  </td>
                  <td className="px-4 py-2.5 text-muted-foreground">
                    {vehicle.ownershipType}
                  </td>
                  <td className="px-4 py-2.5 text-muted-foreground">
                    {lastVisitAt ? formatDate(lastVisitAt, locale) : '—'}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    {activeCaseCount > 0 ? (
                      <span className="inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">
                        {activeCaseCount}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">0</span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
