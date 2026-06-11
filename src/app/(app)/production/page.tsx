import { redirect } from 'next/navigation';

import { getSessionContext } from '@/lib/auth/session';
import { getDictionary, resolveLocale } from '@/lib/i18n';
import { findCaseById } from '@/modules/case/public';
import { getCurrentOrganization, listWorkshops } from '@/modules/identity/public';
import {
  absenceMinutesInDay,
  listPlannedSegmentsForRange,
  listProductionBoardRich,
  listResourcesForBoard,
  listWorkflowAdjacency,
  listWorkflowStates,
} from '@/modules/production/public';
import {
  findEmployeeByUserId,
  listApprovedAbsenceWindowsForEmployees,
  listMyOpenOfficeTasks,
  listOpenOfficeTasksForOrg,
} from '@/modules/workforce/public';

import { BoardV2 } from './board-v2';
import { BookFromIntakeBanner } from './book-from-intake-banner';
import { DayView, type DayOfficeTask } from './day-view';
import { ModeTabs, type BoardMode } from './mode-tabs';
import { MyTasksView, type MyTasksRow, type MyOfficeTaskRow } from './my-tasks-view';
import { ResourceView, type ResourceRow as RV_Row } from './resource-view';
import { WeekView, type WeekRow as WV_Row, type WeekOfficeTaskCell } from './week-view';

export const dynamic = 'force-dynamic';

const VALID_MODES: BoardMode[] = ['board', 'day', 'week', 'resource', 'mytasks'];

/**
 * /production — Production Board v3 (doc 13). One engine, multiple
 * visualizations. Mode is a query param so each mode is server-rendered with
 * its own data fetch. Sprint 17 ships Board (default) + Day; Week / Resource
 * / My Tasks land in later sprints (placeholder copy until then).
 */
export default async function ProductionBoardPage(props: {
  searchParams: Promise<{ mode?: string; openBooking?: string }>;
}) {
  const session = await getSessionContext();
  if (!session) redirect('/login');

  const { mode: modeParam, openBooking } = await props.searchParams;
  const mode: BoardMode =
    modeParam && (VALID_MODES as string[]).includes(modeParam)
      ? (modeParam as BoardMode)
      : 'board';

  const organization = await getCurrentOrganization(session.context);
  const locale = resolveLocale(organization?.settings);
  const t = getDictionary(locale);

  // Optional book-from-intake handoff (D2). When the wizard CTA lands here
  // with `?openBooking=<caseId>`, pre-fetch the case + workshops so a small
  // banner lets the receptionist book without leaving the planner.
  let intakeBanner: {
    caseId: string;
    caseNumber: string;
    workshops: Array<{ id: string; name: string }>;
  } | null = null;
  if (openBooking) {
    const [caseRow, workshops] = await Promise.all([
      findCaseById(session.context, openBooking),
      listWorkshops(session.context),
    ]);
    if (caseRow) {
      intakeBanner = {
        caseId: caseRow.id,
        caseNumber: caseRow.caseNumber,
        workshops: workshops.map((w) => ({ id: w.id, name: w.name })),
      };
    }
  }

  const modeLabels = {
    board: t.productionBoard.modeBoard,
    day: t.productionBoard.modeDay,
    week: t.productionBoard.modeWeek,
    resource: t.productionBoard.modeResource,
    mytasks: t.productionBoard.modeMyTasks,
  };

  return (
    <div className="mx-auto w-full max-w-[1600px] space-y-4 p-4 md:p-6">
      <header className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {t.production.title}
          </h1>
          <p className="text-sm text-muted-foreground">
            {t.production.description}
          </p>
        </div>
        <ModeTabs current={mode} labels={modeLabels} />
      </header>

      {intakeBanner ? (
        <BookFromIntakeBanner
          caseId={intakeBanner.caseId}
          caseNumber={intakeBanner.caseNumber}
          workshops={intakeBanner.workshops}
          labels={{
            title: t.productionBoard.bookFromIntakeTitle,
            subtitle: t.productionBoard.bookFromIntakeSubtitle,
            workshop: t.productionBoard.bookFromIntakeWorkshop,
            arrival: t.productionBoard.bookFromIntakeArrival,
            delivery: t.productionBoard.bookFromIntakeDelivery,
            notes: t.productionBoard.bookFromIntakeNotes,
            confirm: t.productionBoard.bookFromIntakeConfirm,
            create: t.productionBoard.bookFromIntakeCreate,
            dismiss: t.productionBoard.bookFromIntakeDismiss,
            successTitle: t.productionBoard.bookFromIntakeSuccess,
            successOpenCase: t.productionBoard.bookFromIntakeOpenCase,
            errorPrefix: t.productionBoard.bookFromIntakeError,
          }}
        />
      ) : null}

      {mode === 'board' && (
        <BoardSection session={session} t={t} />
      )}
      {mode === 'day' && <DaySection session={session} t={t} />}
      {mode === 'week' && <WeekSection session={session} t={t} />}
      {mode === 'resource' && <ResourceSection session={session} t={t} />}
      {mode === 'mytasks' && (
        <MyTasksSection session={session} t={t} />
      )}
    </div>
  );
}

