import { redirect } from 'next/navigation';

import { getAuthorizedSession } from '@/lib/auth/authorize';
import { getDictionary, resolveLocale } from '@/lib/i18n';
import { getCurrentOrganization } from '@/modules/identity/public';
import { listTaskTemplates } from '@/modules/workforce/public';

import { CreateTaskTemplateForm } from './create-task-template-form';
import { SeedDefaultsButton } from './seed-defaults-button';
import { TemplateRowActions } from './template-row-actions';

export const dynamic = 'force-dynamic';

/**
 * /admin/task-templates — D3 Phase F admin surface.
 *
 * Lists the event-driven task templates and exposes (a) "seed defaults"
 * one-shot, (b) inline create form, (c) per-row enable/disable toggle. The
 * Inngest cron `generate-office-tasks-from-events` consumes whatever is
 * active in `task_templates` and unfolds office tasks via the same
 * audited service path receptionists use.
 */
export default async function TaskTemplatesAdminPage() {
  const auth = await getAuthorizedSession();
  if (!auth) redirect('/login');
  const canConfig = await auth.can('admin:config');
  if (!canConfig) redirect('/admin');

  const organization = await getCurrentOrganization(auth.session.context);
  const locale = resolveLocale(organization?.settings);
  const t = getDictionary(locale);
  const templates = await listTaskTemplates(auth.session.context);

  return (
    <main className="mx-auto w-full max-w-5xl space-y-6 p-4 md:p-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">
          {t.taskTemplate.title}
        </h1>
        <p className="text-sm text-muted-foreground">
          {t.taskTemplate.description}
        </p>
      </header>

      <section className="space-y-3 rounded-lg border bg-background p-4">
        <h2 className="text-sm font-semibold">
          {t.taskTemplate.seedHeading}
        </h2>
        <p className="text-sm text-muted-foreground">
          {t.taskTemplate.seedHelp}
        </p>
        <SeedDefaultsButton labelSeed={t.taskTemplate.seedButton} />
      </section>

      <section className="space-y-3 rounded-lg border bg-background p-4">
        <h2 className="text-sm font-semibold">
          {t.taskTemplate.createHeading}
        </h2>
        <CreateTaskTemplateForm
          labels={{
            name: t.taskTemplate.fieldName,
            triggerEventType: t.taskTemplate.fieldTriggerEventType,
            triggerEventFilter: t.taskTemplate.fieldTriggerEventFilter,
            taskKind: t.taskTemplate.fieldTaskKind,
            taskTitleTemplate: t.taskTemplate.fieldTaskTitleTemplate,
            dueOffsetMinutes: t.taskTemplate.fieldDueOffsetMinutes,
            dueReference: t.taskTemplate.fieldDueReference,
            submit: t.taskTemplate.submit,
          }}
        />
      </section>

      <section className="space-y-3 rounded-lg border bg-background p-4">
        <h2 className="text-sm font-semibold">{t.taskTemplate.listHeading}</h2>
        {templates.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {t.taskTemplate.listEmpty}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase text-muted-foreground">
                <tr className="border-b">
                  <th className="py-2 pr-4">{t.taskTemplate.columnName}</th>
                  <th className="py-2 pr-4">{t.taskTemplate.columnTrigger}</th>
                  <th className="py-2 pr-4">{t.taskTemplate.columnKind}</th>
                  <th className="py-2 pr-4">
                    {t.taskTemplate.columnDueOffset}
                  </th>
                  <th className="py-2 pr-4">{t.taskTemplate.columnActive}</th>
                  <th className="py-2 pr-4" />
                </tr>
              </thead>
              <tbody>
                {templates.map((template) => (
                  <tr key={template.id} className="border-b align-top">
                    <td className="py-2 pr-4">
                      <div className="font-medium">{template.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {template.taskTitleTemplate}
                      </div>
                    </td>
                    <td className="py-2 pr-4 font-mono text-xs">
                      {template.triggerEventType}
                      {template.triggerEventFilter ? (
                        <div className="text-[10px]">
                          {JSON.stringify(template.triggerEventFilter)}
                        </div>
                      ) : null}
                    </td>
                    <td className="py-2 pr-4">{template.taskKind}</td>
                    <td className="py-2 pr-4 text-xs">
                      {template.dueOffsetMinutes} min ·{' '}
                      {template.dueReference}
                    </td>
                    <td className="py-2 pr-4">
                      {template.isActive
                        ? t.taskTemplate.activeYes
                        : t.taskTemplate.activeNo}
                    </td>
                    <td className="py-2 pr-4">
                      <TemplateRowActions
                        templateId={template.id}
                        isActive={template.isActive}
                        labelEnable={t.taskTemplate.actionEnable}
                        labelDisable={t.taskTemplate.actionDisable}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
