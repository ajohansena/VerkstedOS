import { and, desc, eq } from 'drizzle-orm';

import { withTransaction } from '@/db/client';
import { suppliers } from '@/db/schemas/parts/suppliers';
import { supplierCreditNotes } from '@/db/schemas/parts/supplier-credit-notes';
import { supplierInvoiceLines } from '@/db/schemas/parts/supplier-invoice-lines';
import { supplierInvoices } from '@/db/schemas/parts/supplier-invoices';
import type {
  SupplierCreditNote,
  SupplierInvoice,
  SupplierInvoiceLine,
} from '@/db/types';
import type { RequestContext } from '@/lib/tenancy/context';

/**
 * Supplier invoice reads (Sprint 14 Track F). Powers the /parts invoices
 * drawer. Read-only; no business arithmetic beyond the stored line totals.
 */

export interface SupplierInvoiceListItem {
  invoice: SupplierInvoice;
  supplierName: string | null;
  lineCount: number;
}

export async function listSupplierInvoices(
  ctx: RequestContext,
  limit = 50,
): Promise<SupplierInvoiceListItem[]> {
  return withTransaction(ctx, async (tx) => {
    const rows = await tx
      .select({
        invoice: supplierInvoices,
        supplierName: suppliers.name,
      })
      .from(supplierInvoices)
      .leftJoin(suppliers, eq(suppliers.id, supplierInvoices.supplierId))
      .where(eq(supplierInvoices.organizationId, ctx.organizationId))
      .orderBy(desc(supplierInvoices.invoiceDate))
      .limit(limit);

    const result: SupplierInvoiceListItem[] = [];
    for (const r of rows) {
      const lineRows = await tx
        .select({ id: supplierInvoiceLines.id })
        .from(supplierInvoiceLines)
        .where(
          and(
            eq(supplierInvoiceLines.supplierInvoiceId, r.invoice.id),
            eq(supplierInvoiceLines.organizationId, ctx.organizationId),
          ),
        );
      result.push({
        invoice: r.invoice,
        supplierName: r.supplierName,
        lineCount: lineRows.length,
      });
    }
    return result;
  });
}

export interface SupplierInvoiceDetail {
  invoice: SupplierInvoice;
  supplierName: string | null;
  lines: SupplierInvoiceLine[];
  creditNotes: SupplierCreditNote[];
}

export async function findSupplierInvoice(
  ctx: RequestContext,
  invoiceId: string,
): Promise<SupplierInvoiceDetail | null> {
  return withTransaction(ctx, async (tx) => {
    const rows = await tx
      .select({ invoice: supplierInvoices, supplierName: suppliers.name })
      .from(supplierInvoices)
      .leftJoin(suppliers, eq(suppliers.id, supplierInvoices.supplierId))
      .where(
        and(
          eq(supplierInvoices.id, invoiceId),
          eq(supplierInvoices.organizationId, ctx.organizationId),
        ),
      )
      .limit(1);
    const head = rows[0];
    if (!head) return null;

    const lines = await tx
      .select()
      .from(supplierInvoiceLines)
      .where(
        and(
          eq(supplierInvoiceLines.supplierInvoiceId, invoiceId),
          eq(supplierInvoiceLines.organizationId, ctx.organizationId),
        ),
      );
    const creditNotes = await tx
      .select()
      .from(supplierCreditNotes)
      .where(
        and(
          eq(supplierCreditNotes.supplierInvoiceId, invoiceId),
          eq(supplierCreditNotes.organizationId, ctx.organizationId),
        ),
      )
      .orderBy(desc(supplierCreditNotes.creditNoteDate));

    return {
      invoice: head.invoice,
      supplierName: head.supplierName,
      lines,
      creditNotes,
    };
  });
}
