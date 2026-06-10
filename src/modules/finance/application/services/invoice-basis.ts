import { and, eq, inArray, isNull } from 'drizzle-orm';

import { withTransaction } from '@/db/client';
import { invoiceBasis } from '@/db/schemas/finance/invoice-basis';
import { invoiceBasisLines } from '@/db/schemas/finance/invoice-basis-lines';
import type { InvoiceBasis } from '@/db/types';
import { recordAuditEvent } from '@/lib/audit/audit-writer';
import { emitEvent } from '@/lib/events/outbox';
import type { RequestContext } from '@/lib/tenancy/context';
import { listFundingSources } from '@/modules/case/public';
import { getTotals, listImportsForCase } from '@/modules/estimating/public';
import { requirePermission } from '@/modules/identity/public';

import {
  planInvoiceBases,
  type FundingKind,
  type PlannerFundingSource,
} from '../calculations/plan-invoice-bases';
import { nextBasisNumber } from '../../infrastructure/repositories/finance-repository';

/**
 * Invoice-basis generation & approval (Sprint 15).
 *
 * Generates one InvoiceBasis per active funding source per case from the
 * locked estimate (including the deductible split), via the pure
 * `planInvoiceBases` allocator. Approval locks a basis so it can be exported.
 * All mutations are audited + emit outbox events. `finance:invoice` gates
 * generation/approval; the catalog is reused (no new permission).
 */

