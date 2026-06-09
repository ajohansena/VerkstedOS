import { redirect } from 'next/navigation';

import { getSessionContext } from '@/lib/auth/session';
import { getDictionary, resolveLocale } from '@/lib/i18n';
import { getCurrentOrganization } from '@/modules/identity/public';
import {
  absenceMinutesInDay,
  listPlannedSegmentsForRange,
  listProductionBoardRich,
  listResourcesForBoard,
  listWorkflowAdjacency,
  listWorkflowStates,
} from '@/modules/production/public';
import { listApprovedAbsenceWindowsForEmployees } from '@/modules/workforce/public';

import { BoardV2 } from './board-v2';
import { DayView } from './day-view';
import { ModeTabs, type BoardMode } from './mode-tabs';
import { ResourceView, type ResourceRow as RV_Row } from './resource-view';
import { WeekView, type WeekRow as WV_Row } from './week-view';

export const dynamic = 'force-dynamic';

const VALID_MODES: BoardMode[] = ['board', 'day', 'week', 'resource', 'mytasks'];

/**
 * /production — Production Board v3 (doc 13). One engine, multiple
 * visualizations. Mode is a query param so each mode is server-rendered with
 * its own data fetch. Sprint 17 ships Board (default) + Day; Week / Resource
 * / My Tasks land in later sprints (placeholder copy until then).
 */
export default async function ProductionBoardPage(props: {
  searchParams: Promise<{ mode?: string }>;
}) {
  const session = await getSessionContext();
  if (!session) redirect('/login');

  const { mode: modeParam } = await props.searchParams;
  const mode: BoardMode =
    modeParam && (VALID_MODES as string[]).includes(modeParam)
      ? (modeParam as BoardMode)
      : 'board';

  const organization = await getCurrentOrganization(session.context);
  const locale = resolveLocale(organization?.settings);
  const t = getDictionary(locale);

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

      {mode === 'board' && (
        <BoardSection session={session} t={t} />
      )}
      {mode === 'day' && <DaySection session={session} t={t} />}
      {mode === 'week' && <WeekSection session={session} t={t} />}
      {mode === 'resource' && <ResourceSection session={session} t={t} />}
      {mode === 'mytasks' && (
        <Placeholder message={t.productionBoard.myTasksComingSoon} />
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
  const rows = await listPlannedSegmentsForRange(
    session.context,
    startOfToday,
    endOfToday,
  );
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
      labels={{
        heading: t.productionBoard.dayHeading,
        empty: t.productionBoard.dayEmpty,
        timeColumn: t.productionBoard.dayTimeColumn,
        caseColumn: t.productionBoard.dayCaseColumn,
        resourceColumn: t.productionBoard.dayResourceColumn,
      }}
    />
  );
}

function Placeholder({ message }: { message: string }) {
  return (
    <div className="rounded-lg border bg-background p-6 text-sm text-muted-foreground">
      {message}
    </div>
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

  const [resources, planned] = await Promise.all([
    listResourcesForBoard(session.context),
    listPlannedSegmentsForRange(session.context, weekStart, weekEnd),
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
      labels={{
        heading: t.productionBoard.weekHeading,
        empty: t.productionBoard.weekEmpty,
        loadDept: t.productionBoard.weekDeptLoad,
        hoursSuffix: t.productionBoard.weekHoursSuffix,
        freeLabel: t.productionBoard.weekFree,
      }}
    />
  );
}
