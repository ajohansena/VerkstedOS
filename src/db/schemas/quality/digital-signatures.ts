import {
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

import { signatureKind, signatureSignerKind } from '@/db/enums';
import { idColumn } from '@/db/schemas/_shared';
import { cases } from '@/db/schemas/case/cases';
import { organizations } from '@/db/schemas/identity/organizations';

/**
 * Digital signature — a tamper-evident, append-only cryptographic chain
 * (docs/03-data-model.md, docs/04 § Signed agreement). Each signature stores a
 * SHA-256 `payload_hash` of the signed content and a `chain_hash` computed from
 * `sha256(prev_chain_hash + payload_hash + signed_at + signer)`. Because each
 * row's chain hash depends on the previous one (per case), any later tampering
 * with an earlier row breaks every subsequent hash — the chain is verifiable.
 *
 * APPEND-ONLY at the RLS level (INSERT + SELECT only); never updated or deleted.
 * Signatures most commonly back a repair acceptance, a delivery handover, or a
 * rental agreement, optionally linking the signed document / acceptance.
 */
export const digitalSignatures = pgTable(
  'digital_signatures',
  {
    id: idColumn,
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'restrict' }),
    caseId: uuid('case_id')
      .notNull()
      .references(() => cases.id, { onDelete: 'cascade' }),
    kind: signatureKind('kind').notNull(),
    signerKind: signatureSignerKind('signer_kind')
      .notNull()
      .default('customer'),
    signerName: text('signer_name'),
    signerReference: text('signer_reference'),

    /** What was signed — links to a document / acceptance / checklist run. */
    subjectType: varchar('subject_type', { length: 32 }),
    subjectId: uuid('subject_id'),

    /** SHA-256 of the signed content (hex). */
    payloadHash: varchar('payload_hash', { length: 64 }).notNull(),
    /** Chain hash = sha256(prev_chain_hash + payload_hash + signed_at + signer). */
    chainHash: varchar('chain_hash', { length: 64 }).notNull(),
    /** The previous signature's chain hash for this case (null for the first). */
    previousChainHash: varchar('previous_chain_hash', { length: 64 }),
    /** Position in the case's signature chain (0-based). */
    sequenceNo: integer('sequence_no').notNull().default(0),

    /** Free-form evidence (IP, user agent, acceptance method, SMS body). */
    evidence: jsonb('evidence'),

    signedByUserId: uuid('signed_by_user_id'),
    signedAt: timestamp('signed_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index('digital_signatures_case_idx').on(
      table.organizationId,
      table.caseId,
      table.sequenceNo,
    ),
  ],
);
