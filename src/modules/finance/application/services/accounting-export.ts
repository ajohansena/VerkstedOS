import { createHash } from 'node:crypto';

import { and, eq, inArray, isNull } from 'drizzle-orm';

import { withTransaction } from '@/db/client';
import { accountingExportLines } from '@/db/schemas/finance/accounting-export-lines';
import { accountingExports } from '@/db/schemas/finance/accounting-exports';
import { invoiceBasis } from '@/db/schemas/finance/invoice-basis';
import type { AccountingExport } from '@/db/types';
import { recordAuditEvent } from '@/lib/audit/audit-writer';
import { emitEvent } from '@/lib/events/outbox';
import type { RequestContext } from '@/lib/tenancy/context';
import { requirePermission } from '@/modules/identity/public';

import {
  postExportToTripletex,
  type TripletexExportLine,
} from '../../infrastructure/adapters/tripletex-adapter';

/**
 * Accounting export (Sprint 15). Bundles approved invoice bases into an
 * IMMUTABLE export record, snapshots the amounts, pushes to the accounting
 * system (Tripletex), and flips each basis to `exported`. `finance:export`
 * gates the operation. A failed export is retried in place (bumps attempt
 * count) — history is never edited.
 */

function payloadHash(lines: ReadonlyArray<TripletexExportLine>): string {
  const canonical = JSON.stringify(lines);
  return createHash('sha256').update(canonical).digest('hex');
}

export async function exportApprovedBases(
  ctx: RequestContext,
  basisIds?: string[],
): Promise<AccountingExport> {
  await requirePermission(ctx, 'finance:export');

  return withTransaction(ctx, async (tx) => {
    // Resolve the approved bases to export.
    const where =
      basisIds && basisIds.length > 0
        ? and(
            eq(invoiceBasis.organizationId, ctx.organizationId),
            eq(invoiceBasis.status, 'approved'),
            isNull(invoiceBasis.deletedAt),
            inArray(invoiceBasis.id, basisIds),
          )
        : and(
            eq(invoiceBasis.organizationId, ctx.organizationId),
            eq(invoiceBasis.status, 'approved'),
            isNull(invoiceBasis.deletedAt),
          );
    const bases = await tx.select().from(invoiceBasis).where(where);
    if (bases.length === 0) {
      throw new Error('NO_APPROVED_BASES');
    }

    // Create the export header (pending, attempt 1).
    const exportLines: TripletexExportLine[] = bases.map((b) => ({
      basisId: b.id,
      basisNumber: b.basisNumber,
      payerType: b.payerType,
      netAmount: b.netAmount,
      vatAmount: b.vatAmount,
      grossAmount: b.grossAmount,
      currency: b.currency,
    }));
    const hash = payloadHash(exportLines);

    const insertedExport = await tx
      .insert(accountingExports)
      .values({
        organizationId: ctx.organizationId,
        target: 'tripletex',
        status: 'pending',
        requestedByUserId: ctx.userId,
        attemptCount: 1,
        payloadHash: hash,
        createdBy: ctx.userId,
        updatedBy: ctx.userId,
      })
      .returning();
    const exp = insertedExport[0];
    if (!exp) throw new Error('Failed to create accounting export');

    // Snapshot the amounts at send time (immutable lines).
    for (const b of bases) {
      await tx.insert(accountingExportLines).values({
        organizationId: ctx.organizationId,
        accountingExportId: exp.id,
        invoiceBasisId: b.id,
        currency: b.currency,
        netAmount: b.netAmount,
        vatAmount: b.vatAmount,
        grossAmount: b.grossAmount,
        createdBy: ctx.userId,
        updatedBy: ctx.userId,
      });
    }

    // Push to the accounting system.
    const result = await postExportToTripletex({
      exportId: exp.id,
      organizationId: ctx.organizationId,
      lines: exportLines,
    });

    const now = new Date();
    if (result.ok) {
      await tx
        .update(accountingExports)
        .set({
          status: 'acknowledged',
          sentAt: now,
          acknowledgedAt: now,
          externalRef: result.externalRef,
          updatedBy: ctx.userId,
          updatedAt: now,
        })
        .where(eq(accountingExports.id, exp.id));

      // Flip each basis to exported.
      for (const b of bases) {
        await tx
          .update(invoiceBasis)
          .set({
            status: 'exported',
            exportedAt: now,
            updatedBy: ctx.userId,
            updatedAt: now,
          })
          .where(eq(invoiceBasis.id, b.id));
      }
    } else {
      await tx
        .update(accountingExports)
        .set({
          status: 'failed',
          errorMessage: result.error ?? 'EXPORT_FAILED',
          updatedBy: ctx.userId,
          updatedAt: now,
        })
        .where(eq(accountingExports.id, exp.id));
    }

    const finalRows = await tx
      .select()
      .from(accountingExports)
      .where(eq(accountingExports.id, exp.id))
      .limit(1);
    const finalExport = finalRows[0]!;

    await recordAuditEvent(tx, ctx, {
      entityTable: 'accounting_exports',
      entityId: exp.id,
      action: 'created',
      after: finalExport,
      metadata: {
        source: result.source,
        basisCount: bases.length,
        ok: result.ok,
      },
    });
    await emitEvent(tx, ctx, {
      eventType: result.ok
        ? 'finance.accounting_export.sent'
        : 'finance.accounting_export.failed',
      payload: {
        exportId: exp.id,
        source: result.source,
        basisCount: bases.length,
      },
    });

    return finalExport;
  });
}

