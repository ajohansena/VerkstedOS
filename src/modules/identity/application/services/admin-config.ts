import { and, eq } from 'drizzle-orm';

import { withTransaction } from '@/db/client';
import { recordAuditEvent } from '@/lib/audit/audit-writer';
import { organizations } from '@/db/schemas/identity/organizations';
import { workshops } from '@/db/schemas/identity/workshops';
import { workflowStates } from '@/db/schemas/production/workflow-states';
import type { Organization, Workshop } from '@/db/types';
import type { RequestContext } from '@/lib/tenancy/context';

import { requirePermission } from '../policies/require-permission';

/**
 * Admin configuration service (Sprint 14 Track G) — makes the /admin surface
 * actionable. Org settings (name, org number, locale, case-number format) and
 * workshop creation. All gated by `admin:config`; mutations are audited. No new
 * permission (Sprint 14 catalog is frozen).
 */

export interface UpdateOrgSettingsInput {
  name?: string;
  orgNumber?: string | null;
  locale?: string;
  caseNumberFormat?: string;
  bookingPolicy?: {
    defaultBookingWindowDays: number;
    overbookingTolerancePercent: number;
  };
}

export async function updateOrganizationSettings(
  ctx: RequestContext,
  input: UpdateOrgSettingsInput,
): Promise<Organization> {
  await requirePermission(ctx, 'admin:config');
  return withTransaction(ctx, async (tx) => {
    const rows = await tx
      .select()
      .from(organizations)
      .where(eq(organizations.id, ctx.organizationId))
      .limit(1);
    const before = rows[0];
    if (!before) throw new Error('ORGANIZATION_NOT_FOUND');

    const settings = {
      ...(before.settings as Record<string, unknown>),
      ...(input.locale !== undefined ? { locale: input.locale } : {}),
      ...(input.caseNumberFormat !== undefined
        ? { caseNumberFormat: input.caseNumberFormat }
        : {}),
      ...(input.bookingPolicy !== undefined
        ? { bookingPolicy: input.bookingPolicy }
        : {}),
    };

    const updated = await tx
      .update(organizations)
      .set({
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.orgNumber !== undefined
          ? { orgNumber: input.orgNumber }
          : {}),
        settings,
        updatedBy: ctx.userId,
        updatedAt: new Date(),
      })
      .where(eq(organizations.id, ctx.organizationId))
      .returning();
    const org = updated[0];
    if (!org) throw new Error('Failed to update organization');

    await recordAuditEvent(tx, ctx, {
      entityTable: 'organizations',
      entityId: org.id,
      action: 'updated',
      before,
      after: org,
    });
    return org;
  });
}

export async function createWorkshop(
  ctx: RequestContext,
  input: { name: string },
): Promise<Workshop> {
  await requirePermission(ctx, 'admin:config');
  return withTransaction(ctx, async (tx) => {
    const rows = await tx
      .insert(workshops)
      .values({
        organizationId: ctx.organizationId,
        name: input.name,
        createdBy: ctx.userId,
        updatedBy: ctx.userId,
      })
      .returning();
    const workshop = rows[0];
    if (!workshop) throw new Error('Failed to create workshop');

    await recordAuditEvent(tx, ctx, {
      entityTable: 'workshops',
      entityId: workshop.id,
      action: 'created',
      after: workshop,
    });
    return workshop;
  });
}

export async function renameWorkflowState(
  ctx: RequestContext,
  input: { stateId: string; label: string },
): Promise<void> {
  await requirePermission(ctx, 'admin:config');
  await withTransaction(ctx, async (tx) => {
    const rows = await tx
      .select()
      .from(workflowStates)
      .where(
        and(
          eq(workflowStates.id, input.stateId),
          eq(workflowStates.organizationId, ctx.organizationId),
        ),
      )
      .limit(1);
    const before = rows[0];
    if (!before) throw new Error('WORKFLOW_STATE_NOT_FOUND');

    const updated = await tx
      .update(workflowStates)
      .set({ label: input.label, updatedBy: ctx.userId, updatedAt: new Date() })
      .where(eq(workflowStates.id, input.stateId))
      .returning();

    await recordAuditEvent(tx, ctx, {
      entityTable: 'workflow_states',
      entityId: input.stateId,
      action: 'updated',
      before,
      after: updated[0],
    });
  });
}
