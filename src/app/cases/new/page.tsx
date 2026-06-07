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
import { createCaseAction } from '@/app/actions/case';
import { getSessionContext } from '@/lib/auth/session';
import { listRecentCustomers } from '@/modules/customer/public';
import { cn } from '@/lib/utils';

export const dynamic = 'force-dynamic';

/**
 * /cases/new — intake form (User surface). Creates a case and, optionally, a
 * first funding source. Additional funding sources are added on the case detail
 * page. The service validates the multi-funding rules.
 */
export default async function NewCasePage() {
  const session = await getSessionContext();
  if (!session) redirect('/login');

  const customers = await listRecentCustomers(session.context, 50);

  return (
    <main className="mx-auto max-w-xl space-y-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">New case</h1>
        <Link
          href="/cases"
          className={cn(buttonVariants({ variant: 'outline', size: 'sm' }))}
        >
          Back
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Case intake</CardTitle>
          <CardDescription>
            A case number is assigned automatically (per-org format).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={createCaseAction} className="space-y-4">
            <div className="space-y-2">
              <label
                htmlFor="primaryCustomerId"
                className="text-sm font-medium"
              >
                Primary customer
              </label>
              <select
                id="primaryCustomerId"
                name="primaryCustomerId"
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="">— none —</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <label htmlFor="incidentTag" className="text-sm font-medium">
                Incident
              </label>
              <Input
                id="incidentTag"
                name="incidentTag"
                placeholder="e.g. Parking lot collision"
              />
            </div>

            <fieldset className="space-y-3 rounded-md border p-3">
              <legend className="px-1 text-sm font-medium">
                First funding source (optional)
              </legend>
              <select
                name="fundingKind"
                defaultValue=""
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="">— add later —</option>
                <option value="insurance">Insurance</option>
                <option value="private_pay">Private pay</option>
                <option value="warranty">Warranty</option>
                <option value="goodwill">Goodwill</option>
                <option value="internal_rework">Internal rework</option>
              </select>
              <Input
                name="fundingLabel"
                placeholder="Label (e.g. Front – Fremtind)"
              />
              <select
                name="payerCustomerId"
                defaultValue=""
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="">Payer customer (private pay)</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              <p className="text-xs text-muted-foreground">
                Insurance funding requires an insurer — add it on the case page
                where the insurer can be selected.
              </p>
            </fieldset>

            <Button type="submit" className="w-full">
              Create case
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
