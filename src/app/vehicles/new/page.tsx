import Link from 'next/link';
import { redirect } from 'next/navigation';

import { Button, buttonVariants } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { createVehicleAction } from '@/app/actions/customer';
import { getSessionContext } from '@/lib/auth/session';
import { cn } from '@/lib/utils';

export const dynamic = 'force-dynamic';

/**
 * /vehicles/new — create form (User surface). The reg-plate field will auto-fill
 * make/model/year/VIN from Vegvesen once an API key is provisioned (the adapter
 * + cache are already wired; it returns "not configured" until then).
 */
export default async function NewVehiclePage() {
  const session = await getSessionContext();
  if (!session) redirect('/login');

  return (
    <main className="mx-auto max-w-xl space-y-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">New vehicle</h1>
        <Link
          href="/vehicles"
          className={cn(buttonVariants({ variant: 'outline', size: 'sm' }))}
        >
          Back
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Vehicle details</CardTitle>
          <CardDescription>
            Enter the registration plate; remaining fields auto-fill from
            Vegvesen once provisioned.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={createVehicleAction} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <label
                  htmlFor="registrationNumber"
                  className="text-sm font-medium"
                >
                  Registration number
                </label>
                <Input id="registrationNumber" name="registrationNumber" />
              </div>
              <div className="space-y-2">
                <label htmlFor="vin" className="text-sm font-medium">
                  VIN
                </label>
                <Input id="vin" name="vin" />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-2">
                <label htmlFor="make" className="text-sm font-medium">
                  Make
                </label>
                <Input id="make" name="make" />
              </div>
              <div className="space-y-2">
                <label htmlFor="model" className="text-sm font-medium">
                  Model
                </label>
                <Input id="model" name="model" />
              </div>
              <div className="space-y-2">
                <label htmlFor="year" className="text-sm font-medium">
                  Year
                </label>
                <Input id="year" name="year" type="number" />
              </div>
            </div>
            <Button type="submit" className="w-full">
              Create vehicle
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
