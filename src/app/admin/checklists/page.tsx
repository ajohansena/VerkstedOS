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
import { listChecklistTemplates } from '@/modules/quality/public';
import { seedDefaultChecklistsAction } from '@/app/actions/quality';
import { getAuthorizedSession } from '@/lib/auth/authorize';
import { getDictionary } from '@/lib/i18n';
import { cn } from '@/lib/utils';

export const dynamic = 'force-dynamic';

/**
 * /admin/checklists — QC checklist templates (Admin surface, Sprint 12).
 * Requires admin:config. Seed the default Norwegian templates (Leveringssjekk,
 * Kalibrering) and view existing ones. Per-workshop variants are supported by
 * the data model (workshop_id on the template).
 */
export default async function AdminChecklistsPage() {
  const auth = await getAuthorizedSession();
  if (!auth) redirect('/login');
  if (!(await auth.can('admin:config'))) notFound();

  const t = getDictionary();
  const templates = await listChecklistTemplates(auth.session.context);

  return (
    <main className="mx-auto max-w-2xl space-y-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">{t.quality.title}</h1>
        <Link
          href="/admin"
          className={cn(buttonVariants({ variant: 'outline', size: 'sm' }))}
        >
          {t.common.back}
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {t.quality.runs} ({templates.length})
          </CardTitle>
          <CardDescription>{t.quality.description}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {templates.length > 0 ? (
            <ul className="divide-y rounded-md border">
              {templates.map((tpl) => (
                <li
                  key={tpl.id}
                  className="flex items-center justify-between px-3 py-2 text-sm"
                >
                  <span className="font-medium">{tpl.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {tpl.kind} · {tpl.code}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">{t.quality.noRuns}</p>
          )}

          <form action={seedDefaultChecklistsAction}>
            <Button type="submit" size="sm" variant="outline">
              Seed Leveringssjekk + Kalibrering
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