async function BoardSection({
  session,
  t,
}: {
  session: Awaited<ReturnType<typeof getSessionContext>>;
  t: ReturnType<typeof getDictionary>;
}) {
  if (!session) return null;
  const [board, statesRaw, adjacency] = await Promise.all([
    listProductionBoardRich(session.context),
    listWorkflowStates(session.context),
    listWorkflowAdjacency(session.context),
  ]);
  const states = statesRaw
    .map((s) => ({
      code: s.code,
      label: s.label,
      sequenceNo: s.sequenceNo,
      category: s.category,
      colorHint: s.colorHint,
    }))
    .sort((a, b) => a.sequenceNo - b.sequenceNo);

  return (
    <BoardV2
      items={board}
      states={states}
      allowedTransitions={adjacency}
      labels={{
        cardEta: t.production.cardEta,
        cardAssigned: t.production.cardAssigned,
        cardTech: t.production.cardTech,
        cardParts: t.production.cardParts,
        cardPartsOk: t.production.cardPartsOk,
        cardPartsWaiting: t.production.cardPartsWaiting,
        cardHold: t.production.cardHold,
        cardSegment: t.production.cardSegment,
        cardProgress: t.production.cardProgress,
        cardNoSegments: t.production.cardNoSegments,
        cardOpenedDays: t.production.cardOpenedDays,
        cardRiskGreen: t.production.cardRiskGreen,
        cardRiskYellow: t.production.cardRiskYellow,
        cardRiskRed: t.production.cardRiskRed,
        boardEmpty: t.production.boardEmpty,
        noOrder: t.production.noOrder,
      }}
    />
  );
}

async function DaySection({
  session,
  t,
}: {
  session: Awaited<ReturnType<typeof getSessionContext>>;
  t: ReturnType<typeof getDictionary>;
}) {
  if (!session) return null;
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const endOfToday = new Date(startOfToday.getTime() + 24 * 60 * 60 * 1000);
  const [rows, allOffice] = await Promise.all([
    listPlannedSegmentsForRange(session.context, startOfToday, endOfToday),
    listOpenOfficeTasksForOrg(session.context, 100),
  ]);
  const todaysOffice = allOffice.filter(
    (t) => t.dueAt !== null && t.dueAt < endOfToday,
  );
  const caseNumberById = await loadCaseNumbers(
    session,
    todaysOffice.map((o) => o.caseId).filter((id): id is string => id !== null),
  );
  const officeTasks: DayOfficeTask[] = todaysOffice.map((o) => ({
    taskId: o.id,
    title: o.title,
    kind: o.kind,
    priority: o.priority,
    dueAt: o.dueAt ? o.dueAt.toISOString() : null,
    caseId: o.caseId,
    caseNumber: o.caseId ? (caseNumberById.get(o.caseId) ?? null) : null,
  }));
  return (
    <DayView
      rows={rows.map((r) => ({
        assignmentId: r.assignmentId,
        segmentId: r.segmentId,
        segmentLabel: r.segmentLabel,
        caseId: r.caseId,
        caseNumber: r.caseNumber,
        resourceId: r.resourceId,
        resourceName: r.resourceName,
        resourceKind: r.resourceKind,
        plannedStartAt: r.plannedStartAt
          ? r.plannedStartAt.toISOString()
          : null,
        plannedEndAt: r.plannedEndAt ? r.plannedEndAt.toISOString() : null,
        status: r.status,
      }))}
      officeTasks={officeTasks}
      labels={{
        heading: t.productionBoard.dayHeading,
        empty: t.productionBoard.dayEmpty,
        timeColumn: t.productionBoard.dayTimeColumn,
        caseColumn: t.productionBoard.dayCaseColumn,
        resourceColumn: t.productionBoard.dayResourceColumn,
        officeLaneHeading: t.productionBoard.officeLaneHeading,
        officeLaneEmpty: t.productionBoard.officeLaneEmpty,
      }}
    />
  );
}

