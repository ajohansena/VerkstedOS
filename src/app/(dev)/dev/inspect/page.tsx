import Link from 'next/link';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { inspectSearch } from '@/modules/platform/public';

export const dynamic = 'force-dynamic';

/**
 * /dev/inspect — universal entity search (Dev surface). Access enforced by the
 * (dev) layout. Searches vehicles (reg/VIN), customers, organizations, users.
 * The roadmap demo: search "reg AB12345" → find the vehicle → navigate onward.
 */
export default async function DevInspectPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const results = q ? await inspectSearch(q) : [];

  return (
    <main className="mx-auto max-w-3xl space-y-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Inspect</h1>
        <Link href="/dev/orgs" className="text-sm underline">
          /dev/orgs
        </Link>
      </div>

      <form method="get" className="flex gap-2">
        <Input
          name="q"
          defaultValue={q ?? ''}
          placeholder="reg, VIN, customer, org no, email, or UUID…"
        />
      </form>

      {q ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {results.length} result(s) for “{q}”
            </CardTitle>
          </CardHeader>
          <CardContent>
            {results.length === 0 ? (
              <p className="text-sm text-muted-foreground">No matches.</p>
            ) : (
              <ul className="divide-y rounded-md border text-sm">
                {results.map((r) => (
                  <li
                    key={`${r.kind}-${r.id}`}
                    className="flex items-center justify-between px-3 py-2"
                  >
                    <div>
                      <span className="font-medium">{r.label}</span>
                      <span className="ml-2 text-xs text-muted-foreground">
                        {r.kind} · {r.sublabel}
                      </span>
                    </div>
                    {r.kind === 'user' ? (
                      <Link
                        href={`/dev/users/${r.id}`}
                        className="text-xs underline"
                      >
                        inspect
                      </Link>
                    ) : r.kind === 'organization' ? (
                      <Link
                        href={`/dev/orgs/${r.id}`}
                        className="text-xs underline"
                      >
                        inspect
                      </Link>
                    ) : (
                      <span className="font-mono text-xs text-muted-foreground">
                        {r.id}
                      </span>
                    )}
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
