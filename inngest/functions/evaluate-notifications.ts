import { sql } from 'drizzle-orm';

import { inngest } from '@/../inngest/client';
import { getRawClient } from '@/db/client';
import { organizations } from '@/db/schemas/identity/organizations';
import { runWithContext } from '@/lib/tenancy/context';
import { evaluateNotificationRules } from '@/modules/notifications/public';

/**
 * Notification rule evaluation job (Sprint 17).
 *
 * Runs every 15 minutes, enumerates every org, and evaluates all enabled
 * notification rules under that org's tenant context. The detector and
 * upsert flow are idempotent — re-runs UPSERT the same dedup key, refreshing
 * `updatedAt` and re-arming a non-dismissed notification.
 *
 * Per-org failures are logged but do not stop the run for other orgs.
 */

const SYSTEM_USER_ID = '00000000-0000-0000-0000-000000000000';

export const evaluateNotifications = inngest.createFunction(
  { id: 'evaluate-notifications', triggers: [{ cron: '*/15 * * * *' }] },
  async ({ step }) => {
    const orgIds = await step.run('list-orgs', async () => {
      const db = getRawClient({ as: 'admin' });
      const rows = await db
        .select({ id: organizations.id })
        .from(organizations)
        .where(sql`${organizations.deletedAt} is null`);
      return rows.map((r) => r.id);
    });

    let totalFired = 0;
    let totalEvaluated = 0;
    for (const organizationId of orgIds) {
      const result = await step.run(`org-${organizationId}`, async () => {
        const ctx = {
          userId: SYSTEM_USER_ID,
          organizationId,
          workshopId: null,
          accessibleWorkshopIds: [] as string[],
          correlationId: `notif-${organizationId}-${Date.now()}`,
        };
        try {
          return await runWithContext(ctx, () =>
            evaluateNotificationRules(ctx),
          );
        } catch (err) {
          console.error(
            `[notifications] eval failed for ${organizationId}`,
            err,
          );
          return { evaluated: 0, fired: 0, perRule: {} };
        }
      });
      totalEvaluated += result.evaluated;
      totalFired += result.fired;
    }

    return { orgs: orgIds.length, evaluated: totalEvaluated, fired: totalFired };
  },
);