/**
 * Retry a failed export in place: re-push the same snapshotted lines, bump the
 * attempt count, and update status. Only `failed` exports are retryable.
 */
export async function retryExport(
  ctx: RequestContext,
  exportId: string,
): Promise<AccountingExport> {
  await requirePermission(ctx, 'finance:export');

  return withTransaction(ctx, async (tx) => {
    const rows = await tx
      .select()
      .from(accountingExports)
      .where(
        and(
          eq(accountingExports.id, exportId),
          eq(accountingExports.organizationId, ctx.organizationId),
        ),
      )
      .limit(1);
    const exp = rows[0];
    if (!exp) throw new Error('EXPORT_NOT_FOUND');
    if (exp.status !== 'failed') throw new Error('EXPORT_NOT_RETRYABLE');

    const lineRows = await tx
      .select()
      .from(accountingExportLines)
      .where(
        and(
          eq(accountingExportLines.accountingExportId, exportId),
          eq(accountingExportLines.organizationId, ctx.organizationId),
        ),
      );

    // Resolve basis numbers for the payload.
    const basisIds = lineRows.map((l) => l.invoiceBasisId);
    const baseRows =
      basisIds.length > 0
        ? await tx
            .select()
            .from(invoiceBasis)
            .where(
              and(
                eq(invoiceBasis.organizationId, ctx.organizationId),
                inArray(invoiceBasis.id, basisIds),
              ),
            )
        : [];
    const basisById = new Map(baseRows.map((b) => [b.id, b]));

    const exportLines: TripletexExportLine[] = lineRows.map((l) => ({
      basisId: l.invoiceBasisId,
      basisNumber: basisById.get(l.invoiceBasisId)?.basisNumber ?? '',
      payerType: basisById.get(l.invoiceBasisId)?.payerType ?? '',
      netAmount: l.netAmount,
      vatAmount: l.vatAmount,
      grossAmount: l.grossAmount,
      currency: l.currency,
    }));

    const result = await postExportToTripletex({
      exportId: exp.id,
      organizationId: ctx.organizationId,
      lines: exportLines,
    });

    const now = new Date();
    const before = exp;
    if (result.ok) {
      await tx
        .update(accountingExports)
        .set({
          status: 'acknowledged',
          sentAt: now,
          acknowledgedAt: now,
          externalRef: result.externalRef,
          errorMessage: null,
          attemptCount: exp.attemptCount + 1,
          updatedBy: ctx.userId,
          updatedAt: now,
        })
        .where(eq(accountingExports.id, exp.id));
      for (const id of basisIds) {
        await tx
          .update(invoiceBasis)
          .set({
            status: 'exported',
            exportedAt: now,
            updatedBy: ctx.userId,
            updatedAt: now,
          })
          .where(
            and(eq(invoiceBasis.id, id), eq(invoiceBasis.status, 'approved')),
          );
      }
    } else {
      await tx
        .update(accountingExports)
        .set({
          status: 'failed',
          errorMessage: result.error ?? 'EXPORT_FAILED',
          attemptCount: exp.attemptCount + 1,
          updatedBy: ctx.userId,
          updatedAt: now,
        })
        .where(eq(accountingExports.id, exp.id));
    }

    const finalRows = await tx
      .select()
      .from(accountingExports)
      .where(eq(accountingExports.id, exp.id))
      .limit(1);
    const finalExport = finalRows[0]!;

    await recordAuditEvent(tx, ctx, {
      entityTable: 'accounting_exports',
      entityId: exp.id,
      action: 'updated',
      before,
      after: finalExport,
      reason: 'retry',
      metadata: { source: result.source, ok: result.ok },
    });

    return finalExport;
  });
}
