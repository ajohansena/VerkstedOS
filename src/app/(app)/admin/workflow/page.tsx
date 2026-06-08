import { notFound, redirect } from 'next/navigation';

import { getAuthorizedSession } from '@/lib/auth/authorize';
import { getDictionary, resolveLocale } from '@/lib/i18n';
import { getCurrentOrganization } from '@/modules/identity/public';
import { listWorkflowStates } from '@/modules/production/public';

import { WorkflowStatesEditor } from './workflow-states-editor';

export const dynamic = 'force-dynamic';

/**
 * /admin/workflow — workflow states editor (Sprint 14 Track G). States are
 * configurable data; their labels are inline-editable. Category (active /
 * waiting / terminal) drives behaviour and is shown but not edited here.
 * Requires `admin:config`.
 */
export default async function AdminWorkflowPage() {
  const auth = await getAuthorizedSession();
  if (!auth) redirect('/login');
  if (!(await auth.can('admin:config'))) notFound();

  const organization = await getCurrentOrganization(auth.session.context);
  const locale = resolveLocale(organization?.settings);
  const t = getDictionary(locale);

  const states = await listWorkflowStates(auth.session.context);

  return (
    <div className="mx-auto w-full max-w-3xl space-y-5 p-4 md:p-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">
          {t.admin.workflow}
        </h1>
        <p className="text-sm text-muted-foreground">
          {t.admin.workflowDescription}
        </p>
      </header>

      {states.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t.admin.workflowEmpty}</p>
      ) : (
        <WorkflowStatesEditor
          states={states.map((s) => ({
            id: s.id,
            label: s.label,
            category: s.category,
            sequenceNo: s.sequenceNo,
            isInitial: s.isInitial,
          }))}
          labels={{
            save: t.admin.save,
            saved: t.admin.saved,
            initial: t.admin.workflowInitial,
          }}
        />
      )}
    </div>
  );
}
