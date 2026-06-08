import { and, eq, sql } from 'drizzle-orm';

import { withTransaction, getRawClient } from '@/db/client';
import { recordAuditEvent } from '@/lib/audit/audit-writer';
import { emitEvent } from '@/lib/events/outbox';
import { integrationInbox } from '@/db/schemas/estimating/integration-inbox';
import type { EstimateImport } from '@/db/types';
import type { RequestContext } from '@/lib/tenancy/context';
import { requirePermission } from '@/modules/identity/public';

import {
  parseDbsEstimate,
  DbsParseError,
  type ParsedEstimate,
} from '../../infrastructure/adapters/dbs-parser';
import { estimateTables } from '../../infrastructure/repositories/estimate-repository';

/**
 * Estimate import service (ADR-004, rule 4.7).
 *
 * Imports a DBS takst as an IMMUTABLE versioned snapshot. The first import for a
 * case is version 1 (kind=original); supplements/re-estimates create a new
 * version that supersedes the prior one. Locked imports are never edited in
 * place — corrections create a new version.
 *
 * Permission: `estimate:edit` to import/correct, `estimate:lock` to lock.
 */

const {
  estimateImports,
  estimateDocuments,
  estimateOperations,
  estimateLaborLines,
  estimatePaintLines,
  estimateParts,
  estimateTotals,
} = estimateTables;

/** Land a raw DBS payload in the integration inbox (service-role, pre-context). */
export async function receiveDbsPayload(input: {
  organizationId: string | null;
  externalRef?: string | null;
  payload: unknown;
}): Promise<{ inboxId: string }> {
  const db = getRawClient({ as: 'integration' });
  const rows = await db
    .insert(integrationInbox)
    .values({
      organizationId: input.organizationId,
      source: 'dbs',
      messageType: 'sendOppdrag',
      externalRef: input.externalRef ?? null,
      status: 'received',
      payload: input.payload as never,
    })
    .returning({ id: integrationInbox.id });
  const inboxId = rows[0]?.id;
  if (!inboxId) throw new Error('Failed to land DBS payload');
  return { inboxId };
}

/**
 * Import a (normalized) DBS estimate onto a case as a new draft version. If a
 * prior active/locked import exists for the case, the new one is a supplement
 * that will supersede it on lock.
 */
