import { redirect } from 'next/navigation';

import { getSessionContext } from '@/lib/auth/session';
import { getDictionary, resolveLocale } from '@/lib/i18n';
import { getCurrentOrganization } from '@/modules/identity/public';
import { listRentalVehicles } from '@/modules/rental/public';

import { registerVehicleAction } from '../../rental/actions';

export const dynamic = 'force-dynamic';

/** /admin/rental — Fleet management (Sprint 18). admin:config required. */
export default async function AdminRentalPage() {
  const session = await getSessionContext();
  if (!session) redirect('/login');

  const organization = await getCurrentOrganization(session.context);
  const locale = resolveLocale(organization?.settings);
  const t = getDictionary(locale);

  const vehicles = await listRentalVehicles(session.context);

  const statusLabel = (s: string): string => {
    switch (s) {
      case 'available':
        return t.rental.statusAvailable;
      case 'in_service':
        return t.rental.statusInService;
      case 'maintenance':
        return t.rental.statusMaintenance;
      case 'decommissioned':
        return t.rental.statusDecommissioned;
      default:
        return s;
    }
  };

  return (
    <div className="mx-auto w-full max-w-[1100px] space-y-6 p-4 md:p-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">
          {t.rental.fleetTitle}
        </h1>
        <p className="text-sm text-muted-foreground">{t.rental.description}</p>
      </header>

      <section className="rounded-lg border bg-background p-4">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          {t.rental.fleetNew}
        </h2>
        <form
          action={registerVehicleAction}
          className="grid grid-cols-1 gap-3 md:grid-cols-6"
        >
          <label className="md:col-span-1">
            <span className="mb-1 block text-xs text-muted-foreground">
              {t.rental.fleetRegNo}
            </span>
            <input
              type="text"
              name="registrationNumber"
              required
              className="w-full rounded-md border bg-background px-3 py-2 text-sm"
            />
          </label>
          <label className="md:col-span-2">
            <span className="mb-1 block text-xs text-muted-foreground">
              {t.rental.fleetMake}
            </span>
            <input
              type="text"
              name="make"
              className="w-full rounded-md border bg-background px-3 py-2 text-sm"
            />
          </label>
          <label className="md:col-span-2">
            <span className="mb-1 block text-xs text-muted-foreground">
              {t.rental.fleetModel}
            </span>
            <input
              type="text"
              name="model"
              className="w-full rounded-md border bg-background px-3 py-2 text-sm"
            />
          </label>
          <label className="md:col-span-1">
            <span className="mb-1 block text-xs text-muted-foreground">
              {t.rental.fleetDailyRate}
            </span>
            <input
              type="number"
              name="dailyRate"
              step="0.01"
              min={0}
              defaultValue={0}
              className="w-full rounded-md border bg-background px-3 py-2 text-sm"
            />
          </label>
          <button
            type="submit"
            className="md:col-span-1 rounded-md border border-foreground bg-foreground px-3 py-2 text-sm font-medium text-background hover:opacity-90"
          >
            {t.rental.fleetSubmit}
          </button>
        </form>
      </section>

      <section className="rounded-lg border bg-background">
        <header className="border-b px-4 py-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            {t.rental.fleetTitle}
          </h2>
        </header>
        {vehicles.length === 0 ? (
          <div className="p-6 text-sm text-muted-foreground">
            {t.rental.fleetEmpty}
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-muted-foreground">
              <tr>
                <th className="px-4 py-2 font-medium">
                  {t.rental.fleetRegNo}
                </th>
                <th className="px-4 py-2 font-medium">{t.rental.fleetMake}</th>
                <th className="px-4 py-2 font-medium">{t.rental.fleetModel}</th>
                <th className="px-4 py-2 font-medium">
                  {t.rental.fleetDailyRate}
                </th>
                <th className="px-4 py-2 font-medium">
                  {t.rental.fleetStatus}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {vehicles.map((v) => (
                <tr key={v.id}>
                  <td className="px-4 py-2 font-mono text-xs">
                    {v.registrationNumber}
                  </td>
                  <td className="px-4 py-2">{v.make ?? '—'}</td>
                  <td className="px-4 py-2">{v.model ?? '—'}</td>
                  <td className="px-4 py-2 font-mono text-xs">
                    {v.dailyRate} {v.currency}
                  </td>
                  <td className="px-4 py-2">{statusLabel(v.status)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
