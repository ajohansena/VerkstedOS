import Link from 'next/link';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { isSupabaseConfigured } from '@/lib/supabase/server';
import {
  listAllOrganizations,
  listDocumentsForOrg,
} from '@/modules/platform/public';

export const dynamic = 'force-dynamic';

/**
 * /dev/documents — document metadata inspection (Dev surface, Sprint 12). Pick
 * an org, see its documents with sensitivity bucket and processing state (the
 * virus-scan / image-pipeline backlog is `is_processed = false`). Behind the
 * hardened /dev guard.
 */
export default async function DevDocumentsPage({
  searchParams,
}: {
  searchParams: Promise<{ org?: string }>;
}) {
  const configured = isSupabaseConfigured();
  const { org } = await searchParams;
  const orgs = configured ? await listAllOrganizations() : [];
  const docs = configured && org ? await listDocumentsForOrg(org) : [];

  return (
    <main className="mx-auto max-w-3xl space-y-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Documents</h1>
        <Link href="/dev/health" className="text-sm underline">
          /dev/health
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Select organization</CardTitle>
          <CardDescription>
            Inspect document metadata + the unprocessed backlog.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {orgs.length === 0 ? (
            <p className="text-sm text-muted-foreground">No organizations.</p>
          ) : (
            <ul className="divide-y rounded-md border">
              {orgs.map(({ organization }) => (
                <li
                  key={organization.id}
                  className="flex items-center justify-between px-3 py-2 text-sm"
                >
                  <span className="font-medium">{organization.name}</span>
                  <Link
                    href={`/dev/documents?org=${organization.id}`}
                    className="text-xs underline"
                  >
                    Inspect
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {org ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Documents ({docs.length})
            </CardTitle>
            <CardDescription>
              kind · sensitivity bucket · processed?
            </CardDescription>
          </CardHeader>
          <CardContent>
            {docs.length === 0 ? (
              <p className="text-sm text-muted-foreground">No documents.</p>
            ) : (
              <ul className="divide-y rounded-md border">
                {docs.map((d) => (
                  <li
                    key={d.id}
                    className="flex items-center justify-between gap-2 px-3 py-2 text-sm"
                  >
                    <span className="truncate font-medium">
                      {d.originalFilename ?? d.id}
                    </span>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {d.kind} · {d.storageBucket} ·{' '}
                      {d.isProcessed ? 'processed' : 'pending'}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      ) : null}
    </main>
  );
}