export async function importDbsEstimate(
  ctx: RequestContext,
  input: {
    caseId: string;
    payload: unknown;
    inboxId?: string;
  },
): Promise<EstimateImport> {
  await requirePermission(ctx, 'estimate:edit');

  let parsed: ParsedEstimate;
  try {
    parsed = parseDbsEstimate(input.payload);
  } catch (err) {
    if (err instanceof DbsParseError && input.inboxId) {
      const db = getRawClient({ as: 'integration' });
      await db
        .update(integrationInbox)
        .set({ status: 'failed', parseError: err.message })
        .where(eq(integrationInbox.id, input.inboxId));
    }
    throw err;
  }

  return withTransaction(ctx, async (tx) => {
    // Determine version number + supersession.
    const prior = await tx
      .select({
        id: estimateImports.id,
        versionNumber: estimateImports.versionNumber,
      })
      .from(estimateImports)
      .where(
        and(
          eq(estimateImports.organizationId, ctx.organizationId),
          eq(estimateImports.caseId, input.caseId),
        ),
      )
      .orderBy(sql`${estimateImports.versionNumber} desc`)
      .limit(1);
    const priorImport = prior[0];
    const versionNumber = (priorImport?.versionNumber ?? 0) + 1;

    const insertedImport = await tx
      .insert(estimateImports)
      .values({
        organizationId: ctx.organizationId,
        caseId: input.caseId,
        source: 'dbs',
        kind: versionNumber === 1 ? 'original' : 'supplement',
        status: 'draft',
        versionNumber,
        supersedesId: priorImport?.id ?? null,
        oppdragsId: parsed.oppdragsId,
        skadenr: parsed.skadenr,
        createdBy: ctx.userId,
        updatedBy: ctx.userId,
      })
      .returning();
    const importRow = insertedImport[0];
    if (!importRow) throw new Error('Failed to create estimate import');

    // Document header.
    await tx.insert(estimateDocuments).values({
      organizationId: ctx.organizationId,
      estimateImportId: importRow.id,
      estimateNumber: parsed.document.estimateNumber ?? null,
      workOrderNumber: parsed.document.workOrderNumber ?? null,
      insurerName: parsed.document.insurerName ?? null,
      ownerName: parsed.document.ownerName ?? null,
      damageType: parsed.document.damageType ?? null,
      objectGroup: parsed.document.objectGroup ?? null,
      vehicleDescription: parsed.document.vehicleDescription ?? null,
      vin: parsed.document.vin ?? null,
      registrationNumber: parsed.document.registrationNumber ?? null,
      mileageKm: parsed.document.mileageKm ?? null,
      colourCode: parsed.document.colourCode ?? null,
      normalRepairDays: parsed.document.normalRepairDays ?? null,
      dates: (parsed.document.dates ?? null) as never,
      workshopRef: parsed.document.workshopRef ?? null,
      createdBy: ctx.userId,
      updatedBy: ctx.userId,
    });

    // Operations.
    let seq = 0;
    for (const op of parsed.operations) {
      await tx.insert(estimateOperations).values({
        organizationId: ctx.organizationId,
        estimateImportId: importRow.id,
        category: op.category,
        description: op.description,
        action: op.action ?? null,
        side: op.side ?? null,
        timePeriods: op.timePeriods,
        laborRate: op.laborRate ?? null,
        sequenceNo: seq++,
        createdBy: ctx.userId,
        updatedBy: ctx.userId,
      });
    }

    // Labor detail lines.
    seq = 0;
    for (const ll of parsed.laborLines) {
      await tx.insert(estimateLaborLines).values({
        organizationId: ctx.organizationId,
        estimateImportId: importRow.id,
        position: ll.position ?? null,
        operationCode: ll.operationCode ?? null,
        description: ll.description,
        timePeriods: ll.timePeriods,
        sequenceNo: seq++,
        createdBy: ctx.userId,
        updatedBy: ctx.userId,
      });
    }

    // Paint lines.
    seq = 0;
    for (const pl of parsed.paintLines) {
      await tx.insert(estimatePaintLines).values({
        organizationId: ctx.organizationId,
        estimateImportId: importRow.id,
        description: pl.description,
        isMaterial: pl.isMaterial ? 1 : 0,
        timePeriods: pl.timePeriods,
        laborRate: pl.laborRate ?? null,
        amount: pl.amount ?? null,
        sequenceNo: seq++,
        createdBy: ctx.userId,
        updatedBy: ctx.userId,
      });
    }

    // Parts.
    for (const part of parsed.parts) {
      await tx.insert(estimateParts).values({
        organizationId: ctx.organizationId,
        estimateImportId: importRow.id,
        partNumber: part.partNumber ?? null,
        description: part.description,
        listPrice: part.listPrice ?? null,
        discountFactor: part.discountFactor ?? null,
        amount: part.amount ?? null,
        createdBy: ctx.userId,
        updatedBy: ctx.userId,
      });
    }

    // Totals.
    if (parsed.totals) {
      const t = parsed.totals;
      await tx.insert(estimateTotals).values({
        organizationId: ctx.organizationId,
        estimateImportId: importRow.id,
        bodyLaborPeriods: t.bodyLaborPeriods,
        bodyLaborAmount: t.bodyLaborAmount ?? null,
        panelBeatingPeriods: t.panelBeatingPeriods,
        rustProtectionPeriods: t.rustProtectionPeriods,
        paintLaborPeriods: t.paintLaborPeriods,
        paintLaborAmount: t.paintLaborAmount ?? null,
        paintMaterialAmount: t.paintMaterialAmount ?? null,
        partsAmount: t.partsAmount ?? null,
        externalWorkAmount: t.externalWorkAmount ?? null,
        sumExVat: t.sumExVat ?? null,
        vatRate: t.vatRate === undefined ? null : String(t.vatRate),
        vatAmount: t.vatAmount ?? null,
        totalAmount: t.totalAmount ?? null,
        fixedPriceAgreement: t.fixedPriceAgreement ?? null,
        createdBy: ctx.userId,
        updatedBy: ctx.userId,
      });
    }

    // Mark the inbox row processed, if any.
    if (input.inboxId) {
      await tx
        .update(integrationInbox)
        .set({
          status: 'processed',
          processedAt: new Date(),
          producedImportId: importRow.id,
          organizationId: ctx.organizationId,
        })
        .where(eq(integrationInbox.id, input.inboxId));
    }

    await recordAuditEvent(tx, ctx, {
      action: 'created',
      entityTable: 'estimate_imports',
      entityId: importRow.id,
      after: { caseId: input.caseId, versionNumber, kind: importRow.kind },
    });

    await emitEvent(tx, ctx, {
      eventType: 'estimate.import.created',
      payload: {
        caseId: input.caseId,
        importId: importRow.id,
        versionNumber,
      },
    });

    return importRow;
  });
}

/**
 * Lock an estimate import (immutable from here). Supersedes the prior version
 * if this import has one. Requires `estimate:lock`.
 */
export async function lockEstimate(
  ctx: RequestContext,
  importId: string,
): Promise<void> {
  await requirePermission(ctx, 'estimate:lock');

  await withTransaction(ctx, async (tx) => {
    const rows = await tx
      .select()
      .from(estimateImports)
      .where(
        and(
          eq(estimateImports.id, importId),
          eq(estimateImports.organizationId, ctx.organizationId),
        ),
      )
      .limit(1);
    const importRow = rows[0];
    if (!importRow) throw new Error(`Estimate import ${importId} not found`);
    if (importRow.status === 'locked') {
      throw new Error('ESTIMATE_ALREADY_LOCKED');
    }

    await tx
      .update(estimateImports)
      .set({
        status: 'locked',
        lockedAt: new Date(),
        lockedByUserId: ctx.userId,
        updatedBy: ctx.userId,
        updatedAt: new Date(),
      })
      .where(eq(estimateImports.id, importId));

    // Supersede the prior version, if any.
    if (importRow.supersedesId) {
      await tx
        .update(estimateImports)
        .set({
          status: 'superseded',
          updatedBy: ctx.userId,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(estimateImports.id, importRow.supersedesId),
            eq(estimateImports.organizationId, ctx.organizationId),
          ),
        );
    }

    await recordAuditEvent(tx, ctx, {
      action: 'transitioned',
      entityTable: 'estimate_imports',
      entityId: importId,
      reason: 'Estimate locked',
      after: { status: 'locked' },
    });

    await emitEvent(tx, ctx, {
      eventType: 'estimate.import.locked',
      payload: { importId, caseId: importRow.caseId },
    });

    if (importRow.supersedesId) {
      await emitEvent(tx, ctx, {
        eventType: 'estimate.import.superseded',
        payload: {
          importId: importRow.supersedesId,
          bySupplementId: importId,
        },
      });
    }
  });
}