/**
 * Batch case-number lookup. `findCaseById` is single-shot; this helper
 * de-dupes and runs them in parallel. Small N (≤ a few dozen) so a join-
 * style query isn't worth the extra repository surface.
 */
async function loadCaseNumbers(
  session: NonNullable<Awaited<ReturnType<typeof getSessionContext>>>,
  caseIds: string[],
): Promise<Map<string, string>> {
  const unique = Array.from(new Set(caseIds));
  const map = new Map<string, string>();
  await Promise.all(
    unique.map(async (id) => {
      const c = await findCaseById(session.context, id);
      if (c) map.set(id, c.caseNumber);
    }),
  );
  return map;
}

/**
 * My Tasks composer (Sprint 20, doc 13 §4.5). Looks up the employee row
 * linked to the current user, finds resources owned by that employee, and
 * shows planned segments split into today / rest-of-the-week buckets.
 */
async function MyTasksSection({
  session,
  t,
}: {
  session: Awaited<ReturnType<typeof getSessionContext>>;
  t: ReturnType<typeof getDictionary>;
}) {
  if (!session) return null;
  const DAY = 86400000;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayEnd = new Date(today.getTime() + DAY);
  const weekEnd = new Date(today.getTime() + 7 * DAY);

  const employee = await findEmployeeByUserId(session.context, session.user.id);
  const [resources, planned, myOffice] = await Promise.all([
    listResourcesForBoard(session.context),
    listPlannedSegmentsForRange(session.context, today, weekEnd),
    listMyOpenOfficeTasks(
      session.context,
      [], // resource ids filled in after `resources` load below
    ),
  ]);
  const myResourceIds = new Set(
    resources
      .filter((r) => employee && r.employeeId === employee.id)
      .map((r) => r.id),
  );
  // Now that we have the resource list, also fetch the resource-assigned
  // office tasks for this user. We could re-query, but in practice the bulk
  // (assignee_user_id direct) already came back above; merge the resource
  // matches in via a follow-up scan against the org-wide list.
  const allOrgOffice = await listOpenOfficeTasksForOrg(session.context, 500);
  const myOfficeMap = new Map<string, (typeof myOffice)[number]>();
  for (const t of myOffice) myOfficeMap.set(t.id, t);
  for (const t of allOrgOffice) {
    if (t.assigneeResourceId && myResourceIds.has(t.assigneeResourceId)) {
      myOfficeMap.set(t.id, t);
    }
  }
  const myOfficeTasks = Array.from(myOfficeMap.values());
  const caseNumberById = await loadCaseNumbers(
    session,
    myOfficeTasks
      .map((t) => t.caseId)
      .filter((id): id is string => id !== null),
  );

  const todays: MyTasksRow[] = [];
  const rest: MyTasksRow[] = [];
  for (const p of planned) {
    if (!myResourceIds.has(p.resourceId)) continue;
    if (!p.plannedStartAt) continue;
    const row: MyTasksRow = {
      segmentId: p.segmentId,
      segmentLabel: p.segmentLabel,
      caseId: p.caseId,
      caseNumber: p.caseNumber,
      resourceName: p.resourceName,
      plannedStartAt: p.plannedStartAt,
      plannedEndAt: p.plannedEndAt,
    };
    if (p.plannedStartAt < todayEnd) todays.push(row);
    else rest.push(row);
  }

  const officeTasksToday: MyOfficeTaskRow[] = [];
  const officeTasksLater: MyOfficeTaskRow[] = [];
  for (const o of myOfficeTasks) {
    const row: MyOfficeTaskRow = {
      taskId: o.id,
      title: o.title,
      kind: o.kind,
      priority: o.priority,
      caseId: o.caseId,
      caseNumber: o.caseId ? (caseNumberById.get(o.caseId) ?? null) : null,
      dueAt: o.dueAt,
    };
    if (o.dueAt && o.dueAt < todayEnd) officeTasksToday.push(row);
    else officeTasksLater.push(row);
  }

  return (
    <MyTasksView
      todays={todays}
      rest={rest}
      officeTasksToday={officeTasksToday}
      officeTasksLater={officeTasksLater}
      hasResources={employee !== null && myResourceIds.size > 0}
      t={t}
    />
  );
}

