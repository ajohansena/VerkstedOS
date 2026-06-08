import { and, eq, inArray, sql } from 'drizzle-orm';

import { withTransaction } from '@/db/client';
import { recordAuditEvent } from '@/lib/audit/audit-writer';
import { emitEvent } from '@/lib/events/outbox';
import { supplierCreditNoteLines } from '@/db/schemas/parts/supplier-credit-note-lines';
import { supplierCreditNotes } from '@/db/schemas/parts/supplier-credit-notes';
import { supplierInvoiceLines } from '@/db/schemas/parts/supplier-invoice-lines';
import { supplierInvoices } from '@/db/schemas/parts/supplier-invoices';
import type {
  SupplierCreditNote,
  SupplierInvoice,
  SupplierInvoiceLine,
} from '@/db/types';
import type { RequestContext } from '@/lib/tenancy/context';
import { requirePermission } from '@/modules/identity/public';

/**
 * Supplier invoicing service (Sprint 14 Track F).
 *
 * Creates and books supplier invoices and credit notes. A single invoice can
 * span several cases; each line carries case + funding-source traceability so
 * TakstKontroll (CLAUDE.md § 4.7) holds. All mutations go through audit +
 * outbox. `parts:reconcile` is required for every write (no new permission per
 * the Sprint 14 frozen catalog).
 */

export interface CreateInvoiceInput {
  supplierId: string;
  invoiceNumber: string;
  invoiceDate: Date;
  dueDate?: Date;
  currency?: string;
  note?: string;
}

export async function createSupplierInvoice(
  ctx: RequestContext,
  input: CreateInvoiceInput,
): Promise<SupplierInvoice> {
  await requirePermission(ctx, 'parts:reconcile');
  return withTransaction(ctx, async (tx) => {
    const rows = await tx
      .insert(supplierInvoices)
      .values({
        organizationId: ctx.organizationId,
        supplierId: input.supplierId,
        invoiceNumber: input.invoiceNumber,
        invoiceDate: input.invoiceDate,
        dueDate: input.dueDate ?? null,
        currency: input.currency ?? 'NOK',
        note: input.note ?? null,
        status: 'draft',
        createdBy: ctx.userId,
        updatedBy: ctx.userId,
      })
      .returning();
    const invoice = rows[0];
    if (!invoice) throw new Error('Failed to create supplier invoice');

    await recordAuditEvent(tx, ctx, {
      entityTable: 'supplier_invoices',
      entityId: invoice.id,
      action: 'created',
      after: invoice,
    });
    await emitEvent(tx, ctx, {
      eventType: 'parts.supplier_invoice.created',
      payload: { invoiceId: invoice.id, supplierId: input.supplierId },
    });
    return invoice;
  });
}

export interface AddInvoiceLineInput {
  supplierInvoiceId: string;
  description?: string;
  quantity: number;
  unitPriceNet: number;
  caseId?: string;
  fundingSourceId?: string;
  purchaseOrderLineId?: string;
  partRequirementId?: string;
}

export async function addInvoiceLine(
  ctx: RequestContext,
  input: AddInvoiceLineInput,
): Promise<SupplierInvoiceLine> {
  await requirePermission(ctx, 'parts:reconcile');
  return withTransaction(ctx, async (tx) => {
    const lineNet = round2(input.quantity * input.unitPriceNet);
    const rows = await tx
      .insert(supplierInvoiceLines)
      .values({
        organizationId: ctx.organizationId,
        supplierInvoiceId: input.supplierInvoiceId,
        caseId: input.caseId ?? null,
        fundingSourceId: input.fundingSourceId ?? null,
        purchaseOrderLineId: input.purchaseOrderLineId ?? null,
        partRequirementId: input.partRequirementId ?? null,
        description: input.description ?? null,
        quantity: String(input.quantity),
        unitPriceNet: String(input.unitPriceNet),
        lineNet: String(lineNet),
        createdBy: ctx.userId,
        updatedBy: ctx.userId,
      })
      .returning();
    const line = rows[0];
    if (!line) throw new Error('Failed to add invoice line');

    await recomputeInvoiceTotal(tx, ctx, input.supplierInvoiceId);

    await recordAuditEvent(tx, ctx, {
      entityTable: 'supplier_invoice_lines',
      entityId: line.id,
      action: 'created',
      after: line,
      ...(input.caseId ? { metadata: { caseId: input.caseId } } : {}),
    });
    return line;
  });
}

