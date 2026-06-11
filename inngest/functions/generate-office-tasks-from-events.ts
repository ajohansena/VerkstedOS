import { and, gte, sql } from 'drizzle-orm';

import { inngest } from '@/../inngest/client';
import { getRawClient } from '@/db/client';
import { organizations } from '@/db/schemas/identity/organizations';
import { outboxEvents } from '@/db/schemas/audit/outbox-events';
import { runWithContext } from '@/lib/tenancy/context';
import { evaluateAndGenerate } from '@/modules/workforce/public';

/**
 * Office-task generator (D3 Phase F, doc 13 § 16.1).
 *
 * Cron every 5 minutes:
 *   1. List every org with a non-empty published outbox window
 *   2. For each org, scan published outbox events in the last 30 minutes
 *   3. For each event, run `evaluateAndGenerate` under that org's tenant ctx
 *
 * Idempotency is enforced at the database level by the partial unique index
 * `office_tasks_template_event_unique` (migration 0054) — re-running the same
 * window is a no-op for tasks already created.
 *
 * Window choice: 30 min back gives generous slack against publisher delays
 * while the unique-index protects against duplicates. If the cron is paused
 * for >30 min, missed events would need a manual replay (future: dev tool).
 */

const SYSTEM_USER_ID = '00000000-0000-0000-0000-000000000000';
const LOOKBACK_MINUTES = 30;

export const generateOfficeTasksFromEvents = inngest.createFunction(
  {
    id: 'generate-office-tasks-from-events',
    triggers: [{ cron: '*/5 * * * *' }],
  },
  async ({ step }) => {
    const orgIds = await step.run('list-orgs', async () => {
      const db = getRawClient({ as: 'admin' });
      const rows = await db
        .select({ id: organizations.id })
        .from(organizations)
        .where(sql`${organizations.deletedAt} is null`);
      return rows.map((r) => r.id);
    });

    let totalTasksCreated = 0;
    let totalEventsProcessed = 0;
    let totalDuplicatesSkipped = 0;

    for (const organizationId of orgIds) {
      const orgResult = await step.run(`org-${organizationId}`, async () => {
        const ctx = {
          userId: SYSTEM_USER_ID,
          organizationId,
          workshopId: null,
          accessibleWorkshopIds: [] as string[],
          correlationId: `office-task-gen-${organizationId}-${Date.now()}`,
        };
        try {
          const db = getRawClient({ as: 'admin' });
          const cutoff = new Date(
            Date.now() - LOOKBACK_MINUTES * 60_000,
          );
          const events = await db
            .select({
              id: outboxEvents.id,
              eventType: outboxEvents.eventType,
              organizationId: outboxEvents.organizationId,
              payload: outboxEvents.payload,
              occurredAt: outboxEvents.occurredAt,
              correlationId: outboxEvents.correlationId,
            })
            .from(outboxEvents)
            .where(
              and(
                sql`${outboxEvents.organizationId} = ${organizationId}`,
                sql`${outboxEvents.status} = 'published'`,
                gte(outboxEvents.occurredAt, cutoff),
              ),
            );

          let tasksCreated = 0;
          let duplicatesSkipped = 0;
          for (const event of events) {
            if (!event.organizationId) continue;
            const result = await runWithContext(ctx, () =>
              evaluateAndGenerate(ctx, {
                eventId: event.id,
                organizationId: event.organizationId!,
                eventType: event.eventType,
                payload: event.payload as Record<string, unknown> | null,
                occurredAt: event.occurredAt,
                correlationId: event.correlationId,
              }),
            );
            tasksCreated += result.tasksCreated;
            duplicatesSkipped += result.duplicatesSkipped;
          }
          return {
            eventsProcessed: events.length,
            tasksCreated,
            duplicatesSkipped,
          };
        } catch (err) {
          console.error(
            `[office-task-gen] failed for ${organizationId}`,
            err,
          );
          return { eventsProcessed: 0, tasksCreated: 0, duplicatesSkipped: 0 };
        }
      });
      totalEventsProcessed += orgResult.eventsProcessed;
      totalTasksCreated += orgResult.tasksCreated;
      totalDuplicatesSkipped += orgResult.duplicatesSkipped;
    }

    return {
      orgs: orgIds.length,
      eventsProcessed: totalEventsProcessed,
      tasksCreated: totalTasksCreated,
      duplicatesSkipped: totalDuplicatesSkipped,
    };
  },
);
