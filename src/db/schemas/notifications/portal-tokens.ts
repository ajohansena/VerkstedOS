import {
  index,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

import { portalTokenScope } from '@/db/enums';
import { idColumn, lifecycleColumns } from '@/db/schemas/_shared';
import { cases } from '@/db/schemas/case/cases';
import { organizations } from '@/db/schemas/identity/organizations';

/**
 * Customer portal access token (Sprint 17). Time-limited, single-case,
 * scoped link the customer receives via SMS/email. Token is a long random
 * URL-safe string (not a JWT). The portal route looks it up server-side via
 * the admin client (no RLS, the token IS the auth), then renders strictly
 * within the case's scope.
 *
 * `used_at` is set on first GET (for status views) or on action completion
 * (for acceptance / signoff scopes). Tokens are not revoked on use — they
 * remain valid until `expires_at` for repeat viewing, unless `revoked_at`.
 */
export const portalTokens = pgTable(
  'portal_tokens',
  {
    id: idColumn,
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    caseId: uuid('case_id')
      .notNull()
      .references(() => cases.id, { onDelete: 'cascade' }),
    scope: portalTokenScope('scope').notNull(),
    /** The opaque token presented in the URL. */
    token: text('token').notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    firstUsedAt: timestamp('first_used_at', { withTimezone: true }),
    lastUsedAt: timestamp('last_used_at', { withTimezone: true }),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    /** Optional address the link was sent to (for audit). */
    sentTo: text('sent_to'),
    ...lifecycleColumns,
  },
  (table) => [
    uniqueIndex('portal_tokens_token_uq').on(table.token),
    index('portal_tokens_case_scope_idx').on(table.caseId, table.scope),
  ],
);
