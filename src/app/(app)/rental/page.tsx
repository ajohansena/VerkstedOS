import { redirect } from 'next/navigation';

import { getSessionContext } from '@/lib/auth/session';
import { getDictionary, resolveLocale } from '@/lib/i18n';
import { getCurrentOrganization } from '@/modules/identity/public';
import {
  findAgreementByReservation,
  listActiveReservationsForOrg,
  listRentalVehicles,
} from '@/modules/rental/public';

import {
  createReservationAction,
  recordReturnAction,
  signAgreementAction,
} from './actions';

export const dynamic = 'force-dynamic';

/**
 * /rental — Reservations + agreements. Front-of-house creates reservations,
 * signs rental agreements (digital signature flow), and records returns.
 * Vehicle CRUD lives at /admin/rental (admin:config).
 */
export default async function RentalPage() {
  const session = await getSessionContext();
  if (!session) redirect('/login');

  const organization = await getCurrentOrganization(session.context);
  const locale = resolveLocale(organization?.settings);
  const t = getDictionary(locale);

  const [vehicles, reservations] = await Promise.all([
    listRentalVehicles(session.context),
    listActiveReservationsForOrg(session.context),
  ]);

  const agreementPairs = await Promise.all(
    reservations.map((r) =>
      findAgreementByReservation(session.context, r.id).then((a) => ({
        reservation: r,
        agreement: a,
      })),
    ),
  );

  const fmt = (d: Date): string =>
    new Intl.DateTimeFormat(locale === 'nb-NO' ? 'nb-NO' : 'en-GB', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    }).format(d);

  const statusLabel = (s: string): string => {
    switch (s) {
      case 'planned':
        return t.rental.reservationStatusPlanned;
      case 'active':
        return t.rental.reservationStatusActive;
      case 'completed':
        return t.rental.reservationStatusCompleted;
      case 'cancelled':
        return t.rental.reservationStatusCancelled;
      default:
        return s;
    }
  };

  return (
    <div className="mx-auto w-full max-w-[1300px] space-y-6 p-4 md:p-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">
          {t.rental.title}
        </h1>
        <p className="text-sm text-muted-foreground">{t.rental.description}</p>
      </header>

      <section className="rounded-lg border bg-background p-4">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          {t.rental.reservationsTitle}
        </h2>
        <form
          action={createReservationAction}
          className="mb-4 grid grid-cols-1 gap-3 md:grid-cols-6"
        >
          <label className="md:col-span-2">
            <span className="mb-1 block text-xs text-muted-foreground">
              {t.rental.reservationsVehicle}
            </span>
            <select
              name="rentalVehicleId"
              required
              className="w-full rounded-md border bg-background px-3 py-2 text-sm"
            >
              {vehicles.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.registrationNumber}
                  {v.make ? ` · ${v.make}` : ''}
                  {v.model ? ` ${v.model}` : ''}
                </option>
              ))}
            </select>
          </label>
          <label className="md:col-span-1">
            <span className="mb-1 block text-xs text-muted-foreground">
              {t.rental.reservationsStart}
            </span>
            <input
              type="datetime-local"
              name="startsAt"
              required
              className="w-full rounded-md border bg-background px-3 py-2 text-sm"
            />
          </label>
          <label className="md:col-span-1">
            <span className="mb-1 block text-xs text-muted-foreground">
              {t.rental.reservationsEnd}
            </span>
            <input
              type="datetime-local"
              name="endsAt"
              required
              className="w-full rounded-md border bg-background px-3 py-2 text-sm"
            />
          </label>
          <label className="md:col-span-1">
            <span className="mb-1 block text-xs text-muted-foreground">
              {t.rental.reservationsCase}
            </span>
            <input
              type="text"
              name="caseId"
              placeholder="UUID"
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

        {reservations.length === 0 ? (
          <div className="rounded-md border-dashed p-6 text-sm text-muted-foreground">
            {t.rental.reservationsEmpty}
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-medium">
                  {t.rental.reservationsVehicle}
                </th>
                <th className="px-3 py-2 font-medium">
                  {t.rental.reservationsStart}
                </th>
                <th className="px-3 py-2 font-medium">
                  {t.rental.reservationsEnd}
                </th>
                <th className="px-3 py-2 font-medium">
                  {t.rental.reservationsStatus}
                </th>
                <th className="px-3 py-2 text-right"></th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {agreementPairs.map(({ reservation, agreement }) => {
                const veh = vehicles.find(
                  (v) => v.id === reservation.rentalVehicleId,
                );
                return (
                  <tr key={reservation.id}>
                    <td className="px-3 py-2 font-mono text-xs">
                      {veh?.registrationNumber ?? '—'}
                    </td>
                    <td className="px-3 py-2 font-mono text-xs">
                      {fmt(reservation.startsAt)}
                    </td>
                    <td className="px-3 py-2 font-mono text-xs">
                      {fmt(reservation.endsAt)}
                    </td>
                    <td className="px-3 py-2">
                      {statusLabel(reservation.status)}
                      {agreement?.status === 'signed' ? (
                        <span className="ml-2 rounded bg-emerald-100 px-1.5 py-0.5 text-xs text-emerald-800">
                          {t.rental.actionSign} ✓
                        </span>
                      ) : null}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex flex-col items-end gap-1">
                        {!agreement || agreement.status === 'draft' ? (
                          <form
                            action={signAgreementAction}
                            className="flex items-center gap-1"
                          >
                            <input
                              type="hidden"
                              name="reservationId"
                              value={reservation.id}
                            />
                            <input
                              type="text"
                              name="signedByName"
                              required
                              placeholder={t.rental.signSignerName}
                              className="w-32 rounded-md border bg-background px-2 py-1 text-xs"
                            />
                            <button
                              type="submit"
                              className="rounded-md border border-foreground bg-foreground px-2 py-1 text-xs font-medium text-background hover:opacity-90"
                            >
                              {t.rental.signSubmit}
                            </button>
                          </form>
                        ) : null}
                        {agreement?.status === 'signed' ? (
                          <form
                            action={recordReturnAction}
                            className="flex items-center gap-1"
                          >
                            <input
                              type="hidden"
                              name="agreementId"
                              value={agreement.id}
                            />
                            <input
                              type="number"
                              name="odometerKm"
                              placeholder="km"
                              className="w-20 rounded-md border bg-background px-2 py-1 text-xs"
                            />
                            <input
                              type="number"
                              name="fuelLevelPercent"
                              placeholder="%"
                              max={100}
                              min={0}
                              className="w-16 rounded-md border bg-background px-2 py-1 text-xs"
                            />
                            <button
                              type="submit"
                              className="rounded-md border px-2 py-1 text-xs hover:bg-muted/50"
                            >
                              {t.rental.returnSubmit}
                            </button>
                          </form>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
