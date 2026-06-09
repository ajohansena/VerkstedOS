import Link from 'next/link';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { isSupabaseConfigured } from '@/lib/supabase/server';
import {
  listAllOrganizations,
  listPlatformAgreements,
  listPlatformRentalVehicles,
  listPlatformReservations,
  listPlatformReturns,
} from '@/modules/platform/public';

export const dynamic = 'force-dynamic';

/**
 * /dev/rental — Cross-org rental fleet, reservations, agreements + returns
 * (Sprint 18). Read-only platform inspector. Behind the hardened /dev guard.
 */
export default async function DevRentalPage() {
  const configured = isSupabaseConfigured();
  const [orgs, vehicles, reservations, agreements, returns] = configured
    ? await Promise.all([
        listAllOrganizations(),
        listPlatformRentalVehicles(),
        listPlatformReservations(),
        listPlatformAgreements(),
        listPlatformReturns(),
      ])
    : [[], [], [], [], []];

  const orgName = (id: string): string =>
    orgs.find((o) => o.organization.id === id)?.organization.name ?? id;

  return (
    <main className="mx-auto max-w-6xl space-y-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Rental (platform)</h1>
        <Link href="/dev/health" className="text-sm underline">
          /dev/health
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Fleet</CardTitle>
          <CardDescription>
            Vehicles across all organizations ({vehicles.length}).
          </CardDescription>
        </CardHeader>
        <CardContent>
          {vehicles.length === 0 ? (
            <p className="text-sm text-muted-foreground">No vehicles.</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-muted-foreground">
                <tr>
                  <th className="py-2 pr-3 font-medium">Org</th>
                  <th className="py-2 pr-3 font-medium">Reg. no.</th>
                  <th className="py-2 pr-3 font-medium">Make</th>
                  <th className="py-2 pr-3 font-medium">Model</th>
                  <th className="py-2 pr-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {vehicles.map((v) => (
                  <tr key={v.id}>
                    <td className="py-2 pr-3 text-xs">{orgName(v.organizationId)}</td>
                    <td className="py-2 pr-3 font-mono text-xs">{v.registrationNumber}</td>
                    <td className="py-2 pr-3">{v.make ?? '—'}</td>
                    <td className="py-2 pr-3">{v.model ?? '—'}</td>
                    <td className="py-2 pr-3">{v.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Reservations</CardTitle>
          <CardDescription>
            Recent reservations across all organizations ({reservations.length}).
          </CardDescription>
        </CardHeader>
        <CardContent>
          {reservations.length === 0 ? (
            <p className="text-sm text-muted-foreground">No reservations.</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-muted-foreground">
                <tr>
                  <th className="py-2 pr-3 font-medium">Org</th>
                  <th className="py-2 pr-3 font-medium">Vehicle id</th>
                  <th className="py-2 pr-3 font-medium">Window</th>
                  <th className="py-2 pr-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {reservations.map((r) => (
                  <tr key={r.id}>
                    <td className="py-2 pr-3 text-xs">{orgName(r.organizationId)}</td>
                    <td className="py-2 pr-3 font-mono text-xs">{r.rentalVehicleId}</td>
                    <td className="py-2 pr-3 font-mono text-xs">
                      {r.startsAt.toISOString().slice(0, 16)} →{' '}
                      {r.endsAt.toISOString().slice(0, 16)}
                    </td>
                    <td className="py-2 pr-3">{r.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Agreements + signatures</CardTitle>
          <CardDescription>
            Cross-org signed rental agreements. signatureId points at the Sprint 12
            digital_signatures chain when wired.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {agreements.length === 0 ? (
            <p className="text-sm text-muted-foreground">No agreements.</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-muted-foreground">
                <tr>
                  <th className="py-2 pr-3 font-medium">Org</th>
                  <th className="py-2 pr-3 font-medium">Reservation</th>
                  <th className="py-2 pr-3 font-medium">Status</th>
                  <th className="py-2 pr-3 font-medium">Signed by</th>
                  <th className="py-2 pr-3 font-medium">Signed at</th>
                  <th className="py-2 pr-3 font-medium">Signature id</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {agreements.map((a) => (
                  <tr key={a.id}>
                    <td className="py-2 pr-3 text-xs">{orgName(a.organizationId)}</td>
                    <td className="py-2 pr-3 font-mono text-xs">{a.reservationId}</td>
                    <td className="py-2 pr-3">{a.status}</td>
                    <td className="py-2 pr-3">{a.signedByName ?? '—'}</td>
                    <td className="py-2 pr-3 font-mono text-xs">
                      {a.signedAt ? a.signedAt.toISOString().slice(0, 16) : '—'}
                    </td>
                    <td className="py-2 pr-3 font-mono text-xs">
                      {a.signatureId ?? '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Returns</CardTitle>
          <CardDescription>
            Recorded vehicle returns ({returns.length}).
          </CardDescription>
        </CardHeader>
        <CardContent>
          {returns.length === 0 ? (
            <p className="text-sm text-muted-foreground">No returns.</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-muted-foreground">
                <tr>
                  <th className="py-2 pr-3 font-medium">Org</th>
                  <th className="py-2 pr-3 font-medium">Agreement</th>
                  <th className="py-2 pr-3 font-medium">Returned at</th>
                  <th className="py-2 pr-3 font-medium">Odo (km)</th>
                  <th className="py-2 pr-3 font-medium">Fuel (%)</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {returns.map((r) => (
                  <tr key={r.id}>
                    <td className="py-2 pr-3 text-xs">{orgName(r.organizationId)}</td>
                    <td className="py-2 pr-3 font-mono text-xs">{r.agreementId}</td>
                    <td className="py-2 pr-3 font-mono text-xs">
                      {r.returnedAt.toISOString().slice(0, 16)}
                    </td>
                    <td className="py-2 pr-3 font-mono text-xs">{r.odometerKm ?? '—'}</td>
                    <td className="py-2 pr-3 font-mono text-xs">{r.fuelLevelPercent ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
