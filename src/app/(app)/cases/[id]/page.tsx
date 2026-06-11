import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { addFundingAction } from '@/app/actions/case';
import {
  ensureOrderAction,
  transitionAction,
  addSegmentAction,
  completeSegmentAction,
} from '@/app/actions/production';
import { getSessionContext } from '@/lib/auth/session';
import {
  findCaseById,
  listCaseParties,
  listFundingSources,
  listTransfers,
  listAssignments,
  listBookingsForCase,
} from '@/modules/case/public';
import {
  listAvailableTransitions,
  listStateHistory,
  listWorkSegments,
  remainingWorkMinutes,
} from '@/modules/production/public';
import { reconcileCaseParts, listCaseLifecycle } from '@/modules/parts/public';
import { listInvoiceBasesForCase } from '@/modules/finance/public';
import {
  listCasePhotos,
  isStorageConfigured,
} from '@/modules/documents/public';
import {
  listChecklistTemplates,
  listChecklistRuns,
  listDeviations,
  listSignatures,
  verifyCaseChain,
} from '@/modules/quality/public';
import { flagPartAction } from '@/app/actions/parts';
import { registerCasePhotoAction } from '@/app/actions/documents';
import {
  startChecklistAction,
  raiseDeviationAction,
  resolveDeviationAction,
} from '@/app/actions/quality';
import { signCaseAction } from '@/app/actions/signatures';
import { initiateTransferAction } from '@/app/actions/transfer';
import { listWorkshops } from '@/modules/identity/public';
import {
  latestAcceptance,
  listThreads,
  listMessages,
  isSmsConfigured,
} from '@/modules/communication/public';
import {
  requestAcceptanceAction,
  recordManualAcceptanceAction,
} from '@/app/actions/acceptance';
import { PhotoUploader } from '@/components/photo-uploader';
import { PhotoGallery } from '@/components/photo-gallery';
import { getDictionary } from '@/lib/i18n';
import { WORK_SEGMENT_CATALOG } from '@/lib/seed/work-segment-catalog';
import { cn } from '@/lib/utils';
import { findCustomerById, findVehicleById } from '@/modules/customer/public';
import { NORMAL_REPAIR_DAYS } from '@/lib/operations/snapshot';
import { findCaseProductionState } from '@/modules/production/public';
import { CaseSidePanel } from './case-side-panel';
import { CaseFinanceSection } from './case-finance-section';
import { CaseBookingsSection } from './case-bookings-section';

export const dynamic = 'force-dynamic';

/**
 * /cases/[id] — case detail skeleton (User surface). Shows the case header,
 * funding sources (the distinctive multi-funding view), parties, and an
 * add-funding control. The full timeline lands in later sprints.
 */
