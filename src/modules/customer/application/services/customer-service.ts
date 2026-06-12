import { withTransaction } from '@/db/client';
import { recordAuditEvent } from '@/lib/audit/audit-writer';
import { emitEvent } from '@/lib/events/outbox';
import { isValidIdentifier } from '@/lib/validation/norwegian';
import type { Customer } from '@/db/types';
import type { RequestContext } from '@/lib/tenancy/context';

import {
  createCustomerSchema,
  updateCustomerSchema,
  type BillingAddress,
  type CreateCustomerInput,
  type UpdateCustomerInput,
} from '../../domain/customer';
import {
  insertCustomer,
  softDeleteCustomer,
  updateCustomerRow,
} from '../../infrastructure/repositories/customer-repository';
import { requirePermission } from '@/modules/identity/public';

/**
 * Customer use-cases (docs/03-data-model.md, ADR-015). Permission-checked,
 * full-audited, event-emitting — audit + outbox written transactionally with
 * the mutation.
 */

function normalizeEmail(email?: string): string | null {
  const trimmed = email?.trim();
  return trimmed ? trimmed : null;
}

/**
 * Drop an address object that contains only blank/undefined fields. The zod
 * schema accepts the partial object (every field is optional), but we don't
 * want to persist an empty `{}` blob into the JSONB column — store NULL.
 */
function normalizeBillingAddress(
  input: BillingAddress | undefined,
): BillingAddress | null {
  if (!input) return null;
  const cleaned: BillingAddress = {};
  if (input.street?.trim()) cleaned.street = input.street.trim();
  if (input.postalCode?.trim()) cleaned.postalCode = input.postalCode.trim();
  if (input.city?.trim()) cleaned.city = input.city.trim();
  if (input.countryCode?.trim()) cleaned.countryCode = input.countryCode.trim();
  return Object.keys(cleaned).length === 0 ? null : cleaned;
}

/** Validate the identifier checksum when both identifier + kind are present. */
function assertIdentifierValid(
  identifier: string | undefined,
  identifierKind: Customer['identifierKind'] | undefined,
): void {
  if (identifier && identifierKind) {
    if (!isValidIdentifier(identifierKind, identifier)) {
      throw new Error(`INVALID_IDENTIFIER:${identifierKind}`);
    }
  }
}

export async function createCustomer(
  ctx: RequestContext,
  rawInput: CreateCustomerInput,
): Promise<Customer> {
  await requirePermission(ctx, 'case:edit');
  const input = createCustomerSchema.parse(rawInput);
  assertIdentifierValid(input.identifier, input.identifierKind);

  return withTransaction(ctx, async (tx) => {
    const customer = await insertCustomer(tx, ctx, {
      kind: input.kind,
      name: input.name,
      identifier: input.identifier ?? null,
      identifierKind: input.identifierKind ?? null,
      primaryEmail: normalizeEmail(input.primaryEmail),
      primaryPhone: input.primaryPhone ?? null,
      billingAddress: normalizeBillingAddress(input.billingAddress),
      notes: input.notes ?? null,
    });

    await recordAuditEvent(tx, ctx, {
      action: 'created',
      entityTable: 'customers',
      entityId: customer.id,
      after: { kind: customer.kind, name: customer.name },
    });

    await emitEvent(tx, ctx, {
      eventType: 'customer.customer.created',
      payload: { customerId: customer.id, kind: customer.kind },
    });

    return customer;
  });
}

export async function updateCustomer(
  ctx: RequestContext,
  id: string,
  rawInput: UpdateCustomerInput,
): Promise<Customer> {
  await requirePermission(ctx, 'case:edit');
  const input = updateCustomerSchema.parse(rawInput);
  assertIdentifierValid(input.identifier, input.identifierKind);

  return withTransaction(ctx, async (tx) => {
    const changes: Parameters<typeof updateCustomerRow>[3] = {};
    if (input.name !== undefined) changes.name = input.name;
    if (input.identifier !== undefined)
      changes.identifier = input.identifier ?? null;
    if (input.identifierKind !== undefined)
      changes.identifierKind = input.identifierKind ?? null;
    if (input.primaryEmail !== undefined)
      changes.primaryEmail = normalizeEmail(input.primaryEmail);
    if (input.primaryPhone !== undefined)
      changes.primaryPhone = input.primaryPhone ?? null;
    if (input.billingAddress !== undefined)
      changes.billingAddress = normalizeBillingAddress(input.billingAddress);
    if (input.notes !== undefined) changes.notes = input.notes ?? null;

    const customer = await updateCustomerRow(tx, ctx, id, changes);

    await recordAuditEvent(tx, ctx, {
      action: 'updated',
      entityTable: 'customers',
      entityId: id,
      after: changes,
    });

    await emitEvent(tx, ctx, {
      eventType: 'customer.customer.updated',
      payload: { customerId: id },
    });

    return customer;
  });
}

export async function deleteCustomer(
  ctx: RequestContext,
  id: string,
  reason: string,
): Promise<void> {
  await requirePermission(ctx, 'case:edit');
  if (!reason.trim()) {
    throw new Error('A reason is required to delete a customer.');
  }

  await withTransaction(ctx, async (tx) => {
    await softDeleteCustomer(tx, ctx, id);

    await recordAuditEvent(tx, ctx, {
      action: 'deleted',
      entityTable: 'customers',
      entityId: id,
      reason,
    });

    await emitEvent(tx, ctx, {
      eventType: 'customer.customer.deleted',
      payload: { customerId: id, reason },
    });
  });
}
