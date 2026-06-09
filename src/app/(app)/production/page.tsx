import { redirect } from 'next/navigation';

import { getSessionContext } from '@/lib/auth/session';
import { getDictionary, resolveLocale } from '@/lib/i18n';
import { getCurrentOrganization } from '@/modules/identity/public';
import {
  listPlannedSegmentsForRange,
  listProductionBoardRich,
  listWorkflowAdjacency,
  listWorkflowStates,
} from '@/modules/production/public';

import { BoardV2 } from './board-v2';
import { DayView } from './day-view';
import { ModeTabs, type BoardMode } from './mode-tabs';

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
      {mode === 'week' && (
        <Placeholder message={t.productionBoard.weekComingSoon} />
      )}
      {mode === 'resource' && (
        <Placeholder message={t.productionBoard.resourceComingSoon} />
      )}
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
