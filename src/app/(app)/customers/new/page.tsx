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
import { createCustomerAction } from '@/app/actions/customer';
import { getSessionContext } from '@/lib/auth/session';
import { cn } from '@/lib/utils';

export const dynamic = 'force-dynamic';

/**
 * /customers/new — kind-aware create form (User surface). The identifier label
 * adapts to the chosen kind (personnummer vs organisasjonsnummer); the service
 * layer validates the checksum.
 */
export default async function NewCustomerPage() {
  const session = await getSessionContext();
  if (!session) redirect('/login');

  return (
    <main className="mx-auto max-w-xl space-y-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">New customer</h1>
        <Link
          href="/customers"
          className={cn(buttonVariants({ variant: 'outline', size: 'sm' }))}
        >
          Back
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Customer details</CardTitle>
          <CardDescription>
            Choose the kind, then enter the identifier (validated on save).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={createCustomerAction} className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="kind" className="text-sm font-medium">
                Kind
              </label>
              <select
                id="kind"
                name="kind"
                defaultValue="individual"
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="individual">Individual</option>
                <option value="company">Company</option>
                <option value="leasing_company">Leasing company</option>
                <option value="fleet_operator">Fleet operator</option>
              </select>
            </div>
            <div className="space-y-2">
              <label htmlFor="name" className="text-sm font-medium">
                Name
              </label>
              <Input id="name" name="name" required />
            </div>
            <div className="space-y-2">
              <label htmlFor="identifier" className="text-sm font-medium">
                Personal / org. number
              </label>
              <Input id="identifier" name="identifier" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <label htmlFor="primaryPhone" className="text-sm font-medium">
                  Phone
                </label>
                <Input id="primaryPhone" name="primaryPhone" />
              </div>
              <div className="space-y-2">
                <label htmlFor="primaryEmail" className="text-sm font-medium">
                  Email
                </label>
                <Input id="primaryEmail" name="primaryEmail" type="email" />
              </div>
            </div>
            <Button type="submit" className="w-full">
              Create customer
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
