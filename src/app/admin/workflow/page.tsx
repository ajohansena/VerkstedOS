import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';

import { buttonVariants } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { getAuthorizedSession } from '@/lib/auth/authorize';
import { listWorkflowStates } from '@/modules/production/public';
import { cn } from '@/lib/utils';

export const dynamic = 'force-dynamic';

const CATEGORY_COLOR: Record<string, string> = {
  active: 'text-green-600',
  waiting: 'text-yellow-600',
  terminal: 'text-slate-500',
};

/**
 * /admin/workflow — workflow viewer (Admin surface, Sprint 8). Shows the active
 * workflow's states and their categories. Requires admin:config. The full
 * states/transitions/side-effects editor is a later iteration; the seeded
 * default + this viewer ship now.
 */
export default async function AdminWorkflowPage() {
  const auth = await getAuthorizedSession();
  if (!auth) redirect('/login');
  if (!(await auth.can('admin:config'))) notFound();

  const states = await listWorkflowStates(auth.session.context);

  return (
    <main className="mx-auto max-w-3xl space-y-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Workflow</h1>
        <Link
          href="/admin"
          className={cn(buttonVariants({ variant: 'outline', size: 'sm' }))}
        >
          Back
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>States ({states.length})</CardTitle>
          <CardDescription>
            Workflow is configurable data. States carry a category (active /
            waiting / terminal) that drives behavior — they are a projection
            layer, not the source of production truth.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {states.length > 0 ? (
            <ol className="divide-y rounded-md border">
              {states.map((s) => (
                <li
                  key={s.id}
                  className="flex items-center justify-between px-3 py-2 text-sm"
                >
                  <span>
                    {s.label}
                    {s.isInitial ? ' · initial' : ''}
                  </span>
                  <span
                    className={`text-xs ${CATEGORY_COLOR[s.category] ?? ''}`}
                  >
                    {s.category}
                  </span>
                </li>
              ))}
            </ol>
          ) : (
            <p className="text-sm text-muted-foreground">
              No workflow seeded yet.
            </p>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
