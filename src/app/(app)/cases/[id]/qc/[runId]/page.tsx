import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';

import { Button, buttonVariants } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  listChecklistRuns,
  listResponses,
  listTemplateItems,
} from '@/modules/quality/public';
import { respondItemAction, signOffRunAction } from '@/app/actions/quality';
import { getSessionContext } from '@/lib/auth/session';
import { getDictionary } from '@/lib/i18n';
import { cn } from '@/lib/utils';

export const dynamic = 'force-dynamic';

/**
 * /cases/[id]/qc/[runId] — perform a checklist (User surface). Each item gets a
 * pass/fail/na answer + optional comment; failures require a comment when the
 * template item demands it (enforced in the service). Sign-off derives the
 * pass/fail status. Norwegian UI.
 */
export default async function ChecklistRunPage({
  params,
}: {
  params: Promise<{ id: string; runId: string }>;
}) {
  const session = await getSessionContext();
  if (!session) redirect('/login');

  const { id, runId } = await params;
  const runs = await listChecklistRuns(session.context, id);
  const run = runs.find((r) => r.id === runId);
  if (!run) notFound();

  const t = getDictionary();
  const [items, responses] = await Promise.all([
    listTemplateItems(session.context, run.templateId),
    listResponses(session.context, runId),
  ]);
  const byItem = new Map(responses.map((r) => [r.templateItemId, r]));
  const locked = run.status !== 'in_progress';

  return (
    <main className="mx-auto max-w-2xl space-y-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">{t.quality.title}</h1>
        <Link
          href={`/cases/${id}`}
          className={cn(buttonVariants({ variant: 'outline', size: 'sm' }))}
        >
          {t.common.back}
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t.quality.runs}</CardTitle>
          <CardDescription>
            {locked
              ? run.status === 'passed'
                ? t.quality.statusPassed
                : t.quality.statusFailed
              : t.quality.statusInProgress}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <ul className="space-y-3">
            {items.map((item) => {
              const response = byItem.get(item.id);
              return (
                <li key={item.id} className="rounded-md border p-3">
                  <p className="mb-2 text-sm font-medium">{item.label}</p>
                  {locked ? (
                    <p className="text-xs text-muted-foreground">
                      {response
                        ? response.result === 'pass'
                          ? t.quality.pass
                          : response.result === 'fail'
                            ? `${t.quality.fail}${response.comment ? ` — ${response.comment}` : ''}`
                            : t.quality.na
                        : '—'}
                    </p>
                  ) : (
                    <form
                      action={respondItemAction}
                      className="flex flex-wrap items-center gap-2"
                    >
                      <input type="hidden" name="caseId" value={id} />
                      <input type="hidden" name="runId" value={runId} />
                      <input
                        type="hidden"
                        name="templateItemId"
                        value={item.id}
                      />
                      <select
                        name="result"
                        defaultValue={response?.result ?? 'pass'}
                        className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                      >
                        <option value="pass">{t.quality.pass}</option>
                        <option value="fail">{t.quality.fail}</option>
                        <option value="na">{t.quality.na}</option>
                      </select>
                      <input
                        name="comment"
                        defaultValue={response?.comment ?? ''}
                        placeholder={t.quality.comment}
                        className="h-9 flex-1 rounded-md border border-input bg-background px-3 text-sm"
                      />
                      <Button type="submit" size="sm" variant="outline">
                        {t.common.save}
                      </Button>
                    </form>
                  )}
                </li>
              );
            })}
          </ul>

          {!locked ? (
            <form action={signOffRunAction}>
              <input type="hidden" name="caseId" value={id} />
              <input type="hidden" name="runId" value={runId} />
              <Button type="submit">{t.quality.signOff}</Button>
            </form>
          ) : null}
        </CardContent>
      </Card>
    </main>
  );
}
