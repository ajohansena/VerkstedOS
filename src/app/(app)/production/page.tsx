import { redirect } from 'next/navigation';

import { getSessionContext } from '@/lib/auth/session';
import { getDictionary, resolveLocale } from '@/lib/i18n';
import { getCurrentOrganization } from '@/modules/identity/public';
import {
  listProductionBoardRich,
  listWorkflowAdjacency,
  listWorkflowStates,
} from '@/modules/production/public';

import { BoardV2 } from './board-v2';

export const dynamic = 'force-dynamic';

/**
 * /production — Production Board v2 (doc 11 §4, doc 12 §5). Real columns per
 * workflow state, rich operationally-meaningful cards, drag-to-transition
 * gated by the workflow's transition graph (server re-validates).
 */
export default async function ProductionBoardPage() {
  const session = await getSessionContext();
  if (!session) redirect('/login');

  const organization = await getCurrentOrganization(session.context);
  const locale = resolveLocale(organization?.settings);
  const t = getDictionary(locale);

  const [board, statesRaw, adjacency] = await Promise.all([
    listProductionBoardRich(session.context),
    listWorkflowStates(session.context),
    listWorkflowAdjacency(session.context),
  ]);

  const states = statesRaw
    .filter((s) => s.category !== 'terminal' || true) // show terminal too
    .map((s) => ({
      code: s.code,
      label: s.label,
      sequenceNo: s.sequenceNo,
      category: s.category,
      colorHint: s.colorHint,
    }))
    .sort((a, b) => a.sequenceNo - b.sequenceNo);

  return (
    <div className="mx-auto w-full max-w-[1600px] space-y-4 p-4 md:p-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">
          {t.production.title}
        </h1>
        <p className="text-sm text-muted-foreground">
          {t.production.description}
        </p>
      </header>
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
    </div>
  );
}
