import { sql } from 'drizzle-orm';

import { inngest } from '@/../inngest/client';
import { getRawClient } from '@/db/client';
import { organizations } from '@/db/schemas/identity/organizations';
import { runWithContext } from '@/lib/tenancy/context';
import { computeRolling30Snapshots } from '@/modules/dashboards/public';

/**
 * Nightly KPI snapshot job (docs/11-dashboards.md, Sprint 16).
 *
 * Runs once a night, enumerates every organization, and recomputes the
 * rolling-30 KPI snapshots for each under its own tenant context (so RLS and
 * audit attribution hold). Every value flows through the registered SSoT
 * calculations — this job persists, it never re-derives.
 *
 * Re-runs UPSERT the period's snapshot, so a manual re-trigger corrects rather
 * than duplicates.
 */

/** Fixed system actor for job-written rows (no human in the loop). */
const SYSTEM_USER_ID = '00000000-0000-0000-0000-000000000000';

export const computeKpiSnapshots = inngest.createFunction(
  { id: 'compute-kpi-snapshots', triggers: [{ cron: '0 2 * * *' }] },
  async ({ step }) => {
    const orgIds = await step.run('list-orgs', async () => {
      const db = getRawClient({ as: 'admin' });
      const rows = await db
        .select({ id: organizations.id })
        .from(organizations)
        .where(sql`${organizations.deletedAt} is null`);
      return rows.map((r) => r.id);
    });

    let totalSnapshots = 0;
    for (const organizationId of orgIds) {
      const computed = await step.run(`org-${organizationId}`, async () => {
        const ctx = {
          userId: SYSTEM_USER_ID,
          organizationId,
          workshopId: null,
          accessibleWorkshopIds: [] as string[],
          correlationId: `kpi-nightly-${organizationId}`,
        };
        const result = await runWithContext(ctx, () =>
          computeRolling30Snapshots(ctx),
        );
        return result.computed;
      });
      totalSnapshots += computed;
    }

    return { orgs: orgIds.length, snapshots: totalSnapshots };
  },
);
