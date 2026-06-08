/**
 * Communication & Customer Acceptance — public surface (docs/03-data-model.md).
 *
 * Traceable SMS/email threads with customers, and the repair-acceptance flow:
 * the customer approves every repair start via a job-card link or an SMS reply,
 * and staff see the status at a glance. SMS/email providers are gated — until
 * configured, outbound messages are stored `queued`. The ONLY entry point for
 * other modules and the app.
 */

export type {
  CommunicationThread,
  CommunicationMessage,
  CaseAcceptance,
} from '@/db/types';

// Messaging
export {
  ensureThread,
  sendMessage,
  listThreads,
  listMessages,
  storeInboundMessage,
  resolveOpenThreadByContact,
  newToken,
  type SendMessageInput,
  type ResolvedThread,
} from '../application/services/messaging';

// Acceptance
export {
  requestAcceptance,
  getAcceptanceByToken,
  respondViaJobCard,
  handleInboundReply,
  recordManualAcceptance,
  listAcceptances,
  latestAcceptance,
  type RequestAcceptanceInput,
  type RequestAcceptanceResult,
  type PublicJobCard,
} from '../application/services/acceptance';

// Adapter status (for UI gating)
export { isSmsConfigured } from '../infrastructure/adapters/sms-adapter';
export { isEmailConfigured } from '../infrastructure/adapters/email-adapter';
