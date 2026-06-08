import { and, eq, isNull } from 'drizzle-orm';

import { withTransaction } from '@/db/client';
import { recordAuditEvent } from '@/lib/audit/audit-writer';
import { emitEvent } from '@/lib/events/outbox';
import { inventoryItems } from '@/db/schemas/parts/inventory-items';
import { inventoryStockMovements } from '@/db/schemas/parts/inventory-stock-movements';
import { inventoryWithdrawals } from '@/db/schemas/parts/inventory-withdrawals';
import { partRequirements } from '@/db/schemas/parts/part-requirements';
import type { InventoryItem, InventoryWithdrawal } from '@/db/types';
import type { RequestContext } from '@/lib/tenancy/context';
import { requirePermission } from '@/modules/identity/public';

import { appendLifecycleEvent } from './lifecycle';

/**
 * Inventory — stock items, the movement ledger, and withdrawals
 * (docs/03-data-model.md). A withdrawal is an ALTERNATIVE way to satisfy a part
 * requirement: pull from stock instead of ordering. Every stock change writes a
 * signed movement to the append-only ledger; the item's `quantity_on_hand` is
 * the running balance. `parts:order` required for withdrawals.
 *
 * GUARDRAIL (TakstKontroll, § 4.7): the withdrawal carries `funding_source_id`
 * so the part stays billable and case-traceable.
 */

export async function upsertInventoryItem(
  ctx: RequestContext,
  input: {
    workshopId: string;
    partNumber: string;
    description: string;
    quantityOnHand?: number;
    unitCost?: string | null;
  },
): Promise<InventoryItem> {
  await requirePermission(ctx, 'parts:order');

  return withTransaction(ctx, async (tx) => {
    const existing = await tx
      .select()
      .from(inventoryItems)
      .where(
        and(
          eq(inventoryItems.organizationId, ctx.organizationId),
          eq(inventoryItems.workshopId, input.workshopId),
          eq(inventoryItems.partNumber, input.partNumber),
        ),
      )
      .limit(1);

    if (existing[0]) {
      const item = existing[0];
      if (input.quantityOnHand != null) {
        const delta = input.quantityOnHand - Number(item.quantityOnHand);
        await tx
          .update(inventoryItems)
          .set({
            quantityOnHand: String(input.quantityOnHand),
            updatedBy: ctx.userId,
            updatedAt: new Date(),
          })
          .where(eq(inventoryItems.id, item.id));
        if (delta !== 0) {
          await tx.insert(inventoryStockMovements).values({
            organizationId: ctx.organizationId,
            inventoryItemId: item.id,
            kind: 'adjustment',
            quantityDelta: String(delta),
            note: 'Manual stock adjustment',
            createdBy: ctx.userId,
            updatedBy: ctx.userId,
          });
        }
      }
      return item;
    }

    const insertedItem = await tx
      .insert(inventoryItems)
      .values({
        organizationId: ctx.organizationId,
        workshopId: input.workshopId,
        partNumber: input.partNumber,
        description: input.description,
        quantityOnHand: String(input.quantityOnHand ?? 0),
        unitCost: input.unitCost ?? null,
        createdBy: ctx.userId,
        updatedBy: ctx.userId,
      })
      .returning();
    const item = insertedItem[0];
    if (!item) throw new Error('Failed to create inventory item');

    if (input.quantityOnHand && input.quantityOnHand > 0) {
      await tx.insert(inventoryStockMovements).values({
        organizationId: ctx.organizationId,
        inventoryItemId: item.id,
        kind: 'receipt',
        quantityDelta: String(input.quantityOnHand),
        note: 'Opening stock',
        createdBy: ctx.userId,
        updatedBy: ctx.userId,
      });
    }

    await recordAuditEvent(tx, ctx, {
      action: 'created',
      entityTable: 'inventory_items',
      entityId: item.id,
      after: { partNumber: input.partNumber },
    });

    return item;
  });
}

