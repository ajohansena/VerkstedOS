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
import {
  listRecentCustomers,
  searchCustomers,
} from '@/modules/customer/public';
import { cn } from '@/lib/utils';

export const dynamic = 'force-dynamic';

/**
 * /customers — search + recent list (User surface). Estimators find customers
 * by name, phone, email, or identifier.
 */
export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const session = await getSessionContext();
  if (!session) redirect('/login');

  const { q } = await searchParams;
  const customers = q?.trim()
    ? await searchCustomers(session.context, q)
    : await listRecentCustomers(session.context);

  return (
    <main className="mx-auto max-w-3xl space-y-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Customers</h1>
        <Link
          href="/customers/new"
          className={cn(buttonVariants({ size: 'sm' }))}
        >
          New customer
        </Link>
      </div>

      <form className="flex gap-2">
        <Input
          name="q"
          defaultValue={q ?? ''}
          placeholder="Search name, phone, email, org/personal no."
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
          <CardTitle>{q ? `Results for "${q}"` : 'Recent customers'}</CardTitle>
          <CardDescription>{customers.length} customer(s)</CardDescription>
        </CardHeader>
        <CardContent>
          {customers.length > 0 ? (
            <ul className="divide-y rounded-md border">
              {customers.map((c) => (
                <li
                  key={c.id}
                  className="flex items-center justify-between px-3 py-2 text-sm"
                >
                  <span className="font-medium">{c.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {c.kind} {c.primaryPhone ? `· ${c.primaryPhone}` : ''}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">No customers found.</p>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
