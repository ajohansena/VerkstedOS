import { and, desc, eq, isNull, sql } from 'drizzle-orm';

import { withTransaction, type TenantTransaction } from '@/db/client';
import { accountingExportLines } from '@/db/schemas/finance/accounting-export-lines';
import { accountingExports } from '@/db/schemas/finance/accounting-exports';
import { invoiceBasis } from '@/db/schemas/finance/invoice-basis';
import { invoiceBasisLines } from '@/db/schemas/finance/invoice-basis-lines';
import type {
  AccountingExport,
  AccountingExportLine,
  InvoiceBasis,
  InvoiceBasisLine,
} from '@/db/types';
import type { RequestContext } from '@/lib/tenancy/context';

/**
 * Finance read model (Sprint 15). Reads for the invoice-basis surfaces and the
 * Dev accounting-export inspector. No business arithmetic here — totals are
 * computed by the SSoT calcs and stored on the rows.
 */

export interface InvoiceBasisWithLines {
  basis: InvoiceBasis;
  lines: InvoiceBasisLine[];
}

export async function listInvoiceBasesForCase(
  ctx: RequestContext,
  caseId: string,
): Promise<InvoiceBasis[]> {
  return withTransaction(ctx, async (tx) => {
    return tx
      .select()
      .from(invoiceBasis)
      .where(
        and(
          eq(invoiceBasis.organizationId, ctx.organizationId),
          eq(invoiceBasis.caseId, caseId),
          isNull(invoiceBasis.deletedAt),
        ),
      )
      .orderBy(invoiceBasis.basisNumber);
  });
}

export async function findInvoiceBasis(
  ctx: RequestContext,
  basisId: string,
): Promise<InvoiceBasisWithLines | null> {
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
    const basis = rows[0];
    if (!basis) return null;
    const lines = await tx
      .select()
      .from(invoiceBasisLines)
      .where(
        and(
          eq(invoiceBasisLines.invoiceBasisId, basisId),
          eq(invoiceBasisLines.organizationId, ctx.organizationId),
        ),
      );
    return { basis, lines };
  });
}

export async function listApprovedBases(
  ctx: RequestContext,
): Promise<InvoiceBasis[]> {
  return withTransaction(ctx, async (tx) => {
    return tx
      .select()
      .from(invoiceBasis)
      .where(
        and(
          eq(invoiceBasis.organizationId, ctx.organizationId),
          eq(invoiceBasis.status, 'approved'),
          isNull(invoiceBasis.deletedAt),
        ),
      )
      .orderBy(invoiceBasis.basisNumber);
  });
}

export interface AccountingExportWithLines {
  export: AccountingExport;
  lines: AccountingExportLine[];
}

export async function listAccountingExports(
  ctx: RequestContext,
  limit = 50,
): Promise<AccountingExport[]> {
  return withTransaction(ctx, async (tx) => {
    return tx
      .select()
      .from(accountingExports)
      .where(eq(accountingExports.organizationId, ctx.organizationId))
      .orderBy(desc(accountingExports.requestedAt))
      .limit(limit);
  });
}

export async function findAccountingExport(
  ctx: RequestContext,
  exportId: string,
): Promise<AccountingExportWithLines | null> {
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
    if (!exp) return null;
    const lines = await tx
      .select()
      .from(accountingExportLines)
      .where(
        and(
          eq(accountingExportLines.accountingExportId, exportId),
          eq(accountingExportLines.organizationId, ctx.organizationId),
        ),
      );
    return { export: exp, lines };
  });
}

export interface AccountingExportStats {
  total: number;
  pending: number;
  sent: number;
  failed: number;
  acknowledged: number;
}

export async function accountingExportStats(
  ctx: RequestContext,
): Promise<AccountingExportStats> {
  return withTransaction(ctx, async (tx) => {
    const rows = await tx
      .select({
        status: accountingExports.status,
        n: sql<number>`count(*)::int`,
      })
      .from(accountingExports)
      .where(eq(accountingExports.organizationId, ctx.organizationId))
      .groupBy(accountingExports.status);
    const stats: AccountingExportStats = {
      total: 0,
      pending: 0,
      sent: 0,
      failed: 0,
      acknowledged: 0,
    };
    for (const row of rows) {
      const n = Number(row.n);
      stats.total += n;
      if (row.status === 'pending') stats.pending = n;
      else if (row.status === 'sent') stats.sent = n;
      else if (row.status === 'failed') stats.failed = n;
      else if (row.status === 'acknowledged') stats.acknowledged = n;
    }
    return stats;
  });
}

/**
 * Generate the next invoice-basis number for the org, `FG-{YYYY}-{NNNN}`. Uses
 * a per-org yearly count inside the caller's transaction; the unique index on
 * `(organization_id, basis_number)` is the hard guard against collisions.
 */
export async function nextBasisNumber(
  tx: TenantTransaction,
  ctx: RequestContext,
): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `FG-${year}-`;
  const rows = await tx
    .select({ n: sql<number>`count(*)::int` })
    .from(invoiceBasis)
    .where(
      and(
        eq(invoiceBasis.organizationId, ctx.organizationId),
        sql`${invoiceBasis.basisNumber} LIKE ${prefix + '%'}`,
      ),
    );
  const next = Number(rows[0]?.n ?? 0) + 1;
  return `${prefix}${String(next).padStart(4, '0')}`;
}
