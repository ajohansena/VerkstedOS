import Link from 'next/link';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { requirePlatformAccess } from '@/lib/platform/guard';
import { getDictionary } from '@/lib/i18n';
import {
  listDangerousOpsQueue,
  type DangerousOperationKind,
  type DangerousOperationRow,
  type DangerousOperationStatus,
} from '@/modules/platform/public';

import {
  approveDangerousOpAction,
  cancelDangerousOpAction,
  executeDangerousOpAction,
  rejectDangerousOpAction,
  requestDangerousOpAction,
} from './actions';

export const dynamic = 'force-dynamic';

/**
 * `/dev/two-person` — Two-person rule queue for dangerous operations
 * (Sprint 20, docs/06 §Two-person rule). Platform-only surface behind the
 * hardened `(dev)` guard. Requestor cannot approve or execute their own
 * request; the UI hides the buttons and the service enforces it.
 */
export default async function DevTwoPersonPage() {
  const ctx = await requirePlatformAccess();
  const t = getDictionary('nb-NO');
  const queue = await listDangerousOpsQueue();

  const KIND_LABEL: Record<DangerousOperationKind, string> = {
    org_lock: t.twoPerson.kindOrgLock,
    org_unlock: t.twoPerson.kindOrgUnlock,
    jobs_pause: t.twoPerson.kindJobsPause,
    jobs_resume: t.twoPerson.kindJobsResume,
    maintenance_mode_on: t.twoPerson.kindMaintenanceOn,
    maintenance_mode_off: t.twoPerson.kindMaintenanceOff,
    data_delete: t.twoPerson.kindDataDelete,
    data_restore: t.twoPerson.kindDataRestore,
  };

  const STATUS_LABEL: Record<DangerousOperationStatus, string> = {
    pending_approval: t.twoPerson.statusPendingApproval,
    approved: t.twoPerson.statusApproved,
    rejected: t.twoPerson.statusRejected,
    executed: t.twoPerson.statusExecuted,
    cancelled: t.twoPerson.statusCancelled,
  };

  const STATUS_TONE: Record<DangerousOperationStatus, string> = {
    pending_approval: 'bg-amber-100 text-amber-900',
    approved: 'bg-blue-100 text-blue-900',
    rejected: 'bg-slate-200 text-slate-700',
    executed: 'bg-emerald-100 text-emerald-900',
    cancelled: 'bg-slate-200 text-slate-700',
  };

  return (
    <main className="mx-auto max-w-6xl space-y-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">{t.twoPerson.queueTitle}</h1>
        <Link href="/dev/health" className="text-sm underline">
          /dev/health
        </Link>
      </div>

      <p className="text-sm text-muted-foreground">
        {t.twoPerson.queueDescription}
      </p>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t.twoPerson.requestTitle}</CardTitle>
          <CardDescription>
            {KIND_LABEL.data_delete} · {KIND_LABEL.org_lock} ·{' '}
            {KIND_LABEL.maintenance_mode_on}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            action={requestDangerousOpAction}
            className="grid gap-3 sm:grid-cols-[1fr_2fr_1fr_auto]"
          >
            <label className="grid gap-1 text-xs">
              <span className="font-medium">{t.twoPerson.requestKind}</span>
              <select
                name="kind"
                required
                className="h-9 rounded-md border bg-background px-2 text-sm"
              >
                {Object.entries(KIND_LABEL).map(([k, label]) => (
                  <option key={k} value={k}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1 text-xs">
              <span className="font-medium">{t.twoPerson.requestReason}</span>
              <Input
                name="reason"
                minLength={8}
                required
                placeholder="Minst 8 tegn"
              />
            </label>
            <label className="grid gap-1 text-xs">
              <span className="font-medium">{t.twoPerson.requestOrgId}</span>
              <Input name="organizationId" placeholder="uuid" />
            </label>
            <div className="flex items-end">
              <Button type="submit">{t.twoPerson.requestSubmit}</Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <section className="space-y-3">
        {queue.length === 0 ? (
          <div className="rounded-lg border bg-background p-6 text-sm text-muted-foreground">
            {t.twoPerson.empty}
          </div>
        ) : (
          queue.map((op) => (
            <OperationCard
              key={op.id}
              op={op}
              currentUserId={ctx.userId}
              kindLabel={KIND_LABEL[op.kind]}
              statusLabel={STATUS_LABEL[op.status]}
              statusTone={STATUS_TONE[op.status]}
              t={t}
            />
          ))
        )}
      </section>
    </main>
  );
}

function OperationCard({
  op,
  currentUserId,
  kindLabel,
  statusLabel,
  statusTone,
  t,
}: {
  op: DangerousOperationRow;
  currentUserId: string;
  kindLabel: string;
  statusLabel: string;
  statusTone: string;
  t: ReturnType<typeof getDictionary>;
}) {
  const isRequestor = op.requestedByUserId === currentUserId;
  const canApprove = op.status === 'pending_approval' && !isRequestor;
  const canReject = op.status === 'pending_approval' && !isRequestor;
  const canExecute = op.status === 'approved' && !isRequestor;
  const canCancel =
    op.status === 'pending_approval' || op.status === 'approved';

  const fmt = (d: Date | null): string =>
    d ? new Intl.DateTimeFormat('nb-NO', { dateStyle: 'short', timeStyle: 'short' }).format(d) : '—';

  return (
    <div className="rounded-lg border bg-background p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-semibold">{kindLabel}</span>
            <span className={`rounded px-2 py-0.5 text-xs font-medium ${statusTone}`}>
              {statusLabel}
            </span>
            {op.organizationId && (
              <span className="text-xs text-muted-foreground">
                org: {op.organizationId.slice(0, 8)}…
              </span>
            )}
          </div>
          <p className="mt-1 text-sm">{op.reason}</p>
          <div className="mt-2 grid grid-cols-1 gap-x-6 gap-y-1 text-xs text-muted-foreground sm:grid-cols-3">
            <span>
              {t.twoPerson.requestedBy}: {op.requestedByUserId.slice(0, 8)}…
              {isRequestor ? ' (du)' : ''}
            </span>
            <span>
              {t.twoPerson.requestedAt}: {fmt(op.requestedAt)}
            </span>
            {op.approvedByUserId && (
              <span>
                {t.twoPerson.approvedBy}: {op.approvedByUserId.slice(0, 8)}…
              </span>
            )}
            {op.approvedAt && (
              <span>
                {t.twoPerson.approvedAt}: {fmt(op.approvedAt)}
              </span>
            )}
            {op.executedAt && (
              <span>
                {t.twoPerson.executedAt}: {fmt(op.executedAt)}
              </span>
            )}
          </div>
          {op.outcome && (
            <p className="mt-2 text-xs italic text-muted-foreground">
              {op.outcome}
            </p>
          )}
          {isRequestor && op.status === 'pending_approval' && (
            <p className="mt-2 text-xs text-amber-700">
              {t.twoPerson.twoPersonRuleViolation}
            </p>
          )}
        </div>
        <div className="flex flex-wrap items-start gap-2">
          {canApprove && (
            <form action={approveDangerousOpAction}>
              <input type="hidden" name="id" value={op.id} />
              <Button size="sm" type="submit">
                {t.twoPerson.actionApprove}
              </Button>
            </form>
          )}
          {canReject && (
            <form action={rejectDangerousOpAction} className="flex items-center gap-1">
              <input type="hidden" name="id" value={op.id} />
              <Input
                name="outcome"
                placeholder="Begrunnelse"
                className="h-8 w-32 text-xs"
              />
              <Button size="sm" variant="outline" type="submit">
                {t.twoPerson.actionReject}
              </Button>
            </form>
          )}
          {canExecute && (
            <form action={executeDangerousOpAction} className="flex items-center gap-1">
              <input type="hidden" name="id" value={op.id} />
              <Input
                name="outcome"
                placeholder="Resultat"
                className="h-8 w-32 text-xs"
              />
              <Button size="sm" type="submit">
                {t.twoPerson.actionExecute}
              </Button>
            </form>
          )}
          {canCancel && (
            <form action={cancelDangerousOpAction}>
              <input type="hidden" name="id" value={op.id} />
              <Button size="sm" variant="ghost" type="submit">
                {t.twoPerson.actionCancel}
              </Button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
