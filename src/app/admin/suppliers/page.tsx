import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';

import { Button, buttonVariants } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { createSupplierAction } from '@/app/actions/parts';
import { getAuthorizedSession } from '@/lib/auth/authorize';
import { listSuppliers } from '@/modules/parts/public';
import { cn } from '@/lib/utils';

export const dynamic = 'force-dynamic';

/**
 * /admin/suppliers — supplier management (Admin surface, Sprint 11). Requires
 * admin:config. Suppliers are the parts vendor master data; agreements (lead
 * time + discount) attach to them. Purchase orders reference a supplier.
 */
export default async function AdminSuppliersPage() {
  const auth = await getAuthorizedSession();
  if (!auth) redirect('/login');
  if (!(await auth.can('admin:config'))) notFound();

  const suppliers = await listSuppliers(auth.session.context);

  return (
    <main className="mx-auto max-w-3xl space-y-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Suppliers</h1>
        <Link
          href="/admin"
          className={cn(buttonVariants({ variant: 'outline', size: 'sm' }))}
        >
          Back
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>New supplier</CardTitle>
          <CardDescription>
            Parts vendor master data. Lead times and discounts attach via
            agreements.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={createSupplierAction} className="space-y-3">
            <Input name="name" placeholder="Supplier name" required />
            <Input name="orgNumber" placeholder="Org number (optional)" />
            <Input
              name="contactEmail"
              type="email"
              placeholder="Contact email (optional)"
            />
            <Button type="submit">Create supplier</Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Suppliers ({suppliers.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {suppliers.length === 0 ? (
            <p className="text-sm text-muted-foreground">No suppliers yet.</p>
          ) : (
            <ul className="divide-y rounded-md border">
              {suppliers.map((s) => (
                <li
                  key={s.id}
                  className="flex items-center justify-between px-3 py-2 text-sm"
                >
                  <span className="font-medium">{s.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {s.orgNumber ?? '—'} · {s.status}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
