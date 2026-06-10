/**
 * Two-person rule service (Sprint 20, docs/06-developer-control-plane.md
 * "Two-person rule for dangerous ops"). A request → approve → execute
 * pipeline that mandates the approver be a DIFFERENT platform user than
 * the requestor. The repository persists the queue; this service enforces
 * the invariants and is the only path the UI may use.
 */

import {
  getDangerousOperationById,
  insertDangerousOperation,
  listDangerousOperations,
  markApproved,
  markCancelled,
  markExecuted,
  markRejected,
  type DangerousOperationKind,
  type DangerousOperationRow,
  type DangerousOperationStatus,
} from '@/modules/platform/infrastructure/repositories/platform-dangerous-ops-repository';

export class TwoPersonRuleViolationError extends Error {
  constructor() {
    super(
      'Approver must be a different platform user than the requestor (two-person rule).',
    );
    this.name = 'TwoPersonRuleViolationError';
  }
}

export class DangerousOperationNotFoundError extends Error {
  constructor(id: string) {
    super(`Dangerous operation ${id} not found.`);
    this.name = 'DangerousOperationNotFoundError';
  }
}

export class DangerousOperationStateError extends Error {
  constructor(id: string, expected: DangerousOperationStatus, actual: string) {
    super(
      `Dangerous operation ${id} is in state ${actual}, expected ${expected}.`,
    );
    this.name = 'DangerousOperationStateError';
  }
}

export interface RequestDangerousOpInput {
  readonly organizationId: string | null;
  readonly kind: DangerousOperationKind;
  readonly reason: string;
  readonly payload?: unknown;
  readonly requestedByUserId: string;
}

export async function requestDangerousOp(
  input: RequestDangerousOpInput,
): Promise<DangerousOperationRow> {
  const trimmed = input.reason.trim();
  if (trimmed.length < 8) {
    throw new Error('Reason must be at least 8 characters.');
  }
  return insertDangerousOperation({
    organizationId: input.organizationId,
    kind: input.kind,
    reason: trimmed,
    payload: input.payload ?? {},
    requestedByUserId: input.requestedByUserId,
  });
}

export async function approveDangerousOp(input: {
  id: string;
  approvedByUserId: string;
}): Promise<DangerousOperationRow> {
  const op = await getDangerousOperationById(input.id);
  if (!op) throw new DangerousOperationNotFoundError(input.id);
  if (op.status !== 'pending_approval') {
    throw new DangerousOperationStateError(
      input.id,
      'pending_approval',
      op.status,
    );
  }
  if (op.requestedByUserId === input.approvedByUserId) {
    throw new TwoPersonRuleViolationError();
  }
  return markApproved({
    id: input.id,
    approvedByUserId: input.approvedByUserId,
  });
}

export async function rejectDangerousOp(input: {
  id: string;
  approvedByUserId: string;
  outcome: string;
}): Promise<DangerousOperationRow> {
  const op = await getDangerousOperationById(input.id);
  if (!op) throw new DangerousOperationNotFoundError(input.id);
  if (op.status !== 'pending_approval') {
    throw new DangerousOperationStateError(
      input.id,
      'pending_approval',
      op.status,
    );
  }
  if (op.requestedByUserId === input.approvedByUserId) {
    throw new TwoPersonRuleViolationError();
  }
  return markRejected({
    id: input.id,
    approvedByUserId: input.approvedByUserId,
    outcome: input.outcome.trim() || 'Rejected.',
  });
}

export async function executeDangerousOp(input: {
  id: string;
  executedByUserId: string;
  outcome: string;
}): Promise<DangerousOperationRow> {
  const op = await getDangerousOperationById(input.id);
  if (!op) throw new DangerousOperationNotFoundError(input.id);
  if (op.status !== 'approved') {
    throw new DangerousOperationStateError(input.id, 'approved', op.status);
  }
  // Two-person rule again: the user that approved cannot also be the one
  // executing? In our model the approver IS the executor in the same UI
  // moment; only the *requestor* may not execute their own request.
  if (op.requestedByUserId === input.executedByUserId) {
    throw new TwoPersonRuleViolationError();
  }
  return markExecuted({
    id: input.id,
    outcome: input.outcome.trim() || 'Executed.',
  });
}

export async function cancelDangerousOp(input: {
  id: string;
  outcome: string;
}): Promise<DangerousOperationRow> {
  const op = await getDangerousOperationById(input.id);
  if (!op) throw new DangerousOperationNotFoundError(input.id);
  if (op.status === 'executed') {
    throw new DangerousOperationStateError(
      input.id,
      'pending_approval',
      op.status,
    );
  }
  return markCancelled({
    id: input.id,
    outcome: input.outcome.trim() || 'Cancelled.',
  });
}

export async function listQueue(filter?: {
  status?: DangerousOperationStatus;
  organizationId?: string | null;
}): Promise<DangerousOperationRow[]> {
  return listDangerousOperations(filter);
}