function num(value: string | null): number {
  if (value == null) return 0;
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

export interface GenerateResult {
  bases: InvoiceBasis[];
}

export async function generateInvoiceBasisForCase(
  ctx: RequestContext,
  caseId: string,
): Promise<GenerateResult> {
  await requirePermission(ctx, 'finance:invoice');

  const fundingSources = await listFundingSources(ctx, caseId);
  const active = fundingSources.filter((f) => f.status === 'active');
  if (active.length === 0) {
    throw new Error('NO_ACTIVE_FUNDING_SOURCES');
  }

  // Latest locked estimate import (fall back to the highest-version import).
  const imports = await listImportsForCase(ctx, caseId);
  const locked = imports.find((i) => i.status === 'locked') ?? imports[0];
  if (!locked) throw new Error('NO_ESTIMATE');
  const totals = await getTotals(ctx, locked.id);
  if (!totals) throw new Error('NO_ESTIMATE_TOTALS');

  const planned = planInvoiceBases({
    fundingSources: active.map(
      (f): PlannerFundingSource => ({
        id: f.id,
        kind: f.kind as FundingKind,
        sequenceNo: f.sequenceNo,
        deductibleAmount:
          f.deductibleAmount != null ? num(f.deductibleAmount) : null,
        deductiblePayerCustomerId: f.deductiblePayerCustomerId,
        payerCustomerId: f.payerCustomerId,
        payerInsuranceId: f.payerInsuranceId,
      }),
    ),
    estimate: {
      bodyLaborAmount: num(totals.bodyLaborAmount),
      paintLaborAmount: num(totals.paintLaborAmount),
      paintMaterialAmount: num(totals.paintMaterialAmount),
      partsAmount: num(totals.partsAmount),
      externalWorkAmount: num(totals.externalWorkAmount),
      vatRate: totals.vatRate != null ? num(totals.vatRate) : null,
    },
  });

  if (planned.length === 0) throw new Error('NOTHING_TO_INVOICE');

  return withTransaction(ctx, async (tx) => {
    // Refuse if a non-cancelled basis already exists (regenerate = cancel first).
    const existing = await tx
      .select({ id: invoiceBasis.id })
      .from(invoiceBasis)
      .where(
        and(
          eq(invoiceBasis.organizationId, ctx.organizationId),
          eq(invoiceBasis.caseId, caseId),
          isNull(invoiceBasis.deletedAt),
          inArray(invoiceBasis.status, [
            'draft',
            'approved',
            'exported',
            'settled',
          ]),
        ),
      )
      .limit(1);
    if (existing[0]) {
      throw new Error('INVOICE_BASIS_ALREADY_EXISTS');
    }

    const created: InvoiceBasis[] = [];
    for (const plan of planned) {
      const basisNumber = await nextBasisNumber(tx, ctx);
      const inserted = await tx
        .insert(invoiceBasis)
        .values({
          organizationId: ctx.organizationId,
          caseId,
          fundingSourceId: plan.fundingSourceId,
          deductibleOfFundingSourceId: plan.deductibleOfFundingSourceId,
          basisNumber,
          kind: plan.kind,
          payerType: plan.payerType,
          payerCustomerId: plan.payerCustomerId,
          payerInsuranceId: plan.payerInsuranceId,
          netAmount: String(plan.netAmount),
          vatAmount: String(plan.vatAmount),
          grossAmount: String(plan.grossAmount),
          status: 'draft',
          createdBy: ctx.userId,
          updatedBy: ctx.userId,
        })
        .returning();
      const basis = inserted[0];
      if (!basis) throw new Error('Failed to create invoice basis');

      for (const line of plan.lines) {
        await tx.insert(invoiceBasisLines).values({
          organizationId: ctx.organizationId,
          invoiceBasisId: basis.id,
          caseId,
          fundingSourceId: plan.fundingSourceId,
          lineKind: line.lineKind,
          description: line.description,
          quantity: String(line.quantity),
          unitPriceNet: String(line.unitPriceNet),
          vatRate: String(line.vatRate),
          lineNet: String(line.lineNet),
          lineVat: String(line.lineVat),
          lineGross: String(line.lineGross),
          sourceRef: line.sourceRef,
          createdBy: ctx.userId,
          updatedBy: ctx.userId,
        });
      }

      await recordAuditEvent(tx, ctx, {
        entityTable: 'invoice_basis',
        entityId: basis.id,
        action: 'created',
        after: basis,
        metadata: { caseId, kind: plan.kind },
      });
      created.push(basis);
    }

    await emitEvent(tx, ctx, {
      eventType: 'finance.invoice_basis.generated',
      payload: { caseId, basisIds: created.map((b) => b.id) },
    });

    return { bases: created };
  });
}

export async function approveInvoiceBasis(
  ctx: RequestContext,
  basisId: string,
): Promise<InvoiceBasis> {
  await requirePermission(ctx, 'finance:invoice');
  return withTransaction(ctx, async (tx) => {
    const rows = await tx
      .select()
      .from(invoiceBasis)
      .where(
        and(
          eq(invoiceBasis.id, basisId),
          eq(invoiceBasis.organizationId, ctx.organizationId),
        ),
      )
      .limit(1);
    const before = rows[0];
    if (!before) throw new Error('INVOICE_BASIS_NOT_FOUND');
    if (before.status !== 'draft') {
      throw new Error('INVOICE_BASIS_NOT_DRAFT');
    }
    const updated = await tx
      .update(invoiceBasis)
      .set({
        status: 'approved',
        approvedAt: new Date(),
        approvedByUserId: ctx.userId,
        updatedBy: ctx.userId,
        updatedAt: new Date(),
      })
      .where(eq(invoiceBasis.id, basisId))
      .returning();
    const basis = updated[0];
    if (!basis) throw new Error('Failed to approve invoice basis');

    await recordAuditEvent(tx, ctx, {
      entityTable: 'invoice_basis',
      entityId: basis.id,
      action: 'updated',
      before,
      after: basis,
      reason: 'approved',
    });
    await emitEvent(tx, ctx, {
      eventType: 'finance.invoice_basis.approved',
      payload: { basisId: basis.id, caseId: basis.caseId },
    });
    return basis;
  });
}

export async function cancelInvoiceBasis(
  ctx: RequestContext,
  basisId: string,
  reason: string,
): Promise<void> {
  await requirePermission(ctx, 'finance:invoice');
  await withTransaction(ctx, async (tx) => {
    const rows = await tx
      .select()
      .from(invoiceBasis)
      .where(
        and(
          eq(invoiceBasis.id, basisId),
          eq(invoiceBasis.organizationId, ctx.organizationId),
        ),
      )
      .limit(1);
    const before = rows[0];
    if (!before) throw new Error('INVOICE_BASIS_NOT_FOUND');
    if (before.status === 'exported' || before.status === 'settled') {
      throw new Error('INVOICE_BASIS_LOCKED');
    }
    const updated = await tx
      .update(invoiceBasis)
      .set({
        status: 'cancelled',
        updatedBy: ctx.userId,
        updatedAt: new Date(),
      })
      .where(eq(invoiceBasis.id, basisId))
      .returning();

    await recordAuditEvent(tx, ctx, {
      entityTable: 'invoice_basis',
      entityId: basisId,
      action: 'cancelled',
      before,
      after: updated[0],
      reason,
    });
  });
}
