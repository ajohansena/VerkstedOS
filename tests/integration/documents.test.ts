import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  startIsolationHarness,
  type IsolationHarness,
} from '../tenant-isolation/harness';

/**
 * Documents integration suite (Sprint 12).
 *
 * Validates the cross-cutting documents spine against real Postgres: a photo is
 * registered against a case with a before/during/after role + a deterministic
 * sensitivity-class storage path; the gallery read groups by role; processing
 * state flips; and the access log is append-only.
 */
describe('documents', () => {
  let h: IsolationHarness;
  let documents: typeof import('@/modules/documents/public');
  let caseModule: typeof import('@/modules/case/public');
  let identity: typeof import('@/modules/identity/public');

  let orgId: string;
  let ownerUserId: string;
  let caseId: string;

  beforeAll(async () => {
    h = await startIsolationHarness();
    process.env.DATABASE_URL = h.appUrl;
    process.env.DATABASE_URL_ADMIN = h.container.getConnectionUri();

    documents = await import('@/modules/documents/public');
    caseModule = await import('@/modules/case/public');
    identity = await import('@/modules/identity/public');

    ownerUserId = '00000000-0000-0000-0000-0000000000b2';
    await identity.ensureUser({
      id: ownerUserId,
      email: 'owner12@example.no',
      fullName: 'Olav Owner',
    });
    const { organization } = await identity.createOrganizationWithOwner({
      name: 'Dokument Bilskade',
      ownerUserId,
    });
    orgId = organization.id;

    const created = await caseModule.createCase(ctx(), { fundingSources: [] });
    caseId = created.id;
  }, 120_000);

  afterAll(async () => {
    if (h) await h.stop();
  });

  function ctx() {
    return {
      userId: ownerUserId,
      organizationId: orgId,
      workshopId: null,
      accessibleWorkshopIds: [] as string[],
      correlationId: '00000000-0000-0000-0000-0000000000f8',
    };
  }

  let documentId: string;

  it('registers a before-photo against the case with a deterministic path', async () => {
    const result = await documents.registerDocument(ctx(), {
      kind: 'photo',
      sensitivity: 'internal',
      originalFilename: 'IMG_2451.jpg',
      linkedEntityType: 'case',
      linkedEntityId: caseId,
      linkRole: 'before_photo',
    });
    documentId = result.document.id;

    expect(result.document.kind).toBe('photo');
    expect(result.document.isProcessed).toBe(false);
    // Sensitivity → bucket, and a tenant-prefixed path.
    expect(result.storage.bucket).toBe('docs-internal');
    expect(result.storage.path).toBe(
      `org_${orgId}/case/${caseId}/${documentId}/IMG_2451.jpg`,
    );
    expect(result.link.role).toBe('before_photo');

    const event = await h.admin`
      SELECT event_type FROM outbox_events
      WHERE organization_id = ${orgId}
        AND event_type = 'documents.document.registered'
    `;
    expect(event.length).toBeGreaterThanOrEqual(1);
  });

  it('lists case documents (the gallery read)', async () => {
    await documents.registerDocument(ctx(), {
      kind: 'photo',
      sensitivity: 'internal',
      originalFilename: 'IMG_9000.jpg',
      linkedEntityType: 'case',
      linkedEntityId: caseId,
      linkRole: 'after_photo',
    });

    const list = await documents.listDocumentsForEntity(ctx(), 'case', caseId);
    expect(list.length).toBe(2);
    expect(list.map((d) => d.role).sort()).toEqual([
      'after_photo',
      'before_photo',
    ]);
  });

  it('marks a document processed with variants', async () => {
    await documents.markDocumentProcessed(ctx(), documentId, {
      '1920': 'a.jpg',
      thumb: 't.jpg',
    });
    const row = await h.admin`
      SELECT is_processed, variants FROM documents WHERE id = ${documentId}
    `;
    expect(row[0]!['is_processed']).toBe(true);
    expect(row[0]!['variants']).toMatchObject({ thumb: 't.jpg' });
  });

  it('records sensitive access in an append-only log', async () => {
    await documents.recordDocumentAccess(
      ctx(),
      documentId,
      'signed_url_issued',
      'ttl=900',
    );
    const rows = await h.admin`
      SELECT action FROM document_access_events
      WHERE organization_id = ${orgId} AND document_id = ${documentId}
    `;
    expect(rows.length).toBe(1);
    expect(rows[0]!['action']).toBe('signed_url_issued');

    // Append-only: no UPDATE policy → RLS filters all rows out of the command
    // (0 rows affected) rather than erroring. Org context must be set on the
    // non-superuser app connection for the row to be visible to the USING clause.
    const updated = await h.app.begin(async (tx) => {
      await tx`select set_config('app.current_org_id', ${orgId}, true)`;
      return tx`UPDATE document_access_events SET action = 'viewed' WHERE document_id = ${documentId}`;
    });
    expect(updated.count).toBe(0);
  });
});
