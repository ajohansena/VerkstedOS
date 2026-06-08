import { and, desc, eq, isNull } from 'drizzle-orm';

import { withTransaction, type TenantTransaction } from '@/db/client';
import { estimateDocuments } from '@/db/schemas/estimating/estimate-documents';
import { estimateImports } from '@/db/schemas/estimating/estimate-imports';
import { estimateLaborLines } from '@/db/schemas/estimating/estimate-labor-lines';
import { estimateOperations } from '@/db/schemas/estimating/estimate-operations';
import { estimatePaintLines } from '@/db/schemas/estimating/estimate-paint-lines';
import { estimateParts } from '@/db/schemas/estimating/estimate-parts';
import { estimateTotals } from '@/db/schemas/estimating/estimate-totals';
import type {
  EstimateImport,
  EstimateOperation,
  EstimatePaintLine,
  EstimatePart,
  EstimateTotals,
} from '@/db/types';
import type { RequestContext } from '@/lib/tenancy/context';

/**
 * Estimate repository (org-scoped). Writes take a transaction (composed by the
 * import service); reads open their own tenant transaction.
 */

export async function listImportsForCase(
  ctx: RequestContext,
  caseId: string,
): Promise<EstimateImport[]> {
  return withTransaction(ctx, async (tx) => {
    return tx
      .select()
      .from(estimateImports)
      .where(
        and(
          eq(estimateImports.organizationId, ctx.organizationId),
          eq(estimateImports.caseId, caseId),
          isNull(estimateImports.deletedAt),
        ),
      )
      .orderBy(desc(estimateImports.versionNumber));
  });
}

export async function findImportById(
  ctx: RequestContext,
  id: string,
): Promise<EstimateImport | null> {
  return withTransaction(ctx, async (tx) => {
    const rows = await tx
      .select()
      .from(estimateImports)
      .where(
        and(
          eq(estimateImports.id, id),
          eq(estimateImports.organizationId, ctx.organizationId),
        ),
      )
      .limit(1);
    return rows[0] ?? null;
  });
}

export async function listOperations(
  ctx: RequestContext,
  importId: string,
): Promise<EstimateOperation[]> {
  return withTransaction(ctx, async (tx) => {
    return tx
      .select()
      .from(estimateOperations)
      .where(
        and(
          eq(estimateOperations.organizationId, ctx.organizationId),
          eq(estimateOperations.estimateImportId, importId),
        ),
      )
      .orderBy(estimateOperations.sequenceNo);
  });
}

export async function listPaintLines(
  ctx: RequestContext,
  importId: string,
): Promise<EstimatePaintLine[]> {
  return withTransaction(ctx, async (tx) => {
    return tx
      .select()
      .from(estimatePaintLines)
      .where(
        and(
          eq(estimatePaintLines.organizationId, ctx.organizationId),
          eq(estimatePaintLines.estimateImportId, importId),
        ),
      )
      .orderBy(estimatePaintLines.sequenceNo);
  });
}

export async function listParts(
  ctx: RequestContext,
  importId: string,
): Promise<EstimatePart[]> {
  return withTransaction(ctx, async (tx) => {
    return tx
      .select()
      .from(estimateParts)
      .where(
        and(
          eq(estimateParts.organizationId, ctx.organizationId),
          eq(estimateParts.estimateImportId, importId),
        ),
      );
  });
}

export async function getTotals(
  ctx: RequestContext,
  importId: string,
): Promise<EstimateTotals | null> {
  return withTransaction(ctx, async (tx) => {
    const rows = await tx
      .select()
      .from(estimateTotals)
      .where(
        and(
          eq(estimateTotals.organizationId, ctx.organizationId),
          eq(estimateTotals.estimateImportId, importId),
        ),
      )
      .limit(1);
    return rows[0] ?? null;
  });
}

/** Update the funding source on a single operation line (only while unlocked). */
export async function setOperationFunding(
  tx: TenantTransaction,
  ctx: RequestContext,
  operationId: string,
  fundingSourceId: string | null,
): Promise<void> {
  await tx
    .update(estimateOperations)
    .set({ fundingSourceId, updatedBy: ctx.userId, updatedAt: new Date() })
    .where(
      and(
        eq(estimateOperations.id, operationId),
        eq(estimateOperations.organizationId, ctx.organizationId),
      ),
    );
}

/** Re-export the table objects the service needs for inserts. */
export const estimateTables = {
  estimateImports,
  estimateDocuments,
  estimateOperations,
  estimateLaborLines,
  estimatePaintLines,
  estimateParts,
  estimateTotals,
};