export default async function CaseDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getSessionContext();
  if (!session) redirect('/login');

  const { id } = await params;
  const case_ = await findCaseById(session.context, id);
  if (!case_) notFound();

  const [funding, parties] = await Promise.all([
    listFundingSources(session.context, id),
    listCaseParties(session.context, id),
  ]);

  const [transitions, history] = await Promise.all([
    listAvailableTransitions(session.context, id),
    listStateHistory(session.context, id),
  ]);
  const hasProductionOrder = history.length > 0;

  const segments = hasProductionOrder
    ? await listWorkSegments(session.context, id)
    : [];
  const remainingMinutes = remainingWorkMinutes(segments);

  const [reconciledParts, partsTimeline] = await Promise.all([
    reconcileCaseParts(session.context, id),
    listCaseLifecycle(session.context, id),
  ]);

  const invoiceBases = await listInvoiceBasesForCase(session.context, id);

  const t = getDictionary();
  const photos = await listCasePhotos(session.context, id);
  const storageReady = isStorageConfigured();
  const photoGroups = [
    {
      role: 'before_photo',
      label: t.case.photosBefore,
      photos: photos
        .filter((p) => p.role === 'before_photo')
        .map((p) => ({
          id: p.document.id,
          filename: p.document.originalFilename ?? p.document.id,
          thumbUrl: p.thumbUrl,
          fullUrl: p.fullUrl,
        })),
    },
    {
      role: 'during_photo',
      label: t.case.photosDuring,
      photos: photos
        .filter((p) => p.role === 'during_photo')
        .map((p) => ({
          id: p.document.id,
          filename: p.document.originalFilename ?? p.document.id,
          thumbUrl: p.thumbUrl,
          fullUrl: p.fullUrl,
        })),
    },
    {
      role: 'after_photo',
      label: t.case.photosAfter,
      photos: photos
        .filter((p) => p.role === 'after_photo')
        .map((p) => ({
          id: p.document.id,
          filename: p.document.originalFilename ?? p.document.id,
          thumbUrl: p.thumbUrl,
          fullUrl: p.fullUrl,
        })),
    },
  ];

  const [qcTemplates, qcRuns, deviations] = await Promise.all([
    listChecklistTemplates(session.context),
    listChecklistRuns(session.context, id),
    listDeviations(session.context, id),
  ]);

  const [signatures, signatureChain] = await Promise.all([
    listSignatures(session.context, id),
    verifyCaseChain(session.context, id),
  ]);

  const [transfers, assignments, allWorkshops] = await Promise.all([
    listTransfers(session.context, id),
    listAssignments(session.context, id),
    listWorkshops(session.context),
  ]);
  const currentWorkshopId = case_.currentWorkshopId;
  const transferTargets = allWorkshops.filter(
    (w) => w.id !== currentWorkshopId,
  );
  const bookings = await listBookingsForCase(session.context, id);

  const acceptance = await latestAcceptance(session.context, id);
  const threads = await listThreads(session.context, id);
  const acceptanceThread = acceptance?.threadId
    ? threads.find((th) => th.id === acceptance.threadId)
    : threads[0];
  const acceptanceMessages = acceptanceThread
    ? await listMessages(session.context, acceptanceThread.id)
    : [];
  const smsReady = isSmsConfigured();
  const acceptanceContact = acceptanceThread?.contactValue ?? '';

  // ── Side-panel data (Sprint 14 Track E) ──────────────────────────────────
  const [vehicle, customer, currentState] = await Promise.all([
    case_.vehicleId
      ? findVehicleById(session.context, case_.vehicleId)
      : Promise.resolve(null),
    case_.primaryCustomerId
      ? findCustomerById(session.context, case_.primaryCustomerId)
      : Promise.resolve(null),
    findCaseProductionState(session.context, id),
  ]);
  const vehicleSummary = vehicle
    ? [vehicle.make, vehicle.model, vehicle.year].filter(Boolean).join(' ') ||
      null
    : null;
  const currentStateLabel = currentState?.label ?? null;
  const etaDate = new Date(
    new Date(case_.openedAt).getTime() +
      NORMAL_REPAIR_DAYS * 24 * 60 * 60 * 1000,
  );

  return (
    <div className="mx-auto grid w-full max-w-7xl gap-6 p-4 md:p-6 lg:grid-cols-[1fr_320px]">
      <main className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">
          {case_.caseNumber}
        </h1>
        <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {case_.status}
        </span>
        {case_.incidentTag ? (
          <span className="text-xs text-muted-foreground">
            {case_.incidentTag}
          </span>
        ) : null}
      </div>

      <Card
        className={cn(
          'border-l-4',
          acceptance?.status === 'accepted'
            ? 'border-l-green-500'
            : acceptance?.status === 'declined'
              ? 'border-l-red-500'
              : acceptance?.status === 'pending'
                ? 'border-l-yellow-500'
                : 'border-l-slate-300',
        )}
      >
        <CardHeader>
          <CardTitle className="text-base">
            {t.acceptance.title} —{' '}
            {acceptance?.status === 'accepted'
              ? t.acceptance.statusAccepted
              : acceptance?.status === 'declined'
                ? t.acceptance.statusDeclined
                : acceptance?.status === 'pending'
                  ? t.acceptance.statusPending
                  : t.acceptance.statusNone}
          </CardTitle>
          <CardDescription>{t.acceptance.description}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {acceptance?.status === 'accepted' ? (
            <p className="text-sm text-green-700">
              {t.acceptance.acceptedVia}{' '}
              <span className="font-medium">{acceptance.method}</span>
              {acceptance.respondedAt
                ? ` · ${acceptance.respondedAt.toISOString().slice(0, 16)}`
                : ''}
            </p>
          ) : null}

          {!smsReady ? (
            <p className="rounded-md border border-dashed px-3 py-2 text-xs text-muted-foreground">
              {t.acceptance.queued}
            </p>
          ) : null}

          <form
            action={requestAcceptanceAction}
            className="space-y-2 rounded-md border p-3"
          >
            <input type="hidden" name="caseId" value={case_.id} />
            <div className="flex gap-2">
              <select
                name="channel"
                defaultValue="sms"
                className="h-9 rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="sms">SMS</option>
                <option value="email">E-post</option>
              </select>
              <Input
                name="contactValue"
                defaultValue={acceptanceContact}
                placeholder={t.acceptance.contactPhone}
                className="flex-1"
              />
            </div>
            <Input name="summary" placeholder={t.acceptance.summary} />
            <Button type="submit" size="sm">
              {t.acceptance.requestSms}
            </Button>
          </form>

          <form action={recordManualAcceptanceAction}>
            <input type="hidden" name="caseId" value={case_.id} />
            <Button type="submit" size="sm" variant="outline">
              {t.acceptance.manualAccept}
            </Button>
          </form>

          {acceptanceMessages.length > 0 ? (
            <div className="rounded-md border p-3">
              <p className="mb-2 text-sm font-medium">
                {t.acceptance.conversation}
              </p>
              <ul className="space-y-2">
                {acceptanceMessages.map((m) => (
                  <li
                    key={m.id}
                    className={cn(
                      'rounded-md px-3 py-2 text-sm',
                      m.direction === 'inbound'
                        ? 'bg-muted'
                        : 'bg-primary/10 text-right',
                    )}
                  >
                    <p>{m.body}</p>
                    <p className="mt-1 text-[10px] text-muted-foreground">
                      {m.direction} · {m.status} ·{' '}
                      {m.occurredAt.toISOString().slice(0, 16)}
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">
              {t.acceptance.noMessages}
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Production</CardTitle>
          <CardDescription>
            Status is a projection of the transition log ({history.length}{' '}
            transition(s)).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {!hasProductionOrder ? (
            <form action={ensureOrderAction}>
              <input type="hidden" name="caseId" value={case_.id} />
              <Button type="submit" size="sm">
                Start production
              </Button>
            </form>
          ) : transitions.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {transitions.map((t) => (
                <form key={t.id} action={transitionAction}>
                  <input type="hidden" name="caseId" value={case_.id} />
                  <input type="hidden" name="toStateCode" value={t.code} />
                  <Button type="submit" size="sm" variant="outline">
                    → {t.label}
                  </Button>
                </form>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              No further transitions from the current state.
            </p>
          )}
        </CardContent>
      </Card>

      {hasProductionOrder ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Work segments ({segments.length})
            </CardTitle>
            <CardDescription>
              The planning unit. Status is driven by clock activity —{' '}
              {Math.round(remainingMinutes / 60)}h of work remaining.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {segments.length > 0 ? (
              <ul className="divide-y rounded-md border">
                {segments.map((s) => (
                  <li
                    key={s.id}
                    className="flex items-center justify-between gap-2 px-3 py-2 text-sm"
                  >
                    <span className="font-medium">{s.label}</span>
                    <span className="flex items-center gap-2 text-xs text-muted-foreground">
                      {s.status} · {Math.round(s.plannedMinutes / 60)}h planned
                      {s.status !== 'completed' &&
                      s.status !== 'cancelled' &&
                      s.status !== 'not_started' ? (
                        <form action={completeSegmentAction}>
                          <input type="hidden" name="caseId" value={case_.id} />
                          <input type="hidden" name="segmentId" value={s.id} />
                          <Button type="submit" size="sm" variant="outline">
                            Complete
                          </Button>
                        </form>
                      ) : null}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">
                No work segments yet.
              </p>
            )}

            <form
              action={addSegmentAction}
              className="space-y-2 rounded-md border p-3"
            >
              <input type="hidden" name="caseId" value={case_.id} />
              <p className="text-sm font-medium">Add work segment</p>
              <select
                name="segmentCode"
                defaultValue="body_repair"
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                {WORK_SEGMENT_CATALOG.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.label}
                  </option>
                ))}
              </select>
              <Input
                name="plannedMinutes"
                type="number"
                min="0"
                placeholder="Planned minutes"
              />
              <Button type="submit" size="sm">
                Add segment
              </Button>
            </form>
          </CardContent>
        </Card>
      ) : null}

      <CaseBookingsSection
        caseId={case_.id}
        workshops={allWorkshops.map((w) => ({ id: w.id, name: w.name }))}
        bookings={bookings}
        labels={{
          title: t.booking.title,
          description: t.booking.description,
          activeNone: t.booking.activeNone,
          statusTentative: t.booking.statusTentative,
          statusConfirmed: t.booking.statusConfirmed,
          statusArrived: t.booking.statusArrived,
          statusCancelled: t.booking.statusCancelled,
          arrival: t.booking.arrival,
          delivery: t.booking.delivery,
          workshop: t.booking.workshop,
          notes: t.booking.notes,
          cancelReason: t.booking.cancelReason,
          cancelReasonRequired: t.booking.cancelReasonRequired,
          create: t.booking.create,
          confirm: t.booking.confirm,
          markArrived: t.booking.markArrived,
          cancel: t.booking.cancel,
          replace: t.booking.replace,
          historyTitle: t.booking.historyTitle,
          historyEmpty: t.booking.historyEmpty,
          dateError: t.booking.dateError,
        }}
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t.transfer.title}</CardTitle>
          <CardDescription>
            {t.transfer.currentWorkshop}:{' '}
            {allWorkshops.find((w) => w.id === currentWorkshopId)?.name ??
              t.common.none}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {transferTargets.length > 0 ? (
            <form
              action={initiateTransferAction}
              className="flex flex-wrap items-center gap-2 rounded-md border p-3"
            >
              <input type="hidden" name="caseId" value={case_.id} />
              <select
                name="toWorkshopId"
                className="h-9 flex-1 rounded-md border border-input bg-background px-3 text-sm"
              >
                {transferTargets.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name}
                  </option>
                ))}
              </select>
              <select
                name="transportMode"
                defaultValue="drive"
                className="h-9 rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="drive">Kjøres</option>
                <option value="tow">Berging</option>
                <option value="trailer">Henger</option>
              </select>
              <Input name="reason" placeholder={t.transfer.reason} />
              <Button type="submit" size="sm">
                {t.transfer.initiate}
              </Button>
            </form>
          ) : null}

          {assignments.length > 0 ? (
            <div className="rounded-md border p-3">
              <p className="mb-2 text-sm font-medium">{t.transfer.timeline}</p>
              <ol className="space-y-1 text-xs text-muted-foreground">
                {assignments.map((a) => (
                  <li key={a.id} className="flex items-center justify-between">
                    <span>
                      #{a.sequenceNo + 1}{' '}
                      {allWorkshops.find((w) => w.id === a.workshopId)?.name ??
                        a.workshopId.slice(0, 8)}{' '}
                      · {a.role}
                    </span>
                    <span>{a.status}</span>
                  </li>
                ))}
              </ol>
            </div>
          ) : null}

          {transfers.length > 0 ? (
            <div className="rounded-md border p-3">
              <p className="mb-2 text-sm font-medium">{t.transfer.history}</p>
              <ul className="space-y-1 text-xs text-muted-foreground">
                {transfers.map((tr) => (
                  <li key={tr.id} className="flex items-center justify-between">
                    <span>
                      {allWorkshops.find((w) => w.id === tr.fromWorkshopId)
                        ?.name ?? '—'}{' '}
                      →{' '}
                      {allWorkshops.find((w) => w.id === tr.toWorkshopId)
                        ?.name ?? '—'}
                    </span>
                    <span>{tr.status}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              {t.transfer.noTransfers}
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {t.case.photos} ({photos.length})
          </CardTitle>
          <CardDescription>{t.case.photosDescription}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {storageReady ? (
            <PhotoUploader
              caseId={case_.id}
              labels={{
                before: t.case.photosBefore,
                during: t.case.photosDuring,
                after: t.case.photosAfter,
                drop: t.case.photosDrop,
                choose: t.case.photosChoose,
                camera: t.case.photosCamera,
                uploading: t.case.photosUploading,
                done: t.case.photosDone,
                failed: t.case.photosFailed,
              }}
            />
          ) : (
            <p className="rounded-md border border-dashed px-3 py-2 text-xs text-muted-foreground">
              {t.case.storageNotConfigured}
            </p>
          )}

          <PhotoGallery groups={photoGroups} emptyLabel={t.case.noPhotos} />

          {!storageReady ? (
            <form
              action={registerCasePhotoAction}
              className="space-y-2 rounded-md border p-3"
            >
              <input type="hidden" name="caseId" value={case_.id} />
              <p className="text-sm font-medium">{t.case.uploadPhoto}</p>
              <select
                name="category"
                defaultValue="before"
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="before">{t.case.photosBefore}</option>
                <option value="during">{t.case.photosDuring}</option>
                <option value="after">{t.case.photosAfter}</option>
              </select>
              <Input name="filename" placeholder="IMG_2451.jpg" />
              <Button type="submit" size="sm">
                {t.common.add}
              </Button>
            </form>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {t.quality.title} ({qcRuns.length})
          </CardTitle>
          <CardDescription>{t.quality.description}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {qcRuns.length > 0 ? (
            <ul className="divide-y rounded-md border">
              {qcRuns.map((run) => (
                <li
                  key={run.id}
                  className="flex items-center justify-between gap-2 px-3 py-2 text-sm"
                >
                  <span className="text-xs text-muted-foreground">
                    {run.status === 'passed'
                      ? t.quality.statusPassed
                      : run.status === 'failed'
                        ? t.quality.statusFailed
                        : t.quality.statusInProgress}
                  </span>
                  <Link
                    href={`/cases/${case_.id}/qc/${run.id}`}
                    className="text-xs underline"
                  >
                    {t.quality.open}
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">{t.quality.noRuns}</p>
          )}

          {qcTemplates.length > 0 ? (
            <form
              action={startChecklistAction}
              className="flex flex-wrap items-center gap-2 rounded-md border p-3"
            >
              <input type="hidden" name="caseId" value={case_.id} />
              <select
                name="templateId"
                className="h-9 flex-1 rounded-md border border-input bg-background px-3 text-sm"
              >
                {qcTemplates.map((tpl) => (
                  <option key={tpl.id} value={tpl.id}>
                    {tpl.name}
                  </option>
                ))}
              </select>
              <Button type="submit" size="sm">
                {t.quality.startChecklist}
              </Button>
            </form>
          ) : (
            <p className="text-xs text-muted-foreground">
              {/* No templates yet — seed them in admin */}
              <Link href="/admin/checklists" className="underline">
                {t.quality.selectTemplate}
              </Link>
            </p>
          )}

          <div className="rounded-md border p-3">
            <p className="mb-2 text-sm font-medium">
              {t.quality.deviations} ({deviations.length})
            </p>
            {deviations.length > 0 ? (
              <ul className="mb-2 divide-y rounded-md border">
                {deviations.map((d) => (
                  <li
                    key={d.id}
                    className="flex items-center justify-between gap-2 px-3 py-2 text-sm"
                  >
                    <span>{d.title}</span>
                    <span className="flex items-center gap-2 text-xs text-muted-foreground">
                      {d.severity} · {d.status}
                      {d.status === 'open' ? (
                        <form action={resolveDeviationAction}>
                          <input type="hidden" name="caseId" value={case_.id} />
                          <input
                            type="hidden"
                            name="deviationId"
                            value={d.id}
                          />
                          <Button type="submit" size="sm" variant="outline">
                            {t.quality.resolve}
                          </Button>
                        </form>
                      ) : null}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mb-2 text-xs text-muted-foreground">
                {t.quality.noDeviations}
              </p>
            )}
            <form action={raiseDeviationAction} className="space-y-2">
              <input type="hidden" name="caseId" value={case_.id} />
              <Input name="title" placeholder={t.quality.deviationTitle} />
              <div className="flex gap-2">
                <select
                  name="severity"
                  defaultValue="minor"
                  className="h-9 flex-1 rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="minor">{t.quality.severityMinor}</option>
                  <option value="major">{t.quality.severityMajor}</option>
                  <option value="critical">{t.quality.severityCritical}</option>
                </select>
                <Button type="submit" size="sm">
                  {t.quality.raiseDeviation}
                </Button>
              </div>
            </form>
          </div>

          <div className="rounded-md border p-3">
            <p className="mb-2 flex items-center justify-between text-sm font-medium">
              <span>
                {t.quality.signatures} ({signatures.length})
              </span>
              {signatures.length > 0 ? (
                <span
                  className={cn(
                    'text-xs',
                    signatureChain.valid
                      ? 'text-green-600'
                      : 'text-destructive',
                  )}
                >
                  {signatureChain.valid
                    ? t.quality.chainValid
                    : t.quality.chainBroken}
                </span>
              ) : null}
            </p>
            {signatures.length > 0 ? (
              <ul className="mb-2 divide-y rounded-md border">
                {signatures.map((s) => (
                  <li
                    key={s.id}
                    className="flex items-center justify-between gap-2 px-3 py-2 text-xs"
                  >
                    <span>
                      #{s.sequenceNo} · {s.kind}
                      {s.signerName ? ` · ${s.signerName}` : ''}
                    </span>
                    <span
                      className="font-mono text-muted-foreground"
                      title={s.chainHash}
                    >
                      {s.chainHash.slice(0, 10)}…
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mb-2 text-xs text-muted-foreground">
                {t.quality.noSignatures}
              </p>
            )}
            <form action={signCaseAction} className="space-y-2">
              <input type="hidden" name="caseId" value={case_.id} />
              <div className="flex gap-2">
                <select
                  name="kind"
                  defaultValue="delivery_handover"
                  className="h-9 flex-1 rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="repair_acceptance">
                    {t.acceptance.title}
                  </option>
                  <option value="delivery_handover">Levering</option>
                  <option value="quality_signoff">{t.quality.signOff}</option>
                </select>
                <Input name="signerName" placeholder={t.quality.signerName} />
                <Button type="submit" size="sm">
                  {t.quality.sign}
                </Button>
              </div>
            </form>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Parts ({reconciledParts.length})
          </CardTitle>
          <CardDescription>
            Flag missing parts; the coordinator orders, receives, and withdraws.
            Status reconciles estimated vs ordered vs received.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {reconciledParts.length > 0 ? (
            <ul className="divide-y rounded-md border">
              {reconciledParts.map(({ requirement, reconciliation }) => (
                <li
                  key={requirement.id}
                  className="flex items-center justify-between gap-2 px-3 py-2 text-sm"
                >
                  <span className="font-medium">
                    {requirement.description}
                    {requirement.partNumber ? (
                      <span className="ml-2 text-xs text-muted-foreground">
                        {requirement.partNumber}
                      </span>
                    ) : null}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {requirement.status} · {reconciliation.state}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">
              No parts flagged yet.
            </p>
          )}

          <form
            action={flagPartAction}
            className="space-y-2 rounded-md border p-3"
          >
            <input type="hidden" name="caseId" value={case_.id} />
            <p className="text-sm font-medium">Flag a missing part</p>
            <Input
              name="description"
              placeholder="Description (e.g. Frontlykt H)"
            />
            <Input name="partNumber" placeholder="Part number (optional)" />
            <Input
              name="quantity"
              type="number"
              min="1"
              step="1"
              defaultValue="1"
              placeholder="Quantity"
            />
            <Button type="submit" size="sm">
              Flag part
            </Button>
          </form>

          {partsTimeline.length > 0 ? (
            <div className="rounded-md border p-3">
              <p className="mb-2 text-sm font-medium">Lifecycle timeline</p>
              <ul className="space-y-1 text-xs text-muted-foreground">
                {partsTimeline.slice(0, 12).map((e) => (
                  <li key={e.id} className="flex items-center justify-between">
                    <span>{e.kind}</span>
                    <span>{e.occurredAt.toISOString().slice(0, 16)}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Funding sources ({funding.length})
          </CardTitle>
          <CardDescription>
            Multiple payers can fund one repair visit.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {funding.length > 0 ? (
            <ul className="divide-y rounded-md border">
              {funding.map((f) => (
                <li
                  key={f.id}
                  className="flex items-center justify-between px-3 py-2 text-sm"
                >
                  <span className="font-medium">{f.label}</span>
                  <span className="text-xs text-muted-foreground">
                    {f.kind} · {f.status}
                    {f.deductibleAmount
                      ? ` · deductible ${f.deductibleAmount} ${f.currency}`
                      : ''}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">
              No funding sources yet.
            </p>
          )}

          <form
            action={addFundingAction}
            className="space-y-2 rounded-md border p-3"
          >
            <input type="hidden" name="caseId" value={case_.id} />
            <p className="text-sm font-medium">Add funding source</p>
            <select
              name="kind"
              defaultValue="private_pay"
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="private_pay">Private pay</option>
              <option value="insurance">Insurance</option>
              <option value="warranty">Warranty</option>
              <option value="goodwill">Goodwill</option>
              <option value="internal_rework">Internal rework</option>
            </select>
            <Input name="label" placeholder="Label" />
            <Button type="submit" size="sm">
              Add
            </Button>
            <p className="text-xs text-muted-foreground">
              Per-kind requirements are validated on save (e.g. insurance needs
              an insurer).
            </p>
          </form>
        </CardContent>
      </Card>

      <CaseFinanceSection
        caseId={case_.id}
        bases={invoiceBases.map((b) => ({
          id: b.id,
          basisNumber: b.basisNumber,
          payerType: b.payerType,
          kind: b.kind,
          netAmount: b.netAmount,
          vatAmount: b.vatAmount,
          grossAmount: b.grossAmount,
          currency: b.currency,
          status: b.status,
        }))}
        labels={{
          caseTitle: t.finance.caseTitle,
          caseDescription: t.finance.caseDescription,
          generate: t.finance.generate,
          generateHint: t.finance.generateHint,
          approve: t.finance.approve,
          cancel: t.finance.cancel,
          noBasis: t.finance.noBasis,
          regenerateHint: t.finance.regenerateHint,
          basisNumber: t.finance.basisNumber,
          payer: t.finance.payer,
          kind: t.finance.kind,
          net: t.finance.net,
          vat: t.finance.vat,
          gross: t.finance.gross,
          status: t.finance.status,
          kindStandard: t.finance.kindStandard,
          kindDeductible: t.finance.kindDeductible,
          kindInternal: t.finance.kindInternal,
          statusDraft: t.finance.statusDraft,
          statusApproved: t.finance.statusApproved,
          statusExported: t.finance.statusExported,
          statusSettled: t.finance.statusSettled,
          statusCancelled: t.finance.statusCancelled,
        }}
      />

      {parties.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Parties</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="divide-y rounded-md border">
              {parties.map((p) => (
                <li
                  key={p.id}
                  className="flex items-center justify-between px-3 py-2 text-sm"
                >
                  <span>{p.name ?? 'Party'}</span>
                  <span className="text-xs text-muted-foreground">
                    {p.role}
                  </span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}
    </main>
      <CaseSidePanel
        caseId={case_.id}
        caseNumber={case_.caseNumber}
        openedAt={case_.openedAt}
        stateLabel={currentStateLabel}
        vehicleSummary={vehicleSummary}
        registrationNumber={vehicle?.registrationNumber ?? null}
        customerName={customer?.name ?? null}
        assignedTechName={null}
        etaDate={etaDate}
        funding={funding.map((f) => ({
          id: f.id,
          kind: f.kind,
          label: f.label ?? null,
          status: f.status,
        }))}
        availableTransitions={transitions.map((s) => ({
          id: s.id,
          code: s.code,
          label: s.label,
        }))}
        labels={{
          state: t.case.panelState,
          vehicle: t.case.panelVehicle,
          customer: t.case.panelCustomer,
          openedDays: t.case.panelOpenedDays,
          eta: t.case.panelEta,
          tech: t.case.panelTech,
          funding: t.case.panelFunding,
          fundingEmpty: t.case.panelFundingEmpty,
          quickActions: t.case.panelQuickActions,
          changeStatus: t.case.panelChangeStatus,
          estimate: t.case.panelEstimate,
          cancel: t.case.panelCancel,
          confirm: t.case.panelConfirm,
          reason: t.case.panelReason,
          reasonOptional: t.case.panelReasonOptional,
          newStatus: t.case.panelNewStatus,
          noState: t.case.panelNoState,
          noTech: t.case.panelNoTech,
        }}
      />
    </div>
  );
}
