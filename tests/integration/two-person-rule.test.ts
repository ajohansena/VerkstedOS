import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  startIsolationHarness,
  type IsolationHarness,
} from '../tenant-isolation/harness';

/**
 * Two-person rule for dangerous platform operations (Sprint 20,
 * docs/06-developer-control-plane.md). Validates: a request lands in the
 * pending queue; the requestor cannot approve their OWN request; rejection
 * needs an explanation; only an approved op can be executed.
 */
describe('two-person rule for dangerous operations', () => {
  let h: IsolationHarness;
  let platform: typeof import('@/modules/platform/public');
  let identity: typeof import('@/modules/identity/public');

  let orgId: string;
  let requestorUserId: string;
  let approverUserId: string;

  beforeAll(async () => {
    h = await startIsolationHarness();
    process.env.DATABASE_URL = h.appUrl;
    process.env.DATABASE_URL_ADMIN = h.container.getConnectionUri();

    platform = await import('@/modules/platform/public');
    identity = await import('@/modules/identity/public');

    requestorUserId = '00000000-0000-0000-0000-0000000020a1';
    approverUserId = '00000000-0000-0000-0000-0000000020a2';
    await identity.ensureUser({
      id: requestorUserId,
      email: 'req20@example.no',
      fullName: 'Rita Requestor',
    });
    await identity.ensureUser({
      id: approverUserId,
      email: 'app20@example.no',
      fullName: 'Anders Approver',
    });
    const { organization } = await identity.createOrganizationWithOwner({
      name: 'Tofarls Bilskade',
      ownerUserId: requestorUserId,
    });
    orgId = organization.id;
  }, 120_000);

  afterAll(async () => {
    if (h) await h.stop();
  });

  it('records a pending request and surfaces it on the queue', async () => {
    const op = await platform.requestDangerousOp({
      organizationId: orgId,
      kind: 'org_lock',
      reason: 'Insurer hold pending audit completion',
      requestedByUserId: requestorUserId,
    });
    expect(op.status).toBe('pending_approval');
    expect(op.requestedByUserId).toBe(requestorUserId);
    expect(op.approvedByUserId).toBeNull();

    const queue = await platform.listDangerousOpsQueue({
      status: 'pending_approval',
    });
    expect(queue.some((q) => q.id === op.id)).toBe(true);
  });

  it('rejects approval from the requestor (two-person rule)', async () => {
    const op = await platform.requestDangerousOp({
      organizationId: orgId,
      kind: 'jobs_pause',
      reason: 'Pause overnight reprocessing window',
      requestedByUserId: requestorUserId,
    });
    await expect(
      platform.approveDangerousOp({
        id: op.id,
        approvedByUserId: requestorUserId,
      }),
    ).rejects.toBeInstanceOf(platform.TwoPersonRuleViolationError);
  });

  it('approves with a different user and moves status forward', async () => {
    const op = await platform.requestDangerousOp({
      organizationId: orgId,
      kind: 'maintenance_mode_on',
      reason: 'Scheduled deployment window 02:00-03:00',
      requestedByUserId: requestorUserId,
    });
    const approved = await platform.approveDangerousOp({
      id: op.id,
      approvedByUserId: approverUserId,
    });
    expect(approved.status).toBe('approved');
    expect(approved.approvedByUserId).toBe(approverUserId);
  });

  it('cannot execute a pending operation (only approved → executed)', async () => {
    const op = await platform.requestDangerousOp({
      organizationId: orgId,
      kind: 'data_delete',
      reason: 'GDPR erasure request 2024-0021',
      requestedByUserId: requestorUserId,
    });
    await expect(
      platform.executeDangerousOp({
        id: op.id,
        executedByUserId: approverUserId,
        outcome: 'Done',
      }),
    ).rejects.toBeInstanceOf(platform.DangerousOperationStateError);
  });

  it('rejects executions from the same user that requested', async () => {
    const op = await platform.requestDangerousOp({
      organizationId: orgId,
      kind: 'org_unlock',
      reason: 'Resume after compliance check',
      requestedByUserId: requestorUserId,
    });
    await platform.approveDangerousOp({
      id: op.id,
      approvedByUserId: approverUserId,
    });
    await expect(
      platform.executeDangerousOp({
        id: op.id,
        executedByUserId: requestorUserId,
        outcome: 'Done',
      }),
    ).rejects.toBeInstanceOf(platform.TwoPersonRuleViolationError);
  });

  it('refuses a request with a too-short reason (<8 chars)', async () => {
    await expect(
      platform.requestDangerousOp({
        organizationId: orgId,
        kind: 'jobs_resume',
        reason: 'short',
        requestedByUserId: requestorUserId,
      }),
    ).rejects.toThrow(/at least 8/);
  });
});
