import Link from 'next/link';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { requirePlatformAccess } from '@/lib/platform/guard';
import { getDictionary } from '@/lib/i18n';
import {
  listModels,
  type AiModelProvider,
  type AiModelStatus,
} from '@/modules/ai/public';

import { changeStatusAction, registerModelAction } from './actions';

export const dynamic = 'force-dynamic';

/**
 * `/dev/ai/models` — Platform AI model registry (Sprint 21). Lists every
 * registered model version (key + version + provider + status), lets a
 * platform operator register a new version and toggle status. No models
 * are invoked from this page — registration is configuration, not execution.
 */
export default async function DevAiModelsPage() {
  await requirePlatformAccess();
  const t = getDictionary('nb-NO');
  const models = await listModels();

  const PROVIDER_LABEL: Record<AiModelProvider, string> = {
    internal: t.ai.providerInternal,
    openai_compatible: t.ai.providerOpenAiCompatible,
    custom: t.ai.providerCustom,
  };

  const STATUS_LABEL: Record<AiModelStatus, string> = {
    active: t.ai.statusActive,
    shadow: t.ai.statusShadow,
    retired: t.ai.statusRetired,
  };

  const STATUS_TONE: Record<AiModelStatus, string> = {
    active: 'bg-emerald-100 text-emerald-900',
    shadow: 'bg-amber-100 text-amber-900',
    retired: 'bg-slate-200 text-slate-700',
  };

  return (
    <main className="mx-auto max-w-6xl space-y-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">{t.ai.modelsTitle}</h1>
        <Link href="/dev/ai/predictions" className="text-sm underline">
          /dev/ai/predictions
        </Link>
      </div>

      <p className="text-sm text-muted-foreground">{t.ai.modelsDescription}</p>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t.ai.registerTitle}</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={registerModelAction} className="grid gap-3 sm:grid-cols-2">
            <label className="space-y-1 text-sm">
              <span className="text-muted-foreground">{t.ai.modelKey}</span>
              <Input name="key" required placeholder="delay_risk" />
            </label>
            <label className="space-y-1 text-sm">
              <span className="text-muted-foreground">{t.ai.modelVersion}</span>
              <Input name="version" required placeholder="1.0.0" />
            </label>
            <label className="space-y-1 text-sm">
              <span className="text-muted-foreground">{t.ai.modelProvider}</span>
              <select
                name="provider"
                defaultValue="internal"
                className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
              >
                <option value="internal">{t.ai.providerInternal}</option>
                <option value="openai_compatible">
                  {t.ai.providerOpenAiCompatible}
                </option>
                <option value="custom">{t.ai.providerCustom}</option>
              </select>
            </label>
            <label className="space-y-1 text-sm">
              <span className="text-muted-foreground">{t.ai.modelStatus}</span>
              <select
                name="status"
                defaultValue="shadow"
                className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
              >
                <option value="shadow">{t.ai.statusShadow}</option>
                <option value="active">{t.ai.statusActive}</option>
                <option value="retired">{t.ai.statusRetired}</option>
              </select>
            </label>
            <label className="space-y-1 text-sm sm:col-span-2">
              <span className="text-muted-foreground">
                {t.ai.modelDescription}
              </span>
              <Input name="description" placeholder="" />
            </label>
            <div className="sm:col-span-2">
              <Button type="submit">{t.ai.registerSubmit}</Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {t.ai.modelsTitle} ({models.length})
          </CardTitle>
          <CardDescription>{t.ai.modelsDescription}</CardDescription>
        </CardHeader>
        <CardContent>
          {models.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t.ai.modelEmpty}</p>
          ) : (
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b text-xs uppercase text-muted-foreground">
                  <th className="py-2">{t.ai.modelKey}</th>
                  <th className="py-2">{t.ai.modelVersion}</th>
                  <th className="py-2">{t.ai.modelProvider}</th>
                  <th className="py-2">{t.ai.modelStatus}</th>
                  <th className="py-2">{t.ai.modelCreatedAt}</th>
                  <th className="py-2 text-right">{t.ai.setActive}</th>
                </tr>
              </thead>
              <tbody>
                {models.map((m) => (
                  <tr key={m.id} className="border-b last:border-0">
                    <td className="py-2 font-mono">{m.key}</td>
                    <td className="py-2 font-mono">{m.version}</td>
                    <td className="py-2">{PROVIDER_LABEL[m.status as never] ?? PROVIDER_LABEL[m.provider]}</td>
                    <td className="py-2">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs ${STATUS_TONE[m.status]}`}
                      >
                        {STATUS_LABEL[m.status]}
                      </span>
                    </td>
                    <td className="py-2 text-xs text-muted-foreground">
                      {m.createdAt.toISOString().slice(0, 10)}
                    </td>
                    <td className="py-2">
                      <div className="flex justify-end gap-1">
                        {(['active', 'shadow', 'retired'] as const)
                          .filter((s) => s !== m.status)
                          .map((s) => (
                            <form key={s} action={changeStatusAction}>
                              <input type="hidden" name="id" value={m.id} />
                              <input type="hidden" name="status" value={s} />
                              <Button
                                type="submit"
                                size="sm"
                                variant="outline"
                              >
                                {s === 'active'
                                  ? t.ai.setActive
                                  : s === 'shadow'
                                    ? t.ai.setShadow
                                    : t.ai.setRetired}
                              </Button>
                            </form>
                          ))}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
