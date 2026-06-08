import type { RequestContext } from '@/lib/tenancy/context';
import { listInboundTransfers } from '@/modules/case/public';
import { listOpenRequirements } from '@/modules/parts/public';
import {
  listActiveHoldsForOrg,
  listProductionBoardRich,
  type OrgHold,
  type RichBoardItem,
} from '@/modules/production/public';
import { listWorkingNow, type WorkingNow } from '@/modules/workforce/public';

import { caseAgeDays, classifyCaseRisk, NORMAL_REPAIR_DAYS } from './risk';

/**
 * Operations Center snapshot composer (docs/12 §4).
 *
 * Aggregates a handful of public-surface reads into the three zones the
 * Operations Center renders (Attention / Flow / Pulse). The composer lives
 * outside `src/modules/` because it spans contexts — every read goes through a
 * module's public barrel.
 *
 * The pure risk helpers (`classifyCaseRisk`, `caseAgeDays`, `NORMAL_REPAIR_DAYS`)
 * live in `./risk` (server-free) so client components can import them without
 * pulling the DB client into the browser bundle. Re-exported here for callers
 * that already import from the composer.
 */

export {
  NORMAL_REPAIR_DAYS,
  caseAgeDays,
  classifyCaseRisk,
} from './risk';


export interface OpsAttentionItem {
  readonly id: string;
  readonly severity: 'red' | 'yellow';
  readonly messageKey:
    | 'inbound'
    | 'onHold'
    | 'partsBlocked'
    | 'longOpen'
    | 'pendingAcceptance';
  readonly params: Record<string, string | number>;
  /** Where clicking the attention item should take the user. */
  readonly href: string;
}

export interface OpsPulse {
  readonly activeCases: number;
  readonly dueToday: number;
  readonly atRisk: number;
  readonly segmentsInProgress: number;
  readonly workingNow: number;
  readonly inbound: number;
  readonly openParts: number;
}

export interface OpsFlowGroup {
  stateCode: string;
  stateLabel: string;
  category: 'active' | 'waiting' | 'terminal';
  count: number;
  redCount: number;
}

export interface OpsSnapshot {
  readonly attention: OpsAttentionItem[];
  readonly flow: OpsFlowGroup[];
  readonly pulse: OpsPulse;
  readonly board: RichBoardItem[];
  readonly holds: OrgHold[];
  readonly workingNow: WorkingNow[];
  readonly inboundCount: number;
  readonly openPartsCount: number;
}

export async function getOpsSnapshot(
  ctx: RequestContext,
): Promise<OpsSnapshot> {
  const workshopIds = ctx.workshopId
    ? [ctx.workshopId]
    : [...ctx.accessibleWorkshopIds];
  const [board, holds, inboundLists, openParts, working] = await Promise.all([
    listProductionBoardRich(ctx),
    listActiveHoldsForOrg(ctx, 10),
    Promise.all(workshopIds.map((id) => listInboundTransfers(ctx, id))),
    listOpenRequirements(ctx),
    listWorkingNow(ctx),
  ]);
  const inbound = inboundLists.flat();

  const now = new Date();

  // ── Flow zone: group rich-board rows by state ─────────────────────────────
  const flowMap = new Map<string, OpsFlowGroup>();
  let segmentsInProgress = 0;
  let atRisk = 0;
  let dueToday = 0;

  for (const item of board) {
    if (item.activeSegmentLabel) segmentsInProgress += 1;
    const risk = classifyCaseRisk({
      openedAt: item.openedAt,
      onHold: item.onHold,
      openPartsCount: item.openPartsCount,
      stateCategory: item.stateCategory,
      now,
    });
    if (risk !== 'green') atRisk += 1;
    if (caseAgeDays(item.openedAt, now) >= NORMAL_REPAIR_DAYS) dueToday += 1;

    if (item.stateCode && item.stateLabel && item.stateCategory) {
      const key = item.stateCode;
      const group = flowMap.get(key) ?? {
        stateCode: item.stateCode,
        stateLabel: item.stateLabel,
        category: item.stateCategory,
        count: 0,
        redCount: 0,
      };
      group.count += 1;
      if (risk === 'red') group.redCount += 1;
      flowMap.set(key, group);
    }
  }

  // ── Attention zone: prioritized actionable items ─────────────────────────
  const attention: OpsAttentionItem[] = [];

  if (inbound.length > 0) {
    attention.push({
      id: 'inbound',
      severity: 'yellow',
      messageKey: 'inbound',
      params: { count: inbound.length },
      href: '/yard',
    });
  }

  const partsBlockedCount = board.filter(
    (item) =>
      item.openPartsCount > 0 &&
      (item.stateCategory === 'waiting' || item.onHold),
  ).length;
  if (partsBlockedCount > 0) {
    attention.push({
      id: 'parts-blocked',
      severity: partsBlockedCount > 2 ? 'red' : 'yellow',
      messageKey: 'partsBlocked',
      params: { count: partsBlockedCount },
      href: '/parts',
    });
  }

  for (const hold of holds.slice(0, 5)) {
    attention.push({
      id: `hold:${hold.caseId}`,
      severity: 'red',
      messageKey: 'onHold',
      params: {
        caseNumber: hold.caseNumber,
        reason: hold.reason ?? hold.holdKind,
      },
      href: `/cases/${hold.caseId}`,
    });
  }

  for (const item of board) {
    if (caseAgeDays(item.openedAt, now) >= NORMAL_REPAIR_DAYS) {
      attention.push({
        id: `long:${item.caseId}`,
        severity: 'red',
        messageKey: 'longOpen',
        params: {
          caseNumber: item.caseNumber,
          days: caseAgeDays(item.openedAt, now),
        },
        href: `/cases/${item.caseId}`,
      });
    }
  }

  // Sort: red before yellow, preserve insertion order within.
  attention.sort((a, b) => {
    if (a.severity === b.severity) return 0;
    return a.severity === 'red' ? -1 : 1;
  });

  const flow = [...flowMap.values()].sort((a, b) => {
    if (a.category === b.category) return b.count - a.count;
    if (a.category === 'active') return -1;
    if (b.category === 'active') return 1;
    if (a.category === 'waiting') return -1;
    return 1;
  });

  const pulse: OpsPulse = {
    activeCases: board.filter((b) => b.stateCategory !== 'terminal').length,
    dueToday,
    atRisk,
    segmentsInProgress,
    workingNow: working.length,
    inbound: inbound.length,
    openParts: openParts.length,
  };

  return {
    attention: attention.slice(0, 10),
    flow,
    pulse,
    board,
    holds,
    workingNow: working,
    inboundCount: inbound.length,
    openPartsCount: openParts.length,
  };
}
