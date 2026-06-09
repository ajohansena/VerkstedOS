/**
 * Notifications & customer portal — public surface (Sprint 17).
 * The ONLY entry point other modules and the app may import from.
 */

export type {
  Notification,
  NotificationRule,
  NotificationDelivery,
  NotificationPreference,
  PortalToken,
} from '@/db/types';

export type {
  NotificationCategoryCode,
  NotificationSeverityCode,
  NotificationChannelCode,
  NotificationStatusCode,
  PortalTokenScopeCode,
  TriggerHit,
} from '../domain/types';

// User-facing notification API
export {
  listMyNotifications,
  getMyUnreadCount,
  markMyNotificationRead,
  markAllMyNotificationsRead,
  dismissMyNotification,
  createNotification,
  listOrgNotificationRules,
  setOrgNotificationRuleEnabled,
  listOrgNotificationDeliveries,
} from '../application/services/notifications';

// Engine (cron + Dev surface)
export {
  evaluateNotificationRules,
  type EvaluationResult,
} from '../application/services/engine';

// Portal
export {
  issuePortalToken,
  resolvePortalToken,
  touchPortalToken,
  revokePortalTokenById,
  generatePortalToken,
} from '../application/services/portal';

// Portal read helper (used by the unauth'd portal route)
export {
  readPortalCase,
  type PortalCaseView,
} from '../infrastructure/repositories/portal-case-repository';
