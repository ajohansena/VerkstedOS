/**
 * Notification repository (Sprint 17). All notification persistence goes
 * through this; service code never touches Drizzle for notifications.
 */

import { and, desc, eq, isNull, ne, sql } from 'drizzle-orm';

import { withTransaction } from '@/db/client';
import { notifications } from '@/db/schemas/notifications/notifications';
import { notificationDeliveries } from '@/db/schemas/notifications/notification-deliveries';
import { notificationPreferences } from '@/db/schemas/notifications/notification-preferences';
import { notificationRules } from '@/db/schemas/notifications/notification-rules';
import type {
  NewNotification,
  NewNotificationDelivery,
  Notification,
  NotificationPreference,
  NotificationRule,
} from '@/db/types';
import type { RequestContext } from '@/lib/tenancy/context';

export interface UpsertNotificationInput extends Omit<
  NewNotification,
  'createdBy' | 'updatedBy' | 'organizationId'
> {
  readonly organizationId?: string;
}

/**
 * UPSERT one notification on the dedup key. If the row already exists and is
 * not dismissed, its `body`/`payload`/`severity`/`updatedAt` are refreshed and
 * the row's status is reset to `unread` so the recipient sees it again.
 */
export async function upsertNotification(
  ctx: RequestContext,
  input: UpsertNotificationInput,
): Promise<Notification> {
  return withTransaction(ctx, async (tx) => {
    const values: NewNotification = {
      organizationId: input.organizationId ?? ctx.organizationId,
      workshopId: input.workshopId ?? null,
      recipientUserId: input.recipientUserId,
      ruleCode: input.ruleCode ?? null,
      category: input.category,
      severity: input.severity,
      refType: input.refType,
      refId: input.refId ?? null,
      titleKey: input.titleKey,
      body: input.body,
      payload: input.payload ?? {},
      actionUrl: input.actionUrl ?? null,
      status: 'unread',
      createdBy: ctx.userId,
      updatedBy: ctx.userId,
    };
    const [row] = await tx
      .insert(notifications)
      .values(values)
      .onConflictDoUpdate({
        target: [
          notifications.organizationId,
          notifications.recipientUserId,
          notifications.ruleCode,
          notifications.refType,
          notifications.refId,
        ],
        set: {
          body: values.body,
          payload: values.payload,
          severity: values.severity,
          status: sql`CASE WHEN ${notifications.status} = 'dismissed' THEN ${notifications.status} ELSE 'unread' END`,
          updatedAt: sql`now()`,
          updatedBy: ctx.userId,
        },
      })
      .returning();
    if (!row) throw new Error('Failed to upsert notification');
    return row;
  });
}

export async function listForUser(
  ctx: RequestContext,
  options: { limit?: number; includeDismissed?: boolean } = {},
): Promise<Notification[]> {
  const limit = options.limit ?? 50;
  return withTransaction(ctx, async (tx) => {
    const conditions = [
      eq(notifications.organizationId, ctx.organizationId),
      eq(notifications.recipientUserId, ctx.userId),
      isNull(notifications.deletedAt),
    ];
    if (!options.includeDismissed) {
      conditions.push(ne(notifications.status, 'dismissed'));
    }
    return tx
      .select()
      .from(notifications)
      .where(and(...conditions))
      .orderBy(desc(notifications.createdAt))
      .limit(limit);
  });
}

export async function unreadCountForUser(ctx: RequestContext): Promise<number> {
  return withTransaction(ctx, async (tx) => {
    const rows = await tx
      .select({ value: sql<number>`count(*)::int` })
      .from(notifications)
      .where(
        and(
          eq(notifications.organizationId, ctx.organizationId),
          eq(notifications.recipientUserId, ctx.userId),
          eq(notifications.status, 'unread'),
          isNull(notifications.deletedAt),
        ),
      );
    return rows[0]?.value ?? 0;
  });
}

export async function markRead(
  ctx: RequestContext,
  notificationId: string,
): Promise<void> {
  await withTransaction(ctx, async (tx) => {
    await tx
      .update(notifications)
      .set({
        status: 'read',
        readAt: sql`now()`,
        updatedAt: sql`now()`,
        updatedBy: ctx.userId,
      })
      .where(
        and(
          eq(notifications.id, notificationId),
          eq(notifications.organizationId, ctx.organizationId),
          eq(notifications.recipientUserId, ctx.userId),
        ),
      );
  });
}

