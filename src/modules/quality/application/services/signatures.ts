import { and, asc, desc, eq } from 'drizzle-orm';

import { getRawClient, withTransaction } from '@/db/client';
import { recordAuditEvent } from '@/lib/audit/audit-writer';
import { emitEvent } from '@/lib/events/outbox';
import { digitalSignatures } from '@/db/schemas/quality/digital-signatures';
import type { DigitalSignature } from '@/db/types';
import type { RequestContext } from '@/lib/tenancy/context';
import { requirePermission } from '@/modules/identity/public';

import {
  computeChainHash,
  hashPayload,
  verifyChain,
  type VerifyResult,
} from '../calculations/signature-chain';

/**
 * Digital signatures — append a tamper-evident link to a case's signature chain
 * (docs/03-data-model.md, docs/04). Used to seal a repair acceptance, a
 * delivery handover, or a rental agreement. `case:edit` to sign; the chain is
 * read for verification. Append-only at the DB level.
 */

export interface SignInput {
  caseId: string;
  kind: DigitalSignature['kind'];
  signerKind?: DigitalSignature['signerKind'];
  signerName?: string;
  signerReference?: string;
  /** The content being sealed (serialized) — its SHA-256 is stored. */
  payload: string;
  subjectType?: string;
  subjectId?: string;
  evidence?: Record<string, unknown>;
}

/** Append a signature to the case chain (computes payload + chain hash). */
export async function appendSignature(
  ctx: RequestContext,
  input: SignInput,
): Promise<DigitalSignature> {
  await requirePermission(ctx, 'case:edit');

  return withTransaction(ctx, async (tx) => {
    const prevRows = await tx
      .select()
      .from(digitalSignatures)
      .where(
        and(
          eq(digitalSignatures.organizationId, ctx.organizationId),
          eq(digitalSignatures.caseId, input.caseId),
        ),
      )
      .orderBy(desc(digitalSignatures.sequenceNo))
      .limit(1);
    const prev = prevRows[0];

    const signedAt = new Date();
    const signedAtIso = signedAt.toISOString();
    const signer =
      input.signerName ??
      input.signerReference ??
      input.signerKind ??
      'customer';
    const payloadHash = hashPayload(input.payload);
    const previousChainHash = prev?.chainHash ?? null;
    const chainHash = computeChainHash({
      previousChainHash,
      payloadHash,
      signedAtIso,
      signer,
    });
    const sequenceNo = (prev?.sequenceNo ?? -1) + 1;

    const inserted = await tx
      .insert(digitalSignatures)
      .values({
        organizationId: ctx.organizationId,
        caseId: input.caseId,
        kind: input.kind,
        signerKind: input.signerKind ?? 'customer',
        signerName: input.signerName ?? null,
        signerReference: input.signerReference ?? null,
        subjectType: input.subjectType ?? null,
        subjectId: input.subjectId ?? null,
        payloadHash,
        chainHash,
        previousChainHash,
        sequenceNo,
        evidence: (input.evidence ?? null) as never,
        signedByUserId: ctx.userId,
        signedAt,
      })
      .returning();
    const signature = inserted[0];
    if (!signature) throw new Error('Failed to append signature');

    await recordAuditEvent(tx, ctx, {
      action: 'created',
      entityTable: 'digital_signatures',
      entityId: signature.id,
      after: { caseId: input.caseId, kind: input.kind, sequenceNo },
    });

    await emitEvent(tx, ctx, {
      eventType: 'quality.signature.appended',
      payload: {
        caseId: input.caseId,
        signatureId: signature.id,
        kind: input.kind,
      },
    });

    return signature;
  });
}

export async function listSignatures(
  ctx: RequestContext,
  caseId: string,
): Promise<DigitalSignature[]> {
  await requirePermission(ctx, 'case:view');
  return withTransaction(ctx, async (tx) => {
    return tx
      .select()
      .from(digitalSignatures)
      .where(
        and(
          eq(digitalSignatures.organizationId, ctx.organizationId),
          eq(digitalSignatures.caseId, caseId),
        ),
      )
      .orderBy(asc(digitalSignatures.sequenceNo));
  });
}

/** Verify the integrity of a case's signature chain (tamper detection). */
export async function verifyCaseChain(
  ctx: RequestContext,
  caseId: string,
): Promise<VerifyResult> {
  const signatures = await listSignatures(ctx, caseId);
  return verifyChain(
    signatures.map((s) => ({
      sequenceNo: s.sequenceNo,
      payloadHash: s.payloadHash,
      chainHash: s.chainHash,
      previousChainHash: s.previousChainHash,
      signedAtIso: s.signedAt.toISOString(),
      signer: s.signerName ?? s.signerReference ?? s.signerKind,
    })),
  );
}

/** Cross-org verification for the Dev surface (service-role connection). */
export async function verifyCaseChainAdmin(
  organizationId: string,
  caseId: string,
): Promise<VerifyResult> {
  const db = getRawClient({ as: 'platform-inspector' });
  const signatures = await db
    .select()
    .from(digitalSignatures)
    .where(
      and(
        eq(digitalSignatures.organizationId, organizationId),
        eq(digitalSignatures.caseId, caseId),
      ),
    )
    .orderBy(asc(digitalSignatures.sequenceNo));
  return verifyChain(
    signatures.map((s) => ({
      sequenceNo: s.sequenceNo,
      payloadHash: s.payloadHash,
      chainHash: s.chainHash,
      previousChainHash: s.previousChainHash,
      signedAtIso: s.signedAt.toISOString(),
      signer: s.signerName ?? s.signerReference ?? s.signerKind,
    })),
  );
}
