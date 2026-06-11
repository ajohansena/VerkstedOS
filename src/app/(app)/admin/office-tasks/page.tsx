import { redirect } from 'next/navigation';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { getAuthorizedSession } from '@/lib/auth/authorize';
import { getDictionary, resolveLocale } from '@/lib/i18n';
import {
  getCurrentOrganization,
} from '@/modules/identity/public';
import { listOpenOfficeTasksForOrg } from '@/modules/workforce/public';

export const dynamic = 'force-dynamic';

/**
 * /admin/office-tasks — admin surface for D3 Phase B.
 *
 * Org-wide read of currently open office tasks. Mutations happen on the case
 * detail page and the planner; this surface is for oversight ("what's open
 * across the workshop?") and a future template editor.
 */
export default async function OfficeTasksAdminPage() {
  const auth = await getAuthorizedSession();
  if (!auth) redirect('/login');
  const canConfig = await auth.can('admin:config');
  if (!canConfig) redirect('/admin');

  const organization = await getCurrentOrganization(auth.session.context);
  const locale = resolveLocale(organization?.settings);
  const t = getDictionary(locale);
  const tasks = await listOpenOfficeTasksForOrg(auth.session.context, 200);

  const fmt = new Intl.DateTimeFormat(locale, {
    dateStyle: 'short',
    timeStyle: 'short',
  });
  const now = new Date();

  return (
    <main className="mx-auto w-full max-w-5xl space-y-6 p-4 md:p-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">
          {t.officeTask.title}
        </h1>
        <p className="text-sm text-muted-foreground">
          {t.officeTask.description}
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t.officeTask.title}</CardTitle>
          <CardDescription>
            {tasks.length === 0 ? t.officeTask.listEmpty : null}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {tasks.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-xs uppercase text-muted-foreground">
                  <tr className="border-b">
                    <th className="py-2 pr-4">{t.officeTask.columnTitle}</th>
                    <th className="py-2 pr-4">{t.officeTask.columnDueAt}</th>
                    <th className="py-2 pr-4">
                      {t.officeTask.columnPriority}
                    </th>
                    <th className="py-2 pr-4">{t.officeTask.columnStatus}</th>
                    <th className="py-2 pr-4">
                      {t.officeTask.columnAssignee}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {tasks.map((task) => {
                    const overdue =
                      task.dueAt !== null &&
                      task.dueAt < now &&
                      (task.status === 'open' ||
                        task.status === 'in_progress');
                    return (
                      <tr key={task.id} className="border-b align-top">
                        <td className="py-2 pr-4">
                          <div className="font-medium">{task.title}</div>
                          {task.description ? (
                            <div className="text-xs text-muted-foreground line-clamp-2">
                              {task.description}
                            </div>
                          ) : null}
                        </td>
                        <td className="py-2 pr-4">
                          {task.dueAt ? (
                            <span
                              className={
                                overdue
                                  ? 'font-medium text-red-600'
                                  : undefined
                              }
                            >
                              {fmt.format(task.dueAt)}
                              {overdue ? ` (${t.officeTask.overdueLabel})` : ''}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">
                              {t.officeTask.noDueAt}
                            </span>
                          )}
                        </td>
                        <td className="py-2 pr-4">{task.priority}</td>
                        <td className="py-2 pr-4">{task.status}</td>
                        <td className="py-2 pr-4 text-muted-foreground">
                          {task.assigneeUserId
                            ? task.assigneeUserId.slice(0, 8)
                            : task.assigneeResourceId
                              ? task.assigneeResourceId.slice(0, 8)
                              : '—'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </main>
  );
}
