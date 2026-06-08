import { index, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

import { idColumn } from '@/db/schemas/_shared';

/**
 * Platform impersonation session (docs/06-developer-control-plane.md). When a
 * platform user needs to act inside a customer org for support, they open an
 * impersonation session — fully audited (start + end go to
 * `platform_audit_events`), time-bounded, and reason-required. This table is
 * the authoritative record of who impersonated whom, when, and why.
 *
 * Platform-managed (service-role only); not exposed to tenant RLS.
 */
export const platformImpersonationSessions = pgTable(
  'platform_impersonation_sessions',
  {
    id: idColumn,
    platformUserId: uuid('platform_user_id').notNull(),
    targetOrgId: uuid('target_org_id').notNull(),
    targetUserId: uuid('target_user_id'),
    reason: text('reason').notNull(),
    startedAt: timestamp('started_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    endedAt: timestamp('ended_at', { withTimezone: true }),
  },
  (table) => [
    index('platform_impersonation_sessions_user_idx').on(
      table.platformUserId,
      table.startedAt,
    ),
  ],
);
