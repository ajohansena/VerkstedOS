/**
 * Notification service — the user-facing API for notifications (Sprint 17).
 *
 * Wraps the repository so callers (server actions, Dev surface) don't reach
 * into infrastructure. Permission checks live at the boundary where it makes
 * sense: every user can manage their own notifications; admins can list all
 * notifications for monitoring (via the Dev surface).
 */

import type { Notification, NotificationRule } from '@/db/types';
import type { RequestContext } from '@/lib/tenancy/context';
import { requirePermission } from '@/modules/identity/public';

import {
  dismissNotification as dismissInfra,
  listForUser as listInfra,
  listRecentDeliveries as listDeliveriesInfra,
  listRulesForOrg as listRulesInfra,
  markAllReadForUser as markAllReadInfra,
  markRead as markReadInfra,
  setRuleEnabled as setRuleEnabledInfra,
  unreadCountForUser as unreadCountInfra,
  upsertNotification as upsertInfra,
  type UpsertNotificationInput,
} from '../../infrastructure/repositories/notification-repository';

export async function listMyNotifications(
  ctx: RequestContext,
  options: { limit?: number; includeDismissed?: boolean } = {},
): Promise<Notification[]> {
  return listInfra(ctx, options);
}

export function getMyUnreadCount(ctx: RequestContext): Promise<number> {
  return unreadCountInfra(ctx);
}

export function markMyNotificationRead(
  ctx: RequestContext,
  id: string,
): Promise<void> {
  return markReadInfra(ctx, id);
}

export function markAllMyNotificationsRead(ctx: RequestContext): Promise<void> {
  return markAllReadInfra(ctx);
}

export function dismissMyNotification(
  ctx: RequestContext,
  id: string,
): Promise<void> {
  return dismissInfra(ctx, id);
}

export function createNotification(
  ctx: RequestContext,
  input: UpsertNotificationInput,
): Promise<Notification> {
  return upsertInfra(ctx, input);
}

// --- Admin / Dev surface APIs ---------------------------------------------

export async function listOrgNotificationRules(
  ctx: RequestContext,
): Promise<NotificationRule[]> {
  await requirePermission(ctx, 'admin:config');
  return listRulesInfra(ctx);
}

export async function setOrgNotificationRuleEnabled(
  ctx: RequestContext,
  code: string,
  enabled: boolean,
): Promise<void> {
  await requirePermission(ctx, 'admin:config');
  await setRuleEnabledInfra(ctx, code, enabled);
}

export async function listOrgNotificationDeliveries(
  ctx: RequestContext,
  limit = 100,
): ReturnType<typeof listDeliveriesInfra> {
  await requirePermission(ctx, 'admin:config');
  return listDeliveriesInfra(ctx, limit);
}
