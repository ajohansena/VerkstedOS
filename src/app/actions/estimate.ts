'use server';

import { redirect } from 'next/navigation';

import { getSessionContext } from '@/lib/auth/session';
import {
  DbsPdfExtractionError,
  extractDbsEstimateFromPdf,
  importDbsEstimate,
  lockEstimate,
  receiveDbsPayload,
} from '@/modules/estimating/public';

/**
 * Server actions for estimate import & lock (User surface). The service layer
 * enforces estimate:edit / estimate:lock and validates the payload.
 */

export async function importEstimateAction(formData: FormData): Promise<void> {
  const session = await getSessionContext();
  if (!session) redirect('/login');

  const caseId = String(formData.get('caseId') ?? '');
  const rawJson = String(formData.get('payload') ?? '');

  let payload: unknown;
  try {
    payload = JSON.parse(rawJson);
  } catch {
    redirect(
      `/cases/${caseId}/estimate?error=${encodeURIComponent('Invalid JSON')}`,
    );
  }

  // Land the raw payload in the inbox first (audit/replay), then process.
  const { inboxId } = await receiveDbsPayload({
    organizationId: session.context.organizationId,
    payload,
  });

  try {
    await importDbsEstimate(session.context, { caseId, payload, inboxId });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Import failed';
    redirect(`/cases/${caseId}/estimate?error=${encodeURIComponent(message)}`);
  }

  redirect(`/cases/${caseId}/estimate`);
}

/**
 * Import a DBS estimate directly from the workshop's PDF copy of the takst.
 * This is the operator's primary import UX (issue #11 — Workflow Completion
 * batch 1). Flow:
 *   1. Read the uploaded PDF into memory (DBS estimates are small — typically
 *      under 1 MB).
 *   2. Run `extractDbsEstimateFromPdf` to produce the same normalised payload
 *      shape the XML/SOAP transport path produces.
 *   3. Land the extracted payload in `integration_inbox` (raw PDF text +
 *      warnings included for audit/replay → TakstKontroll compat).
 *   4. Hand off to `importDbsEstimate` — same service the JSON-paste path
 *      uses; SSoT preserved.
 *
 * Errors (PDF unreadable / scanned image / schema mismatch) redirect back to
 * the estimate page with a Norwegian operator-friendly message.
 */
export async function importEstimateFromPdfAction(
  formData: FormData,
): Promise<void> {
  const session = await getSessionContext();
  if (!session) redirect('/login');

  const caseId = String(formData.get('caseId') ?? '');
  const file = formData.get('pdf');
  if (!(file instanceof File) || file.size === 0) {
    redirect(
      `/cases/${caseId}/estimate?error=${encodeURIComponent('Velg en DBS-PDF før du laster opp.')}`,
    );
  }
  // Belt: cap file size at 10 MB. DBS PDFs are tiny; anything bigger is
  // either a malformed upload or a hostile payload.
  const MAX_PDF_BYTES = 10 * 1024 * 1024;
  if ((file as File).size > MAX_PDF_BYTES) {
    redirect(
      `/cases/${caseId}/estimate?error=${encodeURIComponent('PDF for stor (maks 10 MB).')}`,
    );
  }

  let payload: unknown;
  let rawText: string;
  let warnings: string[];
  try {
    const buf = new Uint8Array(await (file as File).arrayBuffer());
    const result = await extractDbsEstimateFromPdf(buf);
    payload = result.payload;
    rawText = result.rawText;
    warnings = result.warnings;
  } catch (err) {
    const message =
      err instanceof DbsPdfExtractionError
        ? err.message
        : err instanceof Error
          ? `PDF kunne ikke leses: ${err.message}`
          : 'PDF kunne ikke leses.';
    redirect(`/cases/${caseId}/estimate?error=${encodeURIComponent(message)}`);
  }

  // Persist the extracted payload + raw text + warnings in the integration
  // inbox. `_meta` is embedded inside the payload (the inbox `payload` column
  // is JSONB and immutable for audit). Downstream `parseDbsEstimate` ignores
  // `_meta` (zod strips unknown keys), so the import path is unchanged.
  const augmentedPayload = {
    ...(payload as Record<string, unknown>),
    _meta: {
      source: 'pdf_upload' as const,
      extractedAt: new Date().toISOString(),
      warnings,
      rawText,
    },
  };
  const { inboxId } = await receiveDbsPayload({
    organizationId: session.context.organizationId,
    payload: augmentedPayload,
    source: 'pdf_upload',
    messageType: 'takst_pdf',
  });

  try {
    await importDbsEstimate(session.context, {
      caseId,
      payload: augmentedPayload,
      inboxId,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Import failed';
    redirect(`/cases/${caseId}/estimate?error=${encodeURIComponent(message)}`);
  }

  redirect(`/cases/${caseId}/estimate`);
}

export async function lockEstimateAction(formData: FormData): Promise<void> {
  const session = await getSessionContext();
  if (!session) redirect('/login');

  const caseId = String(formData.get('caseId') ?? '');
  const importId = String(formData.get('importId') ?? '');
  await lockEstimate(session.context, importId);
  redirect(`/cases/${caseId}/estimate`);
}
