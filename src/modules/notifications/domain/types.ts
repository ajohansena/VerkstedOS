/**
 * Notifications & customer portal — domain types (Sprint 17).
 *
 * Pure types only. No I/O, no Drizzle, no React.
 */

export type NotificationCategoryCode =
  | 'parts_delay'
  | 'supplement_pending'
  | 'delivery_at_risk'
  | 'missing_photos'
  | 'capacity_conflict'
  | 'customer_pending'
  | 'inbound_message'
  | 'other';

export type NotificationSeverityCode = 'info' | 'warning' | 'critical';
export type NotificationChannelCode = 'in_app' | 'sms' | 'email';
export type NotificationStatusCode = 'unread' | 'read' | 'dismissed';
export type NotificationDeliveryStatusCode =
  | 'queued'
  | 'sent'
  | 'failed'
  | 'bounced'
  | 'skipped';

export type PortalTokenScopeCode =
  | 'case_status'
  | 'case_acceptance'
  | 'delivery_signoff';

/**
 * A "trigger hit" — the engine's detector returns these and the engine
 * upserts notifications from them. Pure data, no DB.
 */
export interface TriggerHit {
  readonly ruleCode: string;
  readonly category: NotificationCategoryCode;
  readonly severity: NotificationSeverityCode;
  readonly refType: string;
  readonly refId: string | null;
  readonly titleKey: string;
  readonly body: string;
  readonly payload: Record<string, unknown>;
  readonly actionUrl?: string;
  readonly recipientUserIds: readonly string[];
  readonly workshopId?: string | null;
}
