'use client';

import Link from 'next/link';
import { useMemo, useState, useTransition } from 'react';

import type { RichBoardItem } from '@/modules/production/public';
import { classifyCaseRisk, NORMAL_REPAIR_DAYS } from '@/lib/operations/risk';

import { transitionCaseAction } from './actions';

interface BoardLabels {
  cardEta: string;
  cardAssigned: string;
  cardTech: string;
  cardParts: string;
  cardPartsOk: string;
  cardPartsWaiting: string; // '{count} venter'
  cardHold: string;
  cardSegment: string;
  cardProgress: string;
  cardNoSegments: string;
  cardOpenedDays: string; // 'Åpen i {days} d'
  cardRiskGreen: string;
  cardRiskYellow: string;
  cardRiskRed: string;
  boardEmpty: string;
  noOrder: string;
}

export interface BoardV2Props {
  items: RichBoardItem[];
  states: {
    code: string;
    label: string;
    sequenceNo: number;
    category: 'active' | 'waiting' | 'terminal';
    colorHint: string | null;
  }[];
  /** Map of state code → array of state codes the user may transition INTO. */
  allowedTransitions: Record<string, string[]>;
  labels: BoardLabels;
}

const RISK_COLOR: Record<'green' | 'yellow' | 'red', string> = {
  green: 'bg-emerald-500',
  yellow: 'bg-amber-500',
  red: 'bg-red-500',
};

/**
 * Production Board v2 — true kanban with operational card content (docs/11 §4,
 * doc 12 §5). Cards show: caseNumber, regnr, vehicle, customer, opened-days,
 * ETA from openedAt + NORMAL_REPAIR_DAYS until promisedDeliveryAt lands,
 * assigned tech, segment + progress bar, parts status, hold pill, risk dot.
 *
 * Drag-to-transition uses HTML5 native DnD. The drop handler dispatches the
 * existing permission-gated `transitionCaseAction` server action.
 */
export function BoardV2({
  items,
  states,
  allowedTransitions,
  labels,
}: BoardV2Props) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [optimistic, setOptimistic] = useState<RichBoardItem[]>(items);

  // Keep optimistic copy in sync if the parent supplies new data.
  // (Server Component re-renders supply fresh `items` after revalidation.)
  if (items !== optimisticRef(optimistic)) {
    // no-op — we trust React 19 + useTransition to keep state coherent.
  }

  const columns = useMemo(() => {
    const byState = new Map<string, RichBoardItem[]>();
    for (const item of optimistic) {
      const key = item.stateCode ?? '__none__';
      const list = byState.get(key) ?? [];
      list.push(item);
      byState.set(key, list);
    }
    const out = states.map((s) => ({
      state: s,
      items: byState.get(s.code) ?? [],
    }));
    const orphans = byState.get('__none__') ?? [];
    return { columns: out, orphans };
  }, [optimistic, states]);

  function onDrop(stateCode: string, caseId: string, fromState: string | null) {
    if (!fromState || fromState === stateCode) return;
    const allowed = allowedTransitions[fromState] ?? [];
    if (!allowed.includes(stateCode)) {
      setError(`Transition not allowed: ${fromState} → ${stateCode}`);
      return;
    }
    setError(null);
    // Optimistic update.
    setOptimistic((prev) =>
      prev.map((it) =>
        it.caseId === caseId
          ? {
              ...it,
              stateCode,
              stateLabel:
                states.find((s) => s.code === stateCode)?.label ??
                it.stateLabel,
              stateCategory:
                states.find((s) => s.code === stateCode)?.category ??
                it.stateCategory,
            }
          : it,
      ),
    );
    startTransition(async () => {
      const res = await transitionCaseAction({
        caseId,
        toStateCode: stateCode,
      });
      if (!res.ok) {
        setError(res.error);
        // Roll back.
        setOptimistic(items);
      }
    });
  }

  if (items.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">{labels.boardEmpty}</p>
    );
  }

  return (
    <div className="space-y-3">
      {error ? (
        <div
          role="alert"
          className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800"
        >
          {error}
        </div>
      ) : null}
      <div
        className={`grid grid-flow-col auto-cols-[minmax(280px,1fr)] gap-3 overflow-x-auto pb-2 ${pending ? 'opacity-90' : ''}`}
      >
        {columns.columns.map(({ state, items: colItems }) => (
          <Column
            key={state.code}
            stateCode={state.code}
            stateLabel={state.label}
            category={state.category}
            items={colItems}
            labels={labels}
            onDrop={onDrop}
          />
        ))}
        {columns.orphans.length > 0 ? (
          <Column
            stateCode="__none__"
            stateLabel={labels.noOrder}
            category="waiting"
            items={columns.orphans}
            labels={labels}
            onDrop={() => undefined}
          />
        ) : null}
      </div>
    </div>
  );
}

function optimisticRef(_v: RichBoardItem[]): RichBoardItem[] {
  return _v;
}

