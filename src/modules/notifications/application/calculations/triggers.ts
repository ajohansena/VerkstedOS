/**
 * Notification trigger detectors — pure calculations (Sprint 17).
 *
 * Each detector takes a snapshot of relevant facts and returns zero or more
 * `TriggerHit`s. No I/O — the engine gathers the facts and persists the hits.
 * This is the canonical owner for "when does this rule fire?" logic. The same
 * detectors are called from the cron engine AND from the Dev Control Plane
 * "dry-run" tool, guaranteeing the same business rule decides both.
 *
 * Three rules ship in Sprint 17: parts_delay, supplement_pending, delivery_at_risk.
 * Adding a rule = new detector + new default seed; no engine changes.
 */

import type { TriggerHit } from '../../domain/types';

// ---------- parts_delay ----------------------------------------------------

export interface PartsDelayFact {
  readonly caseId: string;
  readonly caseNumber: string;
  readonly workshopId: string | null;
  readonly requirementId: string;
  readonly partName: string;
  readonly flaggedAt: Date;
  /** Whether the requirement has reached a downstream lifecycle state (ordered/received). */
  readonly progressed: boolean;
  readonly recipientUserIds: readonly string[];
}

export interface PartsDelayParams {
  readonly thresholdDays: number;
}

export const PARTS_DELAY_DEFAULTS: PartsDelayParams = { thresholdDays: 3 };

/**
 * Fire when a part has been flagged for `thresholdDays` without progressing
 * to `ordered`. One hit per requirement; deduped by (case, requirement).
 */
export function detectPartsDelay(
  facts: readonly PartsDelayFact[],
  params: PartsDelayParams,
  now: Date,
): TriggerHit[] {
  const thresholdMs = params.thresholdDays * 24 * 60 * 60 * 1000;
  const hits: TriggerHit[] = [];
  for (const fact of facts) {
    if (fact.progressed) continue;
    const ageMs = now.getTime() - fact.flaggedAt.getTime();
    if (ageMs < thresholdMs) continue;
    hits.push({
      ruleCode: 'parts_delay',
      category: 'parts_delay',
      severity: 'warning',
      refType: 'part_requirement',
      refId: fact.requirementId,
      titleKey: 'parts_delay',
      body: `Del «${fact.partName}» på sak ${fact.caseNumber} har ventet over ${params.thresholdDays} dager.`,
      payload: {
        caseId: fact.caseId,
        caseNumber: fact.caseNumber,
        requirementId: fact.requirementId,
        partName: fact.partName,
        days: Math.floor(ageMs / 86400000),
      },
      actionUrl: `/cases/${fact.caseId}#parts`,
      recipientUserIds: fact.recipientUserIds,
      workshopId: fact.workshopId,
    });
  }
  return hits;
}

// ---------- supplement_pending --------------------------------------------

export interface SupplementPendingFact {
  readonly caseId: string;
  readonly caseNumber: string;
  readonly workshopId: string | null;
  readonly supplementId: string;
  readonly raisedAt: Date;
  readonly settled: boolean;
  readonly recipientUserIds: readonly string[];
}

export interface SupplementPendingParams {
  readonly thresholdDays: number;
}

export const SUPPLEMENT_PENDING_DEFAULTS: SupplementPendingParams = {
  thresholdDays: 2,
};

/** Fire when a supplement has been pending more than `thresholdDays`. */
export function detectSupplementPending(
  facts: readonly SupplementPendingFact[],
  params: SupplementPendingParams,
  now: Date,
): TriggerHit[] {
  const thresholdMs = params.thresholdDays * 24 * 60 * 60 * 1000;
  const hits: TriggerHit[] = [];
  for (const fact of facts) {
    if (fact.settled) continue;
    const ageMs = now.getTime() - fact.raisedAt.getTime();
    if (ageMs < thresholdMs) continue;
    hits.push({
      ruleCode: 'supplement_pending',
      category: 'supplement_pending',
      severity: 'warning',
      refType: 'estimate_supplement',
      refId: fact.supplementId,
      titleKey: 'supplement_pending',
      body: `Tilleggsbestilling på sak ${fact.caseNumber} venter på godkjenning (> ${params.thresholdDays} dager).`,
      payload: {
        caseId: fact.caseId,
        caseNumber: fact.caseNumber,
        supplementId: fact.supplementId,
        days: Math.floor(ageMs / 86400000),
      },
      actionUrl: `/cases/${fact.caseId}#estimate`,
      recipientUserIds: fact.recipientUserIds,
      workshopId: fact.workshopId,
    });
  }
  return hits;
}

// ---------- delivery_at_risk ----------------------------------------------

export interface DeliveryAtRiskFact {
  readonly caseId: string;
  readonly caseNumber: string;
  readonly workshopId: string | null;
  readonly promisedAt: Date | null;
  readonly forecastAt: Date | null;
  readonly recipientUserIds: readonly string[];
}

export interface DeliveryAtRiskParams {
  readonly minSlipHours: number;
}

export const DELIVERY_AT_RISK_DEFAULTS: DeliveryAtRiskParams = {
  minSlipHours: 24,
};

/**
 * Fire when the forecast delivery date slips past the promised date by at
 * least `minSlipHours`. Both must be present. One hit per case.
 */
export function detectDeliveryAtRisk(
  facts: readonly DeliveryAtRiskFact[],
  params: DeliveryAtRiskParams,
): TriggerHit[] {
  const thresholdMs = params.minSlipHours * 60 * 60 * 1000;
  const hits: TriggerHit[] = [];
  for (const fact of facts) {
    if (!fact.promisedAt || !fact.forecastAt) continue;
    const slipMs = fact.forecastAt.getTime() - fact.promisedAt.getTime();
    if (slipMs < thresholdMs) continue;
    hits.push({
      ruleCode: 'delivery_at_risk',
      category: 'delivery_at_risk',
      severity: 'critical',
      refType: 'case',
      refId: fact.caseId,
      titleKey: 'delivery_at_risk',
      body: `Sak ${fact.caseNumber}: prognose ${formatDate(fact.forecastAt)} er etter lovet ${formatDate(fact.promisedAt)}.`,
      payload: {
        caseId: fact.caseId,
        caseNumber: fact.caseNumber,
        promisedAt: fact.promisedAt.toISOString(),
        forecastAt: fact.forecastAt.toISOString(),
        slipHours: Math.floor(slipMs / 3600000),
      },
      actionUrl: `/cases/${fact.caseId}`,
      recipientUserIds: fact.recipientUserIds,
      workshopId: fact.workshopId,
    });
  }
  return hits;
}

function formatDate(d: Date): string {
  // Stable, sortable, locale-neutral. UI re-formats per locale.
  return d.toISOString().slice(0, 10);
}
