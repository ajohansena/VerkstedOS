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
import { createEmployeeAction } from '@/app/actions/workforce';
import { getAuthorizedSession } from '@/lib/auth/authorize';
import { listEmployees } from '@/modules/workforce/public';
import { cn } from '@/lib/utils';

export const dynamic = 'force-dynamic';

/**
 * /admin/employees — employee management (Admin surface, Sprint 9). Requires
 * admin:config. Create employees (separate from users) with comma-separated
 * skill codes (combined-role technicians supported).
 */
export default async function AdminEmployeesPage() {
  const auth = await getAuthorizedSession();
  if (!auth) redirect('/login');
  if (!(await auth.can('admin:config'))) notFound();

  const employees = await listEmployees(auth.session.context);

  return (
    <main className="mx-auto max-w-3xl space-y-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Employees</h1>
        <Link
          href="/admin"
          className={cn(buttonVariants({ variant: 'outline', size: 'sm' }))}
        >
          Back
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>New employee</CardTitle>
          <CardDescription>
            Not every employee logs in. Add skills as comma-separated codes
            (e.g. body, paint, assembly). A planning Resource is created
            automatically — uncheck the box for HR-only roles.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={createEmployeeAction} className="space-y-3">
            <Input name="fullName" placeholder="Full name" required />
            <Input name="skills" placeholder="Skills (body, paint, ...)" />
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                name="excludeFromPlanning"
                className="h-4 w-4"
              />
              <span>Exclude from production planning (no Resource)</span>
            </label>
            <Button type="submit">Create employee</Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Employees ({employees.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {employees.length > 0 ? (
            <ul className="divide-y rounded-md border">
              {employees.map((e) => (
                <li
                  key={e.id}
                  className="flex items-center justify-between px-3 py-2 text-sm"
                >
                  <span>{e.fullName}</span>
                  <span className="text-xs uppercase text-muted-foreground">
                    {e.status}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">No employees yet.</p>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