export async function bookInvoice(
  ctx: RequestContext,
  invoiceId: string,
): Promise<SupplierInvoice> {
  await requirePermission(ctx, 'parts:reconcile');
  return withTransaction(ctx, async (tx) => {
    const before = await loadInvoice(tx, ctx, invoiceId);
    if (!before) throw new Error('SUPPLIER_INVOICE_NOT_FOUND');
    if (before.status !== 'draft') {
      throw new Error('SUPPLIER_INVOICE_NOT_DRAFT');
    }
    const rows = await tx
      .update(supplierInvoices)
      .set({
        status: 'booked',
        bookedAt: new Date(),
        bookedByUserId: ctx.userId,
        updatedBy: ctx.userId,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(supplierInvoices.id, invoiceId),
          eq(supplierInvoices.organizationId, ctx.organizationId),
        ),
      )
      .returning();
    const invoice = rows[0];
    if (!invoice) throw new Error('Failed to book invoice');

    await recordAuditEvent(tx, ctx, {
      entityTable: 'supplier_invoices',
      entityId: invoice.id,
      action: 'updated',
      before,
      after: invoice,
      reason: 'booked',
    });
    await emitEvent(tx, ctx, {
      eventType: 'parts.supplier_invoice.booked',
      payload: { invoiceId: invoice.id },
    });
    return invoice;
  });
}

export interface CreateCreditNoteInput {
  supplierInvoiceId: string;
  creditNoteNumber: string;
  creditNoteDate: Date;
  reason?:
    | 'return'
    | 'price_correction'
    | 'overbilling'
    | 'damaged'
    | 'other';
  currency?: string;
  note?: string;
}

export async function createCreditNote(
  ctx: RequestContext,
  input: CreateCreditNoteInput,
): Promise<SupplierCreditNote> {
  await requirePermission(ctx, 'parts:reconcile');
  return withTransaction(ctx, async (tx) => {
    const invoice = await loadInvoice(tx, ctx, input.supplierInvoiceId);
    if (!invoice) throw new Error('SUPPLIER_INVOICE_NOT_FOUND');

    const rows = await tx
      .insert(supplierCreditNotes)
      .values({
        organizationId: ctx.organizationId,
        supplierInvoiceId: input.supplierInvoiceId,
        creditNoteNumber: input.creditNoteNumber,
        creditNoteDate: input.creditNoteDate,
        reason: input.reason ?? 'other',
        currency: input.currency ?? invoice.currency,
        note: input.note ?? null,
        createdBy: ctx.userId,
        updatedBy: ctx.userId,
      })
      .returning();
    const note = rows[0];
    if (!note) throw new Error('Failed to create credit note');

    await recordAuditEvent(tx, ctx, {
      entityTable: 'supplier_credit_notes',
      entityId: note.id,
      action: 'created',
      after: note,
    });
    await emitEvent(tx, ctx, {
      eventType: 'parts.supplier_credit_note.created',
      payload: { creditNoteId: note.id, invoiceId: input.supplierInvoiceId },
    });
    return note;
  });
}

export interface AddCreditLineInput {
  supplierCreditNoteId: string;
  supplierInvoiceLineId?: string;
  caseId?: string;
  fundingSourceId?: string;
  description?: string;
  quantity: number;
  unitPriceNet: number;
}