/**
 * Resource View composer (doc 13 §4.4): 7-day grid of planned vs available
 * minutes per resource, with approved absences subtracted via the SSoT
 * `absenceMinutesInDay`. Day window = 09:00–17:00 local (8h baseline) so the
 * grid is comparable across resource kinds; replace with shift definitions
 * once Sprint 19 lands. Pure read — no writes here.
 */
async function ResourceSection({
  session,
  t,
}: {
  session: Awaited<ReturnType<typeof getSessionContext>>;
  t: ReturnType<typeof getDictionary>;
}) {
  if (!session) return null;
  const DAY = 86400000;
  const SHIFT_START_HOUR = 9;
  const SHIFT_END_HOUR = 17;
  const SHIFT_LEN_MIN = (SHIFT_END_HOUR - SHIFT_START_HOUR) * 60;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const rangeStart = today;
  const rangeEnd = new Date(today.getTime() + 7 * DAY);

  const [resources, planned] = await Promise.all([
    listResourcesForBoard(session.context),
    listPlannedSegmentsForRange(session.context, rangeStart, rangeEnd),
  ]);

  const employeeIds = resources
    .map((r) => r.employeeId)
    .filter((id): id is string => id != null);
  const absenceRows = await listApprovedAbsenceWindowsForEmployees(
    session.context,
    employeeIds,
    rangeStart,
    rangeEnd,
  );
  const absenceByEmployee = new Map<
    string,
    Array<{ startMs: number; endMs: number }>
  >();
  for (const a of absenceRows) {
    if (!a.affectsCapacity) continue;
    const arr = absenceByEmployee.get(a.employeeId) ?? [];
    arr.push({ startMs: a.startsAt.getTime(), endMs: a.endsAt.getTime() });
    absenceByEmployee.set(a.employeeId, arr);
  }

  const dates: string[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(rangeStart.getTime() + i * DAY);
    dates.push(d.toISOString().slice(0, 10));
  }

  const rows: RV_Row[] = resources.map((res) => {
    const cells = dates.map((iso) => {
      const dayStart = new Date(`${iso}T00:00:00`);
      const shiftStart = new Date(dayStart);
      shiftStart.setHours(SHIFT_START_HOUR, 0, 0, 0);
      const shiftEnd = new Date(dayStart);
      shiftEnd.setHours(SHIFT_END_HOUR, 0, 0, 0);
      let plannedMin = 0;
      for (const p of planned) {
        if (p.resourceId !== res.id) continue;
        if (!p.plannedStartAt || !p.plannedEndAt) continue;
        const s = Math.max(p.plannedStartAt.getTime(), shiftStart.getTime());
        const e = Math.min(p.plannedEndAt.getTime(), shiftEnd.getTime());
        if (e > s) plannedMin += Math.round((e - s) / 60000);
      }
      const empAbs = res.employeeId
        ? (absenceByEmployee.get(res.employeeId) ?? [])
        : [];
      const absenceMin = absenceMinutesInDay(
        shiftStart.getTime(),
        shiftEnd.getTime(),
        empAbs,
      );
      const availableMin = Math.max(0, SHIFT_LEN_MIN - absenceMin);
      return {
        date: iso,
        plannedMin,
        availableMin,
        absenceMin,
      };
    });
    return {
      resourceId: res.id,
      resourceName: res.name,
      resourceKind: res.kind,
      cells,
    };
  });

  return (
    <ResourceView
      rows={rows}
      dates={dates}
      labels={{
        heading: t.productionBoard.resourceHeading,
        empty: t.productionBoard.resourceEmpty,
        planned: t.productionBoard.resourceColPlanned,
        available: t.productionBoard.resourceColAvailable,
        utilization: t.productionBoard.resourceColUtilization,
        absence: t.productionBoard.resourceColAbsence,
        legendOk: t.productionBoard.resourceLegendOk,
        legendTight: t.productionBoard.resourceLegendTight,
        legendOver: t.productionBoard.resourceLegendOver,
      }}
    />
  );
}

/**
 * Week View composer (doc 13 § 4.3): Resource × 5-weekday grid showing
 * top case + planned hours per day; bottom DEPT LOAD row aggregates the
 * day's utilization (planned / available). Same data source as Day +
 * Resource, different lens. Sprint 19.
 */