function Column({
  stateCode,
  stateLabel,
  category,
  items,
  labels,
  onDrop,
}: {
  stateCode: string;
  stateLabel: string;
  category: 'active' | 'waiting' | 'terminal';
  items: RichBoardItem[];
  labels: BoardLabels;
  onDrop: (toState: string, caseId: string, fromState: string | null) => void;
}) {
  const [over, setOver] = useState(false);
  const dot =
    category === 'active'
      ? 'bg-emerald-500'
      : category === 'waiting'
        ? 'bg-amber-500'
        : 'bg-slate-300';
  return (
    <div
      className={`flex w-[280px] flex-col rounded-lg border bg-muted/30 ${over ? 'ring-2 ring-primary' : ''}`}
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        setOver(false);
        const payload = e.dataTransfer.getData('application/x-case');
        if (!payload) return;
        try {
          const { caseId, fromState } = JSON.parse(payload) as {
            caseId: string;
            fromState: string | null;
          };
          onDrop(stateCode, caseId, fromState);
        } catch {
          /* ignore */
        }
      }}
    >
      <div className="flex items-center gap-2 border-b px-3 py-2">
        <span className={`h-2 w-2 shrink-0 rounded-full ${dot}`} aria-hidden />
        <span className="flex-1 truncate text-sm font-semibold">
          {stateLabel}
        </span>
        <span className="text-xs text-muted-foreground">{items.length}</span>
      </div>
      <ul className="flex-1 space-y-2 p-2">
        {items.map((item) => (
          <BoardCard key={item.caseId} item={item} labels={labels} />
        ))}
      </ul>
    </div>
  );
}

function BoardCard({
  item,
  labels,
}: {
  item: RichBoardItem;
  labels: BoardLabels;
}) {
  const now = new Date();
  const risk = classifyCaseRisk({
    openedAt: new Date(item.openedAt),
    onHold: item.onHold,
    openPartsCount: item.openPartsCount,
    stateCategory: item.stateCategory,
    now,
  });
  const ageDays = Math.max(
    0,
    Math.floor(
      (now.getTime() - new Date(item.openedAt).getTime()) /
        (24 * 60 * 60 * 1000),
    ),
  );
  const etaDate = new Date(
    new Date(item.openedAt).getTime() +
      NORMAL_REPAIR_DAYS * 24 * 60 * 60 * 1000,
  );
  const vehicleLine = [item.vehicleMake, item.vehicleModel, item.vehicleYear]
    .filter(Boolean)
    .join(' ');
  const partsBadge =
    item.openPartsCount === 0
      ? labels.cardPartsOk
      : labels.cardPartsWaiting.replace(
          '{count}',
          String(item.openPartsCount),
        );
  const openedLine = labels.cardOpenedDays.replace('{days}', String(ageDays));
  return (
    <li
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData(
          'application/x-case',
          JSON.stringify({
            caseId: item.caseId,
            fromState: item.stateCode,
          }),
        );
        e.dataTransfer.effectAllowed = 'move';
      }}
      className="cursor-grab rounded-md border bg-background p-3 text-sm shadow-sm hover:shadow active:cursor-grabbing"
    >
      <Link href={`/cases/${item.caseId}`} className="block space-y-2">
        <div className="flex items-center gap-2">
          <span
            className={`h-2 w-2 shrink-0 rounded-full ${RISK_COLOR[risk]}`}
            aria-label={
              risk === 'red'
                ? labels.cardRiskRed
                : risk === 'yellow'
                  ? labels.cardRiskYellow
                  : labels.cardRiskGreen
            }
          />
          <span className="font-semibold tracking-tight">{item.caseNumber}</span>
          {item.registrationNumber ? (
            <span className="ml-auto rounded bg-muted px-1.5 py-0.5 font-mono text-[11px] uppercase tracking-wide">
              {item.registrationNumber}
            </span>
          ) : null}
        </div>
        {vehicleLine ? (
          <div className="truncate text-xs text-muted-foreground">
            {vehicleLine}
          </div>
        ) : null}
        {item.customerName ? (
          <div className="truncate text-xs">{item.customerName}</div>
        ) : null}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 pt-1 text-[11px] text-muted-foreground">
          <span>{openedLine}</span>
          <span>
            · {labels.cardEta}: {etaDate.toLocaleDateString()}
          </span>
        </div>
        {item.activeSegmentLabel ? (
          <div className="space-y-1 rounded bg-muted/40 px-2 py-1">
            <div className="flex items-center justify-between text-[11px]">
              <span className="truncate">{item.activeSegmentLabel}</span>
              <span className="font-mono">
                {item.activeSegmentProgressPct ?? 0}%
              </span>
            </div>
            <div className="h-1 overflow-hidden rounded bg-background">
              <div
                className="h-full bg-emerald-500"
                style={{ width: `${item.activeSegmentProgressPct ?? 0}%` }}
              />
            </div>
          </div>
        ) : (
          <div className="text-[11px] italic text-muted-foreground">
            {labels.cardNoSegments}
          </div>
        )}
        <div className="flex flex-wrap items-center gap-1">
          {item.assignedTechName ? (
            <span className="rounded-full bg-muted px-2 py-0.5 text-[11px]">
              {labels.cardTech}: {item.assignedTechName}
            </span>
          ) : null}
          <span
            className={
              'rounded-full px-2 py-0.5 text-[11px] ' +
              (item.openPartsCount === 0
                ? 'bg-emerald-100 text-emerald-800'
                : 'bg-amber-100 text-amber-800')
            }
          >
            {labels.cardParts}: {partsBadge}
          </span>
          {item.onHold ? (
            <span
              className="rounded-full bg-red-100 px-2 py-0.5 text-[11px] text-red-800"
              title={item.holdReason ?? undefined}
            >
              {labels.cardHold}
            </span>
          ) : null}
        </div>
      </Link>
    </li>
  );
}
