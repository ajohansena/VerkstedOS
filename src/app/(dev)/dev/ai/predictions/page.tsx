import Link from 'next/link';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { requirePlatformAccess } from '@/lib/platform/guard';
import { getDictionary } from '@/lib/i18n';
import { listAllOrganizations } from '@/modules/platform/public';
import { listPlatformPredictions } from '@/modules/ai/public';

export const dynamic = 'force-dynamic';

/**
 * `/dev/ai/predictions` — Cross-org AI predictions inspector (Sprint 21).
 * Read-only ledger of every prediction made by every model, with org name
 * resolution, kind, confidence, latency, and a JSON-summary view of the
 * inputs / output / rationale (truncated for the table; the full payload
 * lands in the planned drill-down page in Sprint 22).
 */
export default async function DevAiPredictionsPage() {
  await requirePlatformAccess();
  const t = getDictionary('nb-NO');
  const [predictions, orgs] = await Promise.all([
    listPlatformPredictions(),
    listAllOrganizations(),
  ]);

  const orgName = (id: string): string =>
    orgs.find((o) => o.organization.id === id)?.organization.name ?? id;

  return (
    <main className="mx-auto max-w-6xl space-y-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">{t.ai.predictionsTitle}</h1>
        <Link href="/dev/ai/models" className="text-sm underline">
          /dev/ai/models
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {t.ai.predictionsTitle} ({predictions.length})
          </CardTitle>
          <CardDescription>{t.ai.predictionsDescription}</CardDescription>
        </CardHeader>
        <CardContent>
          {predictions.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {t.ai.predictionsEmpty}
            </p>
          ) : (
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b text-xs uppercase text-muted-foreground">
                  <th className="py-2">{t.ai.predictionCreatedAt}</th>
                  <th className="py-2">{t.ai.predictionOrg}</th>
                  <th className="py-2">{t.ai.predictionModel}</th>
                  <th className="py-2">{t.ai.predictionKind}</th>
                  <th className="py-2">{t.ai.predictionSubject}</th>
                  <th className="py-2 text-right">
                    {t.ai.predictionConfidence}
                  </th>
                  <th className="py-2 text-right">
                    {t.ai.predictionLatencyMs}
                  </th>
                </tr>
              </thead>
              <tbody>
                {predictions.map((p) => (
                  <tr key={p.id} className="border-b last:border-0">
                    <td className="py-2 text-xs text-muted-foreground">
                      {p.createdAt.toISOString().slice(0, 19).replace('T', ' ')}
                    </td>
                    <td className="py-2">{orgName(p.organizationId)}</td>
                    <td className="py-2 font-mono text-xs">
                      {p.modelKey}@{p.modelVersion}
                    </td>
                    <td className="py-2">{p.kind}</td>
                    <td className="py-2 font-mono text-xs">
                      {p.subjectType}/{p.subjectId.slice(0, 8)}
                    </td>
                    <td className="py-2 text-right">{p.confidence ?? '—'}</td>
                    <td className="py-2 text-right">{p.latencyMs ?? '—'}</td>
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
