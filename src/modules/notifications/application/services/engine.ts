/**
 * Notification engine (Sprint 17). Evaluates every enabled rule for an org,
 * upserts notifications for each hit. Called by the Inngest cron and by the
 * Dev surface's "dry-run / evaluate now" tool. Pure orchestration — detectors
 * are pure functions in `application/calculations/triggers.ts`.
 */

import type { RequestContext } from '@/lib/tenancy/context';

import type { NotificationRule } from '@/db/types';
import {
  detectDeliveryAtRisk,
  detectPartsDelay,
  detectSupplementPending,
  DELIVERY_AT_RISK_DEFAULTS,
  PARTS_DELAY_DEFAULTS,
  SUPPLEMENT_PENDING_DEFAULTS,
  type DeliveryAtRiskParams,
  type PartsDelayParams,
  type SupplementPendingParams,
} from '../calculations/triggers';
import {
  listDeliveryAtRiskFacts,
  listOrgRecipients,
  listPartsDelayFacts,
  listSupplementPendingFacts,
} from '../../infrastructure/repositories/notification-fact-repository';
import {
  listRulesForOrg,
  upsertNotification,
} from '../../infrastructure/repositories/notification-repository';
import type { TriggerHit } from '../../domain/types';

export interface EvaluationResult {
  readonly evaluated: number;
  readonly fired: number;
  readonly perRule: Readonly<Record<string, number>>;
}

/**
 * Evaluate all enabled rules for the current org context and upsert
 * notifications. Idempotent: re-running for the same facts UPSERTs the same
 * dedup rows. Returns counts for monitoring.
 */
export async function evaluateNotificationRules(
  ctx: RequestContext,
  now: Date = new Date(),
): Promise<EvaluationResult> {
  const [rules, recipients] = await Promise.all([
    listRulesForOrg(ctx, { enabledOnly: true }),
    listOrgRecipients(ctx),
  ]);
  if (recipients.length === 0) {
    return { evaluated: 0, fired: 0, perRule: {} };
  }

  const perRule: Record<string, number> = {};
  let totalHits = 0;

  for (const rule of rules) {
    const hits = await runRule(ctx, rule, recipients, now);
    perRule[rule.code] = hits.length;
    totalHits += hits.length;
    for (const hit of hits) {
      for (const userId of hit.recipientUserIds) {
        await upsertNotification(ctx, {
          recipientUserId: userId,
          ruleCode: hit.ruleCode,
          category: hit.category,
          severity: hit.severity,
          refType: hit.refType,
          refId: hit.refId ?? null,
          titleKey: hit.titleKey,
          body: hit.body,
          payload: hit.payload,
          actionUrl: hit.actionUrl ?? null,
          workshopId: hit.workshopId ?? null,
        });
      }
    }
  }

  return { evaluated: rules.length, fired: totalHits, perRule };
}

async function runRule(
  ctx: RequestContext,
  rule: NotificationRule,
  recipients: readonly string[],
  now: Date,
): Promise<readonly TriggerHit[]> {
  switch (rule.code) {
    case 'parts_delay': {
      const params = readParams<PartsDelayParams>(rule, PARTS_DELAY_DEFAULTS);
      const facts = await listPartsDelayFacts(ctx, recipients);
      return detectPartsDelay(facts, params, now);
    }
    case 'supplement_pending': {
      const params = readParams<SupplementPendingParams>(
        rule,
        SUPPLEMENT_PENDING_DEFAULTS,
      );
      const facts = await listSupplementPendingFacts(ctx, recipients);
      return detectSupplementPending(facts, params, now);
    }
    case 'delivery_at_risk': {
      const params = readParams<DeliveryAtRiskParams>(
        rule,
        DELIVERY_AT_RISK_DEFAULTS,
      );
      const facts = await listDeliveryAtRiskFacts(ctx, recipients, now);
      return detectDeliveryAtRisk(facts, params);
    }
    default:
      // Unknown rule code — silently skip. Catalog mismatch is caught by
      // `pnpm check:notifications` (added in a later sprint).
      return [];
  }
}

function readParams<T>(rule: NotificationRule, defaults: T): T {
  const raw = (rule.params ?? {}) as Partial<T>;
  return { ...defaults, ...raw } as T;
}
