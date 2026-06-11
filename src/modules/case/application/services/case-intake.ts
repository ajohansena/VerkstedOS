import { withTransaction } from '@/db/client';
import { recordAuditEvent } from '@/lib/audit/audit-writer';
import { emitEvent } from '@/lib/events/outbox';
import type { Case } from '@/db/types';
import type { RequestContext } from '@/lib/tenancy/context';
import { requirePermission } from '@/modules/identity/public';
import { ensureProductionOrderInTx } from '@/modules/production/public';

import {
  createCaseSchema,
  validateFundingSet,
  type CreateCaseInput,
  type FundingSourceInput,
} from '../../domain/case';
import { nextCaseNumber } from '../../infrastructure/repositories/case-number';
import {
  insertCase,
  insertFundingSource,
  insertInsuranceClaim,
  type FundingSourceRow,
} from '../../infrastructure/repositories/case-repository';

/**
 * Case intake (docs/03-data-model.md, ADR-013). Creates the case, any needed
 * insurance claims, and all funding sources in ONE transaction — permission-
 * checked, fully audited, event-emitting. The multi-funding invariants are
 * validated up front (domain rules).
 *
 * A `ProductionOrder` is created in the SAME transaction (CLAUDE.md § 4.4,
 * doc 10 § ProductionOrder, doc 13 § 20.4). The Case ↔ ProductionOrder
 * relationship is intrinsically 1:1; the planner, Operations Center and every
 * production read assumes the order exists. Lazy `ensureProductionOrder` calls
 * remain valid for upgrade paths but no new code path should rely on them.
 */

function toMoney(amount: number | undefined): string | null {
  return amount === undefined ? null : amount.toFixed(2);
}

export async function createCase(
  ctx: RequestContext,
  rawInput: CreateCaseInput,
): Promise<Case> {
  await requirePermission(ctx, 'case:edit');
  const input = createCaseSchema.parse(rawInput);

  const problems = validateFundingSet(input.fundingSources);
  if (problems.length > 0) {
    throw new Error(`INVALID_FUNDING:${problems.join(' | ')}`);
  }

  return withTransaction(ctx, async (tx) => {
    const caseNumber = await nextCaseNumber(tx, ctx);

    const created = await insertCase(tx, ctx, {
      caseNumber,
      vehicleId: input.vehicleId ?? null,
      primaryCustomerId: input.primaryCustomerId ?? null,
      incidentTag: input.incidentTag ?? null,
      currentWorkshopId: input.currentWorkshopId ?? null,
      parentCaseId: input.parentCaseId ?? null,
    });

    // Funding sources (create claims as needed).
    let seq = 1;
    for (const fs of input.fundingSources) {
      const row = await materializeFunding(tx, ctx, fs);
      await insertFundingSource(tx, ctx, created.id, seq, row);
      seq += 1;
    }

    await recordAuditEvent(tx, ctx, {
      action: 'created',
      entityTable: 'cases',
      entityId: created.id,
      after: {
        caseNumber: created.caseNumber,
        fundingSourceCount: input.fundingSources.length,
      },
    });

    await emitEvent(tx, ctx, {
      eventType: 'case.case.created',
      payload: {
        caseId: created.id,
        caseNumber: created.caseNumber,
        fundingSourceCount: input.fundingSources.length,
      },
    });

    // Intrinsic ProductionOrder: every Case has exactly one (doc 10, doc 13
    // § 20.4). Done in the same tx so the planner / Ops Center / workflow
    // reads see the case immediately.
    await ensureProductionOrderInTx(tx, ctx, created.id);

    return created;
  });
}

/** Map a funding-source input to a persistable row, creating a claim if needed. */
async function materializeFunding(
  tx: Parameters<typeof insertCase>[0],
  ctx: RequestContext,
  fs: FundingSourceInput,
): Promise<FundingSourceRow> {
  let insuranceClaimId = fs.insuranceClaimId ?? null;

  if (fs.kind === 'insurance' && !insuranceClaimId && fs.newClaim) {
    const claim = await insertInsuranceClaim(tx, ctx, {
      claimNumber: fs.newClaim.claimNumber ?? null,
      insuranceCompanyId: fs.newClaim.insuranceCompanyId ?? null,
    });
    insuranceClaimId = claim.id;
  }

  return {
    kind: fs.kind,
    label: fs.label,
    insuranceClaimId,
    payerCustomerId: fs.payerCustomerId ?? null,
    payerInsuranceId: fs.payerInsuranceId ?? null,
    deductibleAmount: toMoney(fs.deductibleAmount),
    deductiblePayerCustomerId: fs.deductiblePayerCustomerId ?? null,
    coverageCapAmount: toMoney(fs.coverageCapAmount),
    referencesCaseId: fs.referencesCaseId ?? null,
    reworkReason: fs.reworkReason ?? null,
    reworkOwnerWorkshopId: fs.reworkOwnerWorkshopId ?? null,
    notes: fs.notes ?? null,
  };
}

/**
 * Add a funding source to an existing case (Add-funding flow). Validated,
 * audited, event-emitting.
 */
export async function addFundingSource(
  ctx: RequestContext,
  caseId: string,
  fs: FundingSourceInput,
  nextSequenceNo: number,
): Promise<void> {
  await requirePermission(ctx, 'case:edit');

  const problems = validateFundingSet([fs]);
  if (problems.length > 0) {
    throw new Error(`INVALID_FUNDING:${problems.join(' | ')}`);
  }

  await withTransaction(ctx, async (tx) => {
    const row = await materializeFunding(tx, ctx, fs);
    const inserted = await insertFundingSource(
      tx,
      ctx,
      caseId,
      nextSequenceNo,
      row,
    );

    await recordAuditEvent(tx, ctx, {
      action: 'created',
      entityTable: 'case_funding_sources',
      entityId: inserted.id,
      after: { caseId, kind: fs.kind, label: fs.label },
    });

    await emitEvent(tx, ctx, {
      eventType: 'case.funding_source.added',
      payload: { caseId, fundingSourceId: inserted.id, kind: fs.kind },
    });
  });
}
