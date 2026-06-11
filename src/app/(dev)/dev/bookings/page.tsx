import Link from 'next/link';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { isSupabaseConfigured } from '@/lib/supabase/server';
import {
  listAllOrganizations,
  listBookingsForOrg,
} from '@/modules/platform/public';
import { repairStuckBookingAction } from './actions';

export const dynamic = 'force-dynamic';

/**
 * /dev/bookings — cross-org case-booking inspector + repair (Dev surface, D2).
 *
 * Pick an org, see recent bookings; force-cancel any that are stuck in
 * tentative/confirmed/arrived. Mirrors the shape of /dev/transfers. Behind the
 * hardened /dev guard (404 to non-platform).
 */
export default async function DevBookingsPage({
  searchParams,
}: {
  searchParams: Promise<{ org?: string }>;
}) {
  const configured = isSupabaseConfigured();
  const { org } = await searchParams;
  const orgs = configured ? await listAllOrganizations() : [];
  const bookings = configured && org ? await listBookingsForOrg(org) : [];

  return (
    <main className="mx-auto max-w-3xl space-y-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Bookings</h1>
        <Link href="/dev/health" className="text-sm underline">
          /dev/health
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Select organization</CardTitle>
          <CardDescription>
            Booking history per org + force-cancel stuck (tentative / confirmed
            / arrived).
          </CardDescription>
        </CardHeader>
        <CardContent>
          {orgs.length === 0 ? (
            <p className="text-sm text-muted-foreground">No organizations.</p>
          ) : (
            <ul className="divide-y rounded-md border">
              {orgs.map(({ organization }) => (
                <li
                  key={organization.id}
                  className="flex items-center justify-between px-3 py-2 text-sm"
                >
                  <span className="font-medium">{organization.name}</span>
                  <Link
                    href={`/dev/bookings?org=${organization.id}`}
                    className="text-xs underline"
                  >
                    Inspect
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {org ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Bookings ({bookings.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {bookings.length === 0 ? (
              <p className="text-sm text-muted-foreground">None.</p>
            ) : (
              <ul className="divide-y rounded-md border">
                {bookings.map((b) => {
                  const stuck =
                    b.status === 'tentative' ||
                    b.status === 'confirmed' ||
                    b.status === 'arrived';
                  return (
                    <li
                      key={b.id}
                      className="flex items-center justify-between gap-2 px-3 py-2 text-sm"
                    >
                      <div className="min-w-0 flex-1 truncate">
                        <span className="font-mono text-xs text-muted-foreground">
                          {b.caseId.slice(0, 8)}
                        </span>{' '}
                        · <span className="font-medium">{b.status}</span> ·{' '}
                        <span className="text-xs text-muted-foreground">
                          arr {b.expectedArrivalAt?.toISOString() ?? '—'} → del{' '}
                          {b.promisedDeliveryAt?.toISOString() ?? '—'}
                        </span>
                      </div>
                      {stuck ? (
                        <form
                          action={repairStuckBookingAction}
                          className="flex items-center gap-2"
                        >
                          <input
                            type="hidden"
                            name="organizationId"
                            value={org}
                          />
                          <input type="hidden" name="bookingId" value={b.id} />
                          <Input
                            name="reason"
                            placeholder="reason"
                            className="h-7 w-32 text-xs"
                          />
                          <Button type="submit" size="sm" variant="outline">
                            Force-cancel
                          </Button>
                        </form>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>
      ) : null}
    </main>
  );
}
