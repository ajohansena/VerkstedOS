'use server';

import { revalidatePath } from 'next/cache';

import { requirePlatformAccess } from '@/lib/platform/guard';
import {
  registerAiModelVersion,
  changeAiModelStatus,
  type AiModelProvider,
  type AiModelStatus,
} from '@/modules/ai/public';

const PROVIDERS: readonly AiModelProvider[] = [
  'internal',
  'openai_compatible',
  'custom',
];

const STATUSES: readonly AiModelStatus[] = ['active', 'shadow', 'retired'];

function asProvider(value: string | null): AiModelProvider {
  if (value && PROVIDERS.includes(value as AiModelProvider))
    return value as AiModelProvider;
  return 'internal';
}

function asStatus(value: string | null): AiModelStatus {
  if (value && STATUSES.includes(value as AiModelStatus))
    return value as AiModelStatus;
  return 'shadow';
}

export async function registerModelAction(formData: FormData): Promise<void> {
  const ctx = await requirePlatformAccess();
  const key = String(formData.get('key') ?? '').trim();
  const version = String(formData.get('version') ?? '').trim();
  const description = String(formData.get('description') ?? '').trim();
  if (!key || !version) return;
  await registerAiModelVersion(ctx, {
    key,
    version,
    provider: asProvider(formData.get('provider') as string | null),
    status: asStatus(formData.get('status') as string | null),
    ...(description ? { description } : {}),
  });
  revalidatePath('/dev/ai/models');
}

export async function changeStatusAction(formData: FormData): Promise<void> {
  const ctx = await requirePlatformAccess();
  const id = String(formData.get('id') ?? '');
  const status = asStatus(formData.get('status') as string | null);
  if (!id) return;
  await changeAiModelStatus(ctx, { id, status });
  revalidatePath('/dev/ai/models');
}
