import { desc, eq } from 'drizzle-orm';

import { getRawClient } from '@/db/client';
import { notificationDeliveries } from '@/db/schemas/notifications/notification-deliveries';
import { notificationRules } from '@/db/schemas/notifications/notification-rules';
import { notifications } from '@/db/schemas/notifications/notifications';

/**
 * Notifications inspection (Dev surface, /dev/notifications, Sprint 17).
 * Cross-org reads via the platform-inspector connection. Repair tools go
 * through the canonical engine — never ad-hoc SQL — so a manual evaluate
 * uses the same business rules as the scheduled cron.
 */

export interface NotificationRow {
  readonly id: string;
  readonly ruleCode: string | null;
  readonly recipientUserId: string;
  readonly severity: string;
  readonly status: string;
  readonly body: string;
  readonly createdAt: Date;
}

export async function listNotificationsForOrg(
  organizationId: string,
  limit = 50,
): Promise<NotificationRow[]> {
  const db = getRawClient({ as: 'platform-inspector' });
  return db
    .select({
      id: notifications.id,
      ruleCode: notifications.ruleCode,
      recipientUserId: notifications.recipientUserId,
      severity: notifications.severity,
      status: notifications.status,
      body: notifications.body,
      createdAt: notifications.createdAt,
    })
    .from(notifications)
    .where(eq(notifications.organizationId, organizationId))
    .orderBy(desc(notifications.createdAt))
    .limit(limit);
}

export interface DeliveryRow {
  readonly id: string;
  readonly notificationId: string;
  readonly channel: string;
  readonly status: string;
  readonly attemptedAt: Date | null;
  readonly errorMessage: string | null;
}

export async function listDeliveriesForOrg(
  organizationId: string,
  limit = 100,
): Promise<DeliveryRow[]> {
  const db = getRawClient({ as: 'platform-inspector' });
  return db
    .select({
      id: notificationDeliveries.id,
      notificationId: notificationDeliveries.notificationId,
      channel: notificationDeliveries.channel,
      status: notificationDeliveries.status,
      attemptedAt: notificationDeliveries.attemptedAt,
      errorMessage: notificationDeliveries.errorMessage,
    })
    .from(notificationDeliveries)
    .where(eq(notificationDeliveries.organizationId, organizationId))
    .orderBy(desc(notificationDeliveries.attemptedAt))
    .limit(limit);
}

export interface RuleRow {
  readonly id: string;
  readonly code: string;
  readonly category: string;
  readonly severity: string;
  readonly enabled: boolean;
}

export async function listRulesForOrgPlatform(
  organizationId: string,
): Promise<RuleRow[]> {
  const db = getRawClient({ as: 'platform-inspector' });
  return db
    .select({
      id: notificationRules.id,
      code: notificationRules.code,
      category: notificationRules.category,
      severity: notificationRules.severity,
      enabled: notificationRules.enabled,
    })
    .from(notificationRules)
    .where(eq(notificationRules.organizationId, organizationId))
    .orderBy(notificationRules.code);
}