export async function markAllReadForUser(ctx: RequestContext): Promise<void> {
  await withTransaction(ctx, async (tx) => {
    await tx
      .update(notifications)
      .set({
        status: 'read',
        readAt: sql`now()`,
        updatedAt: sql`now()`,
        updatedBy: ctx.userId,
      })
      .where(
        and(
          eq(notifications.organizationId, ctx.organizationId),
          eq(notifications.recipientUserId, ctx.userId),
          eq(notifications.status, 'unread'),
        ),
      );
  });
}

export async function dismissNotification(
  ctx: RequestContext,
  notificationId: string,
): Promise<void> {
  await withTransaction(ctx, async (tx) => {
    await tx
      .update(notifications)
      .set({
        status: 'dismissed',
        dismissedAt: sql`now()`,
        updatedAt: sql`now()`,
        updatedBy: ctx.userId,
      })
      .where(
        and(
          eq(notifications.id, notificationId),
          eq(notifications.organizationId, ctx.organizationId),
          eq(notifications.recipientUserId, ctx.userId),
        ),
      );
  });
}

export async function listRulesForOrg(
  ctx: RequestContext,
  options: { enabledOnly?: boolean } = {},
): Promise<NotificationRule[]> {
  return withTransaction(ctx, async (tx) => {
    const conditions = [
      eq(notificationRules.organizationId, ctx.organizationId),
      isNull(notificationRules.deletedAt),
    ];
    if (options.enabledOnly) {
      conditions.push(eq(notificationRules.enabled, true));
    }
    return tx
      .select()
      .from(notificationRules)
      .where(and(...conditions))
      .orderBy(notificationRules.code);
  });
}

export async function listPreferencesForUser(
  ctx: RequestContext,
): Promise<NotificationPreference[]> {
  return withTransaction(ctx, async (tx) => {
    return tx
      .select()
      .from(notificationPreferences)
      .where(
        and(
          eq(notificationPreferences.organizationId, ctx.organizationId),
          eq(notificationPreferences.userId, ctx.userId),
        ),
      );
  });
}

export async function recordDelivery(
  ctx: RequestContext,
  input: Omit<
    NewNotificationDelivery,
    'createdBy' | 'updatedBy' | 'organizationId'
  >,
): Promise<void> {
  await withTransaction(ctx, async (tx) => {
    await tx.insert(notificationDeliveries).values({
      ...input,
      organizationId: ctx.organizationId,
      createdBy: ctx.userId,
      updatedBy: ctx.userId,
    });
  });
}

/** Toggle a rule on/off (Admin surface). Org-scoped via RLS. */
export async function setRuleEnabled(
  ctx: RequestContext,
  code: string,
  enabled: boolean,
): Promise<void> {
  await withTransaction(ctx, async (tx) => {
    await tx
      .update(notificationRules)
      .set({ enabled, updatedAt: sql`now()`, updatedBy: ctx.userId })
      .where(
        and(
          eq(notificationRules.organizationId, ctx.organizationId),
          eq(notificationRules.code, code),
        ),
      );
  });
}

/** Recent delivery log entries for the Dev surface. */
export async function listRecentDeliveries(
  ctx: RequestContext,
  limit = 100,
): Promise<
  Array<{
    id: string;
    notificationId: string;
    channel: string;
    status: string;
    attemptedAt: Date | null;
    error: string | null;
  }>
> {
  return withTransaction(ctx, async (tx) => {
    return tx
      .select({
        id: notificationDeliveries.id,
        notificationId: notificationDeliveries.notificationId,
        channel: notificationDeliveries.channel,
        status: notificationDeliveries.status,
        attemptedAt: notificationDeliveries.attemptedAt,
        error: notificationDeliveries.errorMessage,
      })
      .from(notificationDeliveries)
      .where(eq(notificationDeliveries.organizationId, ctx.organizationId))
      .orderBy(sql`${notificationDeliveries.attemptedAt} desc nulls last`)
      .limit(limit);
  });
}
