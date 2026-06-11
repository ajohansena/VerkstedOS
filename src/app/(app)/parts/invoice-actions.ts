'use server';

import { revalidatePath } from 'next/cache';

import { getSessionContext } from '@/lib/auth/session';
import {
  addCreditLine,
  addInvoiceLine,
  bookInvoice,
  createCreditNote,
  createSupplierInvoice,
} from '@/modules/parts/public';

type ActionResult = { ok: true; id?: string } | { ok: false; error: string };

function parseNumber(value: FormDataEntryValue | null): number {
  const n = Number(String(value ?? '').replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
}

/** Create a draft supplier invoice (Track F). `parts:reconcile` gated. */
export async function createSupplierInvoiceAction(
  formData: FormData,
): Promise<ActionResult> {
  try {
    const session = await getSessionContext();
    if (!session) return { ok: false, error: 'NOT_AUTHENTICATED' };
    const supplierId = String(formData.get('supplierId') ?? '');
    const invoiceNumber = String(formData.get('invoiceNumber') ?? '').trim();
    const invoiceDateRaw = String(formData.get('invoiceDate') ?? '');
    if (!supplierId || !invoiceNumber || !invoiceDateRaw) {
      return { ok: false, error: 'MISSING_FIELDS' };
    }
    const dueRaw = String(formData.get('dueDate') ?? '');
    const invoice = await createSupplierInvoice(session.context, {
      supplierId,
      invoiceNumber,
      invoiceDate: new Date(invoiceDateRaw),
      ...(dueRaw ? { dueDate: new Date(dueRaw) } : {}),
      ...(formData.get('note') ? { note: String(formData.get('note')) } : {}),
    });
    revalidatePath('/parts');
    return { ok: true, id: invoice.id };
  } catch (err) {
    return { ok: false, error: errMsg(err) };
  }
}

/** Add a line to a supplier invoice, preserving case + funding traceability. */
export async function addInvoiceLineAction(
  formData: FormData,
): Promise<ActionResult> {
  try {
    const session = await getSessionContext();
    if (!session) return { ok: false, error: 'NOT_AUTHENTICATED' };
    const supplierInvoiceId = String(formData.get('supplierInvoiceId') ?? '');
    if (!supplierInvoiceId) return { ok: false, error: 'MISSING_INVOICE' };
    const line = await addInvoiceLine(session.context, {
      supplierInvoiceId,
      quantity: parseNumber(formData.get('quantity')),
      unitPriceNet: parseNumber(formData.get('unitPriceNet')),
      ...(formData.get('description')
        ? { description: String(formData.get('description')) }
        : {}),
      ...(formData.get('caseId')
        ? { caseId: String(formData.get('caseId')) }
        : {}),
      ...(formData.get('fundingSourceId')
        ? { fundingSourceId: String(formData.get('fundingSourceId')) }
        : {}),
      ...(formData.get('purchaseOrderLineId')
        ? { purchaseOrderLineId: String(formData.get('purchaseOrderLineId')) }
        : {}),
    });
    revalidatePath('/parts');
    return { ok: true, id: line.id };
  } catch (err) {
    return { ok: false, error: errMsg(err) };
  }
}

/** Post a draft invoice to the ledger. */
export async function bookInvoiceAction(
  formData: FormData,
): Promise<ActionResult> {
  try {
    const session = await getSessionContext();
    if (!session) return { ok: false, error: 'NOT_AUTHENTICATED' };
    const invoiceId = String(formData.get('invoiceId') ?? '');
    if (!invoiceId) return { ok: false, error: 'MISSING_INVOICE' };
    await bookInvoice(session.context, invoiceId);
    revalidatePath('/parts');
    return { ok: true };
  } catch (err) {
    return { ok: false, error: errMsg(err) };
  }
}

/** Create a credit note against an invoice, then add a single reversal line. */
export async function createCreditNoteAction(
  formData: FormData,
): Promise<ActionResult> {
  try {
    const session = await getSessionContext();
    if (!session) return { ok: false, error: 'NOT_AUTHENTICATED' };
    const supplierInvoiceId = String(formData.get('supplierInvoiceId') ?? '');
    const creditNoteNumber = String(
      formData.get('creditNoteNumber') ?? '',
    ).trim();
    const dateRaw = String(formData.get('creditNoteDate') ?? '');
    if (!supplierInvoiceId || !creditNoteNumber || !dateRaw) {
      return { ok: false, error: 'MISSING_FIELDS' };
    }
    const reason = String(formData.get('reason') ?? 'other') as
      | 'return'
      | 'price_correction'
      | 'overbilling'
      | 'damaged'
      | 'other';
    const note = await createCreditNote(session.context, {
      supplierInvoiceId,
      creditNoteNumber,
      creditNoteDate: new Date(dateRaw),
      reason,
    });
    const qty = parseNumber(formData.get('quantity'));
    const price = parseNumber(formData.get('unitPriceNet'));
    if (qty > 0) {
      await addCreditLine(session.context, {
        supplierCreditNoteId: note.id,
        quantity: qty,
        unitPriceNet: price,
        ...(formData.get('description')
          ? { description: String(formData.get('description')) }
          : {}),
        ...(formData.get('caseId')
          ? { caseId: String(formData.get('caseId')) }
          : {}),
      });
    }
    revalidatePath('/parts');
    return { ok: true, id: note.id };
  } catch (err) {
    return { ok: false, error: errMsg(err) };
  }
}

function errMsg(err: unknown): string {
  return err instanceof Error ? err.message : 'UNKNOWN_ERROR';
}
