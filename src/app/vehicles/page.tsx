import Link from 'next/link';
import { redirect } from 'next/navigation';

import { buttonVariants } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { getSessionContext } from '@/lib/auth/session';
import { listRecentVehicles, searchVehicles } from '@/modules/customer/public';
import { cn } from '@/lib/utils';

export const dynamic = 'force-dynamic';

/**
 * /vehicles — search by reg/VIN + recent list (User surface).
 */
export default async function VehiclesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const session = await getSessionContext();
  if (!session) redirect('/login');

  const { q } = await searchParams;
  const vehicles = q?.trim()
    ? await searchVehicles(session.context, q)
    : await listRecentVehicles(session.context);

  return (
    <main className="mx-auto max-w-3xl space-y-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Vehicles</h1>
        <Link
          href="/vehicles/new"
          className={cn(buttonVariants({ size: 'sm' }))}
        >
          New vehicle
        </Link>
      </div>

      <form className="flex gap-2">
        <Input
          name="q"
          defaultValue={q ?? ''}
          placeholder="Search registration number or VIN"
        />
        <button
          className={cn(buttonVariants({ variant: 'outline' }))}
          type="submit"
        >
          Search
        </button>
      </form>

      <Card>
        <CardHeader>
          <CardTitle>{q ? `Results for "${q}"` : 'Recent vehicles'}</CardTitle>
          <CardDescription>{vehicles.length} vehicle(s)</CardDescription>
        </CardHeader>
        <CardContent>
          {vehicles.length > 0 ? (
            <ul className="divide-y rounded-md border">
              {vehicles.map((v) => (
                <li
                  key={v.id}
                  className="flex items-center justify-between px-3 py-2 text-sm"
                >
                  <span className="font-medium">
                    {v.registrationNumber ?? v.vin ?? 'unknown'}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {[v.make, v.model, v.year].filter(Boolean).join(' ')} ·{' '}
                    {v.ownershipType}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">No vehicles found.</p>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
