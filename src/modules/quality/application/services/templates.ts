import { and, asc, eq, isNull } from 'drizzle-orm';

import { withTransaction } from '@/db/client';
import { recordAuditEvent } from '@/lib/audit/audit-writer';
import { checklistTemplateItems } from '@/db/schemas/quality/checklist-template-items';
import { checklistTemplates } from '@/db/schemas/quality/checklist-templates';
import type { ChecklistTemplate, ChecklistTemplateItem } from '@/db/types';
import type { RequestContext } from '@/lib/tenancy/context';
import { requirePermission } from '@/modules/identity/public';

/**
 * Checklist templates (docs/03-data-model.md). Per-workshop configurable QC
 * checklists. Managing templates requires `admin:config`; viewing requires
 * `quality:view`.
 */

export interface TemplateItemInput {
  label: string;
  isRequired?: boolean;
  requiresCommentOnFail?: boolean;
  requiresPhotoOnFail?: boolean;
}

export interface CreateTemplateInput {
  code: string;
  name: string;
  description?: string;
  kind?: ChecklistTemplate['kind'];
  workshopId?: string | null;
  items: TemplateItemInput[];
}

export async function createChecklistTemplate(
  ctx: RequestContext,
  input: CreateTemplateInput,
): Promise<ChecklistTemplate> {
  await requirePermission(ctx, 'admin:config');

  return withTransaction(ctx, async (tx) => {
    const inserted = await tx
      .insert(checklistTemplates)
      .values({
        organizationId: ctx.organizationId,
        workshopId: input.workshopId ?? null,
        code: input.code,
        name: input.name,
        description: input.description ?? null,
        kind: input.kind ?? 'general',
        createdBy: ctx.userId,
        updatedBy: ctx.userId,
      })
      .returning();
    const template = inserted[0];
    if (!template) throw new Error('Failed to create checklist template');

    let seq = 0;
    for (const item of input.items) {
      await tx.insert(checklistTemplateItems).values({
        organizationId: ctx.organizationId,
        templateId: template.id,
        label: item.label,
        sequenceNo: seq++,
        isRequired: item.isRequired ?? true,
        requiresCommentOnFail: item.requiresCommentOnFail ?? true,
        requiresPhotoOnFail: item.requiresPhotoOnFail ?? false,
        createdBy: ctx.userId,
        updatedBy: ctx.userId,
      });
    }

    await recordAuditEvent(tx, ctx, {
      action: 'created',
      entityTable: 'checklist_templates',
      entityId: template.id,
      after: { code: input.code, itemCount: input.items.length },
    });

    return template;
  });
}

export async function listChecklistTemplates(
  ctx: RequestContext,
): Promise<ChecklistTemplate[]> {
  await requirePermission(ctx, 'quality:view');
  return withTransaction(ctx, async (tx) => {
    return tx
      .select()
      .from(checklistTemplates)
      .where(
        and(
          eq(checklistTemplates.organizationId, ctx.organizationId),
          isNull(checklistTemplates.deletedAt),
        ),
      )
      .orderBy(asc(checklistTemplates.name));
  });
}

export async function listTemplateItems(
  ctx: RequestContext,
  templateId: string,
): Promise<ChecklistTemplateItem[]> {
  return withTransaction(ctx, async (tx) => {
    return tx
      .select()
      .from(checklistTemplateItems)
      .where(
        and(
          eq(checklistTemplateItems.organizationId, ctx.organizationId),
          eq(checklistTemplateItems.templateId, templateId),
          isNull(checklistTemplateItems.deletedAt),
        ),
      )
      .orderBy(asc(checklistTemplateItems.sequenceNo));
  });
}
