import { inngest } from '@/../inngest/client';
import { publishPendingOutbox } from '@/lib/events/publisher';

/**
 * Outbox publisher (docs/02-system-architecture.md § Runtime).
 *
 * Scheduled function that ships pending outbox rows to Inngest as real events,
 * then marks them published. Each `send` re-emits the domain event under its
 * own name so downstream consumer functions can subscribe. Consumers dedupe on
 * the original event id (carried in the payload envelope).
 *
 * Cron granularity here is 1 minute (Inngest minimum); a Vercel cron can poll
 * more frequently if low latency is needed.
 */
export const publishOutbox = inngest.createFunction(
  { id: 'publish-outbox', triggers: [{ cron: '* * * * *' }] },
  async ({ step }) => {
    const result = await step.run('publish-pending', async () =>
      publishPendingOutbox(async (event) => {
        await inngest.send({
          name: event.eventType,
          data: {
            eventId: event.id,
            eventVersion: event.eventVersion,
            organizationId: event.organizationId,
            workshopId: event.workshopId,
            correlationId: event.correlationId,
            causationId: event.causationId,
            payload: event.payload,
          },
        });
      }),
    );
    return result;
  },
);