async function WeekSection({
  session,
  t,
}: {
  session: Awaited<ReturnType<typeof getSessionContext>>;
  t: ReturnType<typeof getDictionary>;
}) {
  if (!session) return null;
  const DAY = 86400000;
  const SHIFT_START_HOUR = 9;
  const SHIFT_END_HOUR = 17;
  const SHIFT_LEN_MIN = (SHIFT_END_HOUR - SHIFT_START_HOUR) * 60;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  // Start the week on Monday for the planning lens.
  const dow = today.getDay(); // 0=Sun..6=Sat
  const daysFromMonday = (dow + 6) % 7;
  const weekStart = new Date(today.getTime() - daysFromMonday * DAY);
  const weekEnd = new Date(weekStart.getTime() + 5 * DAY);

  const [resources, planned, officeAll] = await Promise.all([
    listResourcesForBoard(session.context),
    listPlannedSegmentsForRange(session.context, weekStart, weekEnd),
    listOpenOfficeTasksForOrg(session.context, 500),
  ]);

  const employeeIds = resources
    .map((r) => r.employeeId)
    .filter((id): id is string => id != null);
  const absenceRows = await listApprovedAbsenceWindowsForEmployees(
    session.context,
    employeeIds,
    weekStart,
    weekEnd,
  );
  const absenceByEmployee = new Map<
    string,
    Array<{ startMs: number; endMs: number }>
  >();
  for (const a of absenceRows) {
    if (!a.affectsCapacity) continue;
    const arr = absenceByEmployee.get(a.employeeId) ?? [];
    arr.push({ startMs: a.startsAt.getTime(), endMs: a.endsAt.getTime() });
    absenceByEmployee.set(a.employeeId, arr);
  }

  const dates: string[] = [];
  for (let i = 0; i < 5; i++) {
    const d = new Date(weekStart.getTime() + i * DAY);
    dates.push(d.toISOString().slice(0, 10));
  }

  const rows: WV_Row[] = resources.map((res) => {
    const cells = dates.map((iso) => {
      const dayStart = new Date(`${iso}T00:00:00`);
      const shiftStart = new Date(dayStart);
      shiftStart.setHours(SHIFT_START_HOUR, 0, 0, 0);
      const shiftEnd = new Date(dayStart);
      shiftEnd.setHours(SHIFT_END_HOUR, 0, 0, 0);
      let plannedMin = 0;
      const caseSet = new Set<string>();
      let topStartMs = Number.POSITIVE_INFINITY;
      let topCaseNumber: string | null = null;
      for (const p of planned) {
        if (p.resourceId !== res.id) continue;
        if (!p.plannedStartAt || !p.plannedEndAt) continue;
        const s = Math.max(p.plannedStartAt.getTime(), shiftStart.getTime());
        const e = Math.min(p.plannedEndAt.getTime(), shiftEnd.getTime());
        if (e > s) {
          plannedMin += Math.round((e - s) / 60000);
          caseSet.add(p.caseId);
          if (p.plannedStartAt.getTime() < topStartMs) {
            topStartMs = p.plannedStartAt.getTime();
            topCaseNumber = p.caseNumber;
          }
        }
      }
      const empAbs = res.employeeId
        ? (absenceByEmployee.get(res.employeeId) ?? [])
        : [];
      const absenceMin = absenceMinutesInDay(
        shiftStart.getTime(),
        shiftEnd.getTime(),
        empAbs,
      );
      const availableMin = Math.max(0, SHIFT_LEN_MIN - absenceMin);
      return {
        date: iso,
        plannedMin,
        availableMin,
        topCaseNumber,
        caseCount: caseSet.size,
      };
    });
    return {
      resourceId: res.id,
      resourceName: res.name,
      resourceKind: res.kind,
      cells,
    };
  });

  return (
    <WeekView
      rows={rows}
      dates={dates}
      officeTasksByDate={dates.map((iso) => {
        const dayStart = new Date(`${iso}T00:00:00`);
        const dayEnd = new Date(dayStart.getTime() + DAY);
        const count = officeAll.filter(
          (o) => o.dueAt && o.dueAt >= dayStart && o.dueAt < dayEnd,
        ).length;
        return { date: iso, count } satisfies WeekOfficeTaskCell;
      })}
      labels={{
        heading: t.productionBoard.weekHeading,
        empty: t.productionBoard.weekEmpty,
        loadDept: t.productionBoard.weekDeptLoad,
        hoursSuffix: t.productionBoard.weekHoursSuffix,
        freeLabel: t.productionBoard.weekFree,
        officeLaneHeading: t.productionBoard.officeLaneHeading,
        officeLaneEmpty: t.productionBoard.officeLaneEmpty,
      }}
    />
  );
}
