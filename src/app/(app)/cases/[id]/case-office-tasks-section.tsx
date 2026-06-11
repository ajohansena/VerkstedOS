import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import type { OfficeTask } from '@/modules/workforce/public';

import { CaseOfficeTaskForm } from './case-office-task-form';
import { CaseOfficeTaskRowActions } from './case-office-task-row-actions';

/**
 * Office tasks for a single case (D3 Phase E).
 *
 * Server component. Renders a list of currently-open office tasks with inline
 * complete / cancel actions, plus an "Add office task" form below. All
 * mutations are gated by `case:edit` at the service layer.
 *
 * Office tasks NEVER count toward case cost (CLAUDE.md § 4.7 — TakstKontroll
 * compatibility). They're operational only.
 */
export function CaseOfficeTasksSection({
  caseId,
  tasks,
  labels,
}: {
  caseId: string;
  tasks: OfficeTask[];
  labels: {
    title: string;
    description: string;
    listEmpty: string;
    overdueLabel: string;
    noDueAt: string;
    addTitle: string;
    fieldTitle: string;
    fieldKind: string;
    fieldPriority: string;
    fieldDueAt: string;
    submitCreate: string;
    actionComplete: string;
    actionCancel: string;
    cancelReason: string;
    cancelReasonRequired: string;
    statusOpen: string;
    statusInProgress: string;
    priorityLow: string;
    priorityNormal: string;
    priorityHigh: string;
    priorityUrgent: string;
    kindOrderParts: string;
    kindCustomerCall: string;
    kindInsurerFollowup: string;
    kindRentalBooking: string;
    kindInvoicePrep: string;
    kindCustomerFollowup: string;
    kindDocumentation: string;
    kindOther: string;
  };
}) {
  const open = tasks.filter(
    (t) => t.status === 'open' || t.status === 'in_progress',
  );
  const now = Date.now();
  const fmt = new Intl.DateTimeFormat('nb-NO', {
    dateStyle: 'short',
    timeStyle: 'short',
  });

  const priorityLabel: Record<string, string> = {
    low: labels.priorityLow,
    normal: labels.priorityNormal,
    high: labels.priorityHigh,
    urgent: labels.priorityUrgent,
  };
  const kindLabel: Record<string, string> = {
    order_parts: labels.kindOrderParts,
    customer_call: labels.kindCustomerCall,
    insurer_followup: labels.kindInsurerFollowup,
    rental_booking: labels.kindRentalBooking,
    invoice_prep: labels.kindInvoicePrep,
    customer_followup: labels.kindCustomerFollowup,
    documentation: labels.kindDocumentation,
    other: labels.kindOther,
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{labels.title}</CardTitle>
        <CardDescription>{labels.description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {open.length === 0 ? (
          <p className="text-sm text-muted-foreground">{labels.listEmpty}</p>
        ) : (
          <ul className="divide-y rounded-md border">
            {open.map((t) => {
              const overdue =
                t.dueAt !== null && t.dueAt.getTime() < now;
              return (
                <li
                  key={t.id}
                  className="flex flex-col gap-2 px-3 py-2 text-sm sm:flex-row sm:items-center"
                >
                  <div className="flex-1">
                    <div className="font-medium">{t.title}</div>
                    <div className="text-xs text-muted-foreground">
                      {kindLabel[t.kind] ?? t.kind} ·{' '}
                      {priorityLabel[t.priority] ?? t.priority} ·{' '}
                      {t.status === 'open'
                        ? labels.statusOpen
                        : labels.statusInProgress}
                      {' · '}
                      <span className={overdue ? 'text-red-600' : undefined}>
                        {t.dueAt
                          ? `${fmt.format(t.dueAt)}${overdue ? ` (${labels.overdueLabel})` : ''}`
                          : labels.noDueAt}
                      </span>
                    </div>
                  </div>
                  <CaseOfficeTaskRowActions
                    taskId={t.id}
                    actionCompleteLabel={labels.actionComplete}
                    actionCancelLabel={labels.actionCancel}
                    cancelReasonPlaceholder={labels.cancelReason}
                    cancelReasonRequired={labels.cancelReasonRequired}
                  />
                </li>
              );
            })}
          </ul>
        )}

        <CaseOfficeTaskForm
          caseId={caseId}
          labels={{
            title: labels.addTitle,
            fieldTitle: labels.fieldTitle,
            fieldKind: labels.fieldKind,
            fieldPriority: labels.fieldPriority,
            fieldDueAt: labels.fieldDueAt,
            submit: labels.submitCreate,
            priorityLow: labels.priorityLow,
            priorityNormal: labels.priorityNormal,
            priorityHigh: labels.priorityHigh,
            priorityUrgent: labels.priorityUrgent,
            kindOrderParts: labels.kindOrderParts,
            kindCustomerCall: labels.kindCustomerCall,
            kindInsurerFollowup: labels.kindInsurerFollowup,
            kindRentalBooking: labels.kindRentalBooking,
            kindInvoicePrep: labels.kindInvoicePrep,
            kindCustomerFollowup: labels.kindCustomerFollowup,
            kindDocumentation: labels.kindDocumentation,
            kindOther: labels.kindOther,
          }}
        />
      </CardContent>
    </Card>
  );
}