export async function addCreditLine(
  ctx: RequestContext,
  input: AddCreditLineInput,
): Promise<void> {
  await requirePermission(ctx, 'parts:reconcile');
  await withTransaction(ctx, async (tx) => {
    const lineNet = round2(input.quantity * input.unitPriceNet);
    const rows = await tx
      .insert(supplierCreditNoteLines)
      .values({
        organizationId: ctx.organizationId,
        supplierCreditNoteId: input.supplierCreditNoteId,
        supplierInvoiceLineId: input.supplierInvoiceLineId ?? null,
        caseId: input.caseId ?? null,
        fundingSourceId: input.fundingSourceId ?? null,
        description: input.description ?? null,
        quantity: String(input.quantity),
        unitPriceNet: String(input.unitPriceNet),
        lineNet: String(lineNet),
        createdBy: ctx.userId,
        updatedBy: ctx.userId,
      })
      .returning();
    const line = rows[0];
    if (!line) throw new Error('Failed to add credit line');

    await recomputeCreditTotalAndFlagInvoice(
      tx,
      ctx,
      input.supplierCreditNoteId,
    );

    await recordAuditEvent(tx, ctx, {
      entityTable: 'supplier_credit_note_lines',
      entityId: line.id,
      action: 'created',
      after: line,
    });
  });
}

// ── helpers ─────────────────────────────────────────────────────────────────

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

async function loadInvoice(
  tx: Parameters<Parameters<typeof withTransaction>[1]>[0],
  ctx: RequestContext,
  invoiceId: string,
): Promise<SupplierInvoice | null> {
  const rows = await tx
    .select()
    .from(supplierInvoices)
    .where(
      and(
        eq(supplierInvoices.id, invoiceId),
        eq(supplierInvoices.organizationId, ctx.organizationId),
      ),
    )
    .limit(1);
  return rows[0] ?? null;
}

async function recomputeInvoiceTotal(
  tx: Parameters<Parameters<typeof withTransaction>[1]>[0],
  ctx: RequestContext,
  invoiceId: string,
): Promise<void> {
  const totalRows = await tx
    .select({
      total: sql<string>`coalesce(sum(${supplierInvoiceLines.lineNet}), 0)`,
    })
    .from(supplierInvoiceLines)
    .where(
      and(
        eq(supplierInvoiceLines.supplierInvoiceId, invoiceId),
        eq(supplierInvoiceLines.organizationId, ctx.organizationId),
      ),
    );
  const total = totalRows[0]?.total ?? '0';
  await tx
    .update(supplierInvoices)
    .set({ totalGross: total, updatedBy: ctx.userId, updatedAt: new Date() })
    .where(
      and(
        eq(supplierInvoices.id, invoiceId),
        eq(supplierInvoices.organizationId, ctx.organizationId),
      ),
    );
}

async function recomputeCreditTotalAndFlagInvoice(
  tx: Parameters<Parameters<typeof withTransaction>[1]>[0],
  ctx: RequestContext,
  creditNoteId: string,
): Promise<void> {
  const totalRows = await tx
    .select({
      total: sql<string>`coalesce(sum(${supplierCreditNoteLines.lineNet}), 0)`,
      invoiceId: supplierCreditNotes.supplierInvoiceId,
    })
    .from(supplierCreditNoteLines)
    .innerJoin(
      supplierCreditNotes,
      eq(supplierCreditNotes.id, supplierCreditNoteLines.supplierCreditNoteId),
    )
    .where(
      and(
        eq(supplierCreditNoteLines.supplierCreditNoteId, creditNoteId),
        eq(supplierCreditNoteLines.organizationId, ctx.organizationId),
      ),
    )
    .groupBy(supplierCreditNotes.supplierInvoiceId);

  const row = totalRows[0];
  if (!row) return;

  await tx
    .update(supplierCreditNotes)
    .set({ totalGross: row.total, updatedBy: ctx.userId, updatedAt: new Date() })
    .where(
      and(
        eq(supplierCreditNotes.id, creditNoteId),
        eq(supplierCreditNotes.organizationId, ctx.organizationId),
      ),
    );

  // Mark the invoice credited (any credit applied flips status).
  await tx
    .update(supplierInvoices)
    .set({ status: 'credited', updatedBy: ctx.userId, updatedAt: new Date() })
    .where(
      and(
        eq(supplierInvoices.id, row.invoiceId),
        eq(supplierInvoices.organizationId, ctx.organizationId),
        inArray(supplierInvoices.status, ['booked', 'matched']),
      ),
    );
}
