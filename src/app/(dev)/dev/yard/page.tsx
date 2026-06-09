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
  listPlatformVehicleMovements,
  listPlatformVehiclePlacements,
  listPlatformYardLayouts,
  listPlatformYardLocations,
} from '@/modules/platform/public';

export const dynamic = 'force-dynamic';

/**
 * `/dev/yard` — Cross-org yard layouts, locations, active placements, and
 * the append-only movement ledger (Sprint 19). Read-only platform inspector
 * behind the hardened /dev guard.
 */
export default async function DevYardPage() {
  const configured = isSupabaseConfigured();
  const [orgs, layouts, locations, placements, movements] = configured
    ? await Promise.all([
        listAllOrganizations(),
        listPlatformYardLayouts(),
        listPlatformYardLocations(),
        listPlatformVehiclePlacements(),
        listPlatformVehicleMovements(),
      ])
    : [[], [], [], [], []];

  const orgName = (id: string): string =>
    orgs.find((o) => o.organization.id === id)?.organization.name ?? id;

  return (
    <main className="mx-auto max-w-6xl space-y-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Yard (platform)</h1>
        <Link href="/dev/health" className="text-sm underline">
          /dev/health
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Layouts</CardTitle>
          <CardDescription>
            Yard layouts across all organizations ({layouts.length}).
          </CardDescription>
        </CardHeader>
        <CardContent>
          {layouts.length === 0 ? (
            <p className="text-sm text-muted-foreground">No layouts.</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-muted-foreground">
                <tr>
                  <th className="py-2 pr-3 font-medium">Org</th>
                  <th className="py-2 pr-3 font-medium">Code</th>
                  <th className="py-2 pr-3 font-medium">Name</th>
                  <th className="py-2 pr-3 font-medium">Workshop</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {layouts.map((l) => (
                  <tr key={l.id}>
                    <td className="py-2 pr-3 text-xs">
                      {orgName(l.organizationId)}
                    </td>
                    <td className="py-2 pr-3 font-mono text-xs">{l.code}</td>
                    <td className="py-2 pr-3">{l.name}</td>
                    <td className="py-2 pr-3 font-mono text-xs">
                      {l.workshopId}
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
          <CardTitle className="text-base">Locations</CardTitle>
          <CardDescription>
            Yard locations across all organizations ({locations.length}).
          </CardDescription>
        </CardHeader>
        <CardContent>
          {locations.length === 0 ? (
            <p className="text-sm text-muted-foreground">No locations.</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-muted-foreground">
                <tr>
                  <th className="py-2 pr-3 font-medium">Org</th>
                  <th className="py-2 pr-3 font-medium">Code</th>
                  <th className="py-2 pr-3 font-medium">Kind</th>
                  <th className="py-2 pr-3 font-medium">Cap.</th>
                  <th className="py-2 pr-3 font-medium">Status</th>
                  <th className="py-2 pr-3 font-medium">QR</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {locations.map((l) => (
                  <tr key={l.id}>
                    <td className="py-2 pr-3 text-xs">
                      {orgName(l.organizationId)}
                    </td>
                    <td className="py-2 pr-3 font-mono text-xs">{l.code}</td>
                    <td className="py-2 pr-3">{l.kind}</td>
                    <td className="py-2 pr-3">{l.capacity}</td>
                    <td className="py-2 pr-3">{l.status}</td>
                    <td className="py-2 pr-3 font-mono text-xs">
                      {l.qrTag ?? '—'}
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
          <CardTitle className="text-base">Active placements</CardTitle>
          <CardDescription>
            One row per case currently on the yard ({placements.length}).
          </CardDescription>
        </CardHeader>
        <CardContent>
          {placements.length === 0 ? (
            <p className="text-sm text-muted-foreground">No placements.</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-muted-foreground">
                <tr>
                  <th className="py-2 pr-3 font-medium">Org</th>
                  <th className="py-2 pr-3 font-medium">Case</th>
                  <th className="py-2 pr-3 font-medium">Location</th>
                  <th className="py-2 pr-3 font-medium">Placed</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {placements.map((p) => (
                  <tr key={p.id}>
                    <td className="py-2 pr-3 text-xs">
                      {orgName(p.organizationId)}
                    </td>
                    <td className="py-2 pr-3 font-mono text-xs">{p.caseId}</td>
                    <td className="py-2 pr-3 font-mono text-xs">
                      {p.locationId}
                    </td>
                    <td className="py-2 pr-3 text-xs">
                      {p.placedAt.toISOString()}
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
          <CardTitle className="text-base">Movement ledger</CardTitle>
          <CardDescription>
            Append-only history of vehicle movements ({movements.length}).
          </CardDescription>
        </CardHeader>
        <CardContent>
          {movements.length === 0 ? (
            <p className="text-sm text-muted-foreground">No movements.</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-muted-foreground">
                <tr>
                  <th className="py-2 pr-3 font-medium">When</th>
                  <th className="py-2 pr-3 font-medium">Org</th>
                  <th className="py-2 pr-3 font-medium">Case</th>
                  <th className="py-2 pr-3 font-medium">From</th>
                  <th className="py-2 pr-3 font-medium">To</th>
                  <th className="py-2 pr-3 font-medium">Reason</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {movements.map((m) => (
                  <tr key={m.id}>
                    <td className="py-2 pr-3 text-xs">
                      {m.movedAt.toISOString()}
                    </td>
                    <td className="py-2 pr-3 text-xs">
                      {orgName(m.organizationId)}
                    </td>
                    <td className="py-2 pr-3 font-mono text-xs">{m.caseId}</td>
                    <td className="py-2 pr-3 font-mono text-xs">
                      {m.fromLocationId ?? '—'}
                    </td>
                    <td className="py-2 pr-3 font-mono text-xs">
                      {m.toLocationId}
                    </td>
                    <td className="py-2 pr-3">{m.reason}</td>
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
