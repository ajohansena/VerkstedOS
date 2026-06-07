import { Inngest } from 'inngest';

/**
 * Inngest client — the producer/consumer handle for background jobs and
 * domain-event consumption.
 *
 * Events are produced via the Postgres outbox (transactional with the
 * mutation) and shipped to Inngest by a publisher; Inngest functions consume
 * them. See docs/02-system-architecture.md § Event architecture.
 */
export const inngest = new Inngest({ id: 'verkstedos' });