export async function listInventory(
  ctx: RequestContext,
): Promise<InventoryItem[]> {
  return withTransaction(ctx, async (tx) => {
    return tx
      .select()
      .from(inventoryItems)
      .where(
        and(
          eq(inventoryItems.organizationId, ctx.organizationId),
          isNull(inventoryItems.deletedAt),
        ),
      )
      .orderBy(inventoryItems.partNumber);
  });
}

export interface WithdrawInput {
  inventoryItemId: string;
  caseId: string;
  quantity: number;
  partRequirementId?: string | null;
  fundingSourceId?: string | null;
}

export class InsufficientStockError extends Error {
  readonly code = 'INSUFFICIENT_STOCK';
  constructor() {
    super('Not enough stock on hand for this withdrawal.');
    this.name = 'InsufficientStockError';
  }
}

/**
 * Withdraw stock to a case. Decrements the item (writing a signed movement) and
 * — when linked to a requirement — marks it fulfilled and appends a `withdrawn`
 * + `fulfilled` lifecycle event.
 */
export async function withdrawToCase(
  ctx: RequestContext,
  input: WithdrawInput,
): Promise<InventoryWithdrawal> {
  await requirePermission(ctx, 'parts:order');

  return withTransaction(ctx, async (tx) => {
    const itemRows = await tx
      .select()
      .from(inventoryItems)
      .where(
        and(
          eq(inventoryItems.id, input.inventoryItemId),
          eq(inventoryItems.organizationId, ctx.organizationId),
        ),
      )
      .limit(1);
    const item = itemRows[0];
    if (!item) throw new Error('INVENTORY_ITEM_NOT_FOUND');
    if (Number(item.quantityOnHand) < input.quantity) {
      throw new InsufficientStockError();
    }

    const insertedWithdrawal = await tx
      .insert(inventoryWithdrawals)
      .values({
        organizationId: ctx.organizationId,
        inventoryItemId: item.id,
        caseId: input.caseId,
        partRequirementId: input.partRequirementId ?? null,
        fundingSourceId: input.fundingSourceId ?? null,
        quantity: String(input.quantity),
        withdrawnByUserId: ctx.userId,
        createdBy: ctx.userId,
        updatedBy: ctx.userId,
      })
      .returning();
    const withdrawal = insertedWithdrawal[0];
    if (!withdrawal) throw new Error('Failed to record withdrawal');

    // Decrement stock + ledger movement (referenced to the withdrawal).
    const newOnHand = Number(item.quantityOnHand) - input.quantity;
    await tx
      .update(inventoryItems)
      .set({
        quantityOnHand: String(newOnHand),
        updatedBy: ctx.userId,
        updatedAt: new Date(),
      })
      .where(eq(inventoryItems.id, item.id));
    await tx.insert(inventoryStockMovements).values({
      organizationId: ctx.organizationId,
      inventoryItemId: item.id,
      kind: 'withdrawal',
      quantityDelta: String(-input.quantity),
      referenceId: withdrawal.id,
      createdBy: ctx.userId,
      updatedBy: ctx.userId,
    });

    if (input.partRequirementId) {
      await tx
        .update(partRequirements)
        .set({
          status: 'fulfilled',
          updatedBy: ctx.userId,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(partRequirements.id, input.partRequirementId),
            eq(partRequirements.organizationId, ctx.organizationId),
          ),
        );

      await appendLifecycleEvent(tx, ctx, {
        partRequirementId: input.partRequirementId,
        caseId: input.caseId,
        kind: 'withdrawn',
        detail: { quantity: input.quantity, fromStock: true },
      });
      await appendLifecycleEvent(tx, ctx, {
        partRequirementId: input.partRequirementId,
        caseId: input.caseId,
        kind: 'fulfilled',
        detail: { via: 'inventory_withdrawal' },
      });
    }

    await recordAuditEvent(tx, ctx, {
      action: 'created',
      entityTable: 'inventory_withdrawals',
      entityId: withdrawal.id,
      after: { caseId: input.caseId, quantity: input.quantity },
    });

    await emitEvent(tx, ctx, {
      eventType: 'parts.inventory.withdrawn',
      payload: {
        caseId: input.caseId,
        withdrawalId: withdrawal.id,
        inventoryItemId: item.id,
      },
    });

    return withdrawal;
  });
}
