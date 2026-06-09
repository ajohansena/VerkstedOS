import { and, desc, eq, isNull } from 'drizzle-orm';

import { getRawClient } from '@/db/client';
import { aiModelVersions } from '@/db/schemas/ai/ai-model-versions';

/**
 * Platform repository for the **AI model registry** (Sprint 21).
 * Platform-level (no per-tenant RLS); accessed via the `platform-inspector`
 * connection. Used by the Dev plane to register new model versions and
 * inspect their status.
 */

export type AiModelProvider = 'internal' | 'openai_compatible' | 'custom';

export type AiModelStatus = 'active' | 'shadow' | 'retired';

export interface AiModelVersionRow {
  readonly id: string;
  readonly key: string;
  readonly version: string;
  readonly provider: AiModelProvider;
  readonly status: AiModelStatus;
  readonly description: string | null;
  readonly config: unknown;
  readonly registeredByPlatformUserId: string | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

function toRow(r: typeof aiModelVersions.$inferSelect): AiModelVersionRow {
  return {
    id: r.id,
    key: r.key,
    version: r.version,
    provider: r.provider as AiModelProvider,
    status: r.status as AiModelStatus,
    description: r.description,
    config: r.config,
    registeredByPlatformUserId: r.registeredByPlatformUserId,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  };
}

export async function listAiModelVersions(filter?: {
  key?: string;
  status?: AiModelStatus;
}): Promise<AiModelVersionRow[]> {
  const db = getRawClient({ as: 'platform-inspector' });
  const wheres = [isNull(aiModelVersions.deletedAt)];
  if (filter?.key) wheres.push(eq(aiModelVersions.key, filter.key));
  if (filter?.status) wheres.push(eq(aiModelVersions.status, filter.status));
  const rows = await db
    .select()
    .from(aiModelVersions)
    .where(and(...wheres))
    .orderBy(desc(aiModelVersions.createdAt))
    .limit(200);
  return rows.map(toRow);
}

export async function getAiModelVersionByKeyVersion(
  key: string,
  version: string,
): Promise<AiModelVersionRow | null> {
  const db = getRawClient({ as: 'platform-inspector' });
  const rows = await db
    .select()
    .from(aiModelVersions)
    .where(
      and(eq(aiModelVersions.key, key), eq(aiModelVersions.version, version)),
    )
    .limit(1);
  return rows[0] ? toRow(rows[0]) : null;
}

export async function insertAiModelVersion(input: {
  key: string;
  version: string;
  provider: AiModelProvider;
  status?: AiModelStatus;
  description?: string | null;
  config?: unknown;
  registeredByPlatformUserId?: string | null;
}): Promise<AiModelVersionRow> {
  const db = getRawClient({ as: 'platform-inspector' });
  const rows = await db
    .insert(aiModelVersions)
    .values({
      key: input.key,
      version: input.version,
      provider: input.provider,
      ...(input.status ? { status: input.status } : {}),
      ...(input.description !== undefined ? { description: input.description } : {}),
      ...(input.config !== undefined ? { config: input.config as object } : {}),
      ...(input.registeredByPlatformUserId
        ? { registeredByPlatformUserId: input.registeredByPlatformUserId }
        : {}),
    })
    .returning();
  return toRow(rows[0]!);
}

export async function setAiModelStatus(input: {
  id: string;
  status: AiModelStatus;
}): Promise<AiModelVersionRow> {
  const db = getRawClient({ as: 'platform-inspector' });
  const rows = await db
    .update(aiModelVersions)
    .set({ status: input.status, updatedAt: new Date() })
    .where(eq(aiModelVersions.id, input.id))
    .returning();
  return toRow(rows[0]!);
}
