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
} from '@/modules/case/public';
import {
  listAvailableTransitions,
  listStateHistory,
  listWorkSegments,
  remainingWorkMinutes,
} from '@/modules/production/public';
import { reconcileCaseParts, listCaseLifecycle } from '@/modules/parts/public';
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

  return (
    <main className="mx-auto max-w-3xl space-y-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">{case_.caseNumber}</h1>
        <div className="flex gap-2">
          <Link
            href={`/cases/${case_.id}/estimate`}
            className={cn(buttonVariants({ size: 'sm' }))}
          >
            Estimate
          </Link>
          <Link
            href="/cases"
            className={cn(buttonVariants({ variant: 'outline', size: 'sm' }))}
          >
            Back
          </Link>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Case</CardTitle>
          <CardDescription>
            {case_.status}
            {case_.incidentTag ? ` · ${case_.incidentTag}` : ''}
          </CardDescription>
        </CardHeader>
      </Card>

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
  );
}
