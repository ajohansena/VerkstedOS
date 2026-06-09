import { serve } from 'inngest/next';

import { inngest } from '@/../inngest/client';
import { computeKpiSnapshots } from '@/../inngest/functions/compute-kpi-snapshots';
import { evaluateNotifications } from '@/../inngest/functions/evaluate-notifications';
import { publishOutbox } from '@/../inngest/functions/publish-outbox';

/**
 * Inngest serve endpoint (docs/02-system-architecture.md). Registers all
 * Inngest functions. Inngest discovers and invokes them via this route.
 */
export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [publishOutbox, computeKpiSnapshots, evaluateNotifications],
});
