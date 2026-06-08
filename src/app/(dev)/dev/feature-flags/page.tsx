import Link from 'next/link';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { isSupabaseConfigured } from '@/lib/supabase/server';
import { listFeatureFlags } from '@/modules/platform/public';
import { setFeatureFlagAction } from './actions';

export const dynamic = 'force-dynamic';

/**
 * /dev/feature-flags — feature-flag management (Dev surface, Sprint 12). Global
 * defaults (no org) and per-org overrides. Every change is audited. Behind the
 * hardened /dev guard (the (dev) layout calls requirePlatformAccess).
 */
export default async function DevFeatureFlagsPage() {
  const configured = isSupabaseConfigured();
  const flags = configured ? await listFeatureFlags() : [];

  return (
    <main className="mx-auto max-w-3xl space-y-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Feature flags</h1>
        <Link href="/dev/health" className="text-sm underline">
          /dev/health
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Flags ({flags.length})</CardTitle>
          <CardDescription>
            Global default (no org) or a per-org override. Org override wins.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {flags.length === 0 ? (
            <p className="text-sm text-muted-foreground">No flags yet.</p>
          ) : (
            <ul className="divide-y rounded-md border">
              {flags.map((f) => (
                <li
                  key={f.id}
                  className="flex items-center justify-between gap-2 px-3 py-2 text-sm"
                >
                  <span>
                    <span className="font-medium">{f.key}</span>
                    <span className="ml-2 text-xs text-muted-foreground">
                      {f.organizationId
                        ? `org ${f.organizationId.slice(0, 8)}`
                        : 'global'}
                    </span>
                  </span>
                  <form action={setFeatureFlagAction}>
                    <input type="hidden" name="key" value={f.key} />
                    <input
                      type="hidden"
                      name="organizationId"
                      value={f.organizationId ?? ''}
                    />
                    <input
                      type="hidden"
                      name="enabled"
                      value={(!f.enabled).toString()}
                    />
                    <Button
                      type="submit"
                      size="sm"
                      variant={f.enabled ? 'default' : 'outline'}
                    >
                      {f.enabled ? 'on' : 'off'}
                    </Button>
                  </form>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Add / set a flag</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={setFeatureFlagAction} className="space-y-2">
            <Input name="key" placeholder="key (e.g. parts_v2)" />
            <Input
              name="organizationId"
              placeholder="organization id (blank = global)"
            />
            <Input name="description" placeholder="description (optional)" />
            <input type="hidden" name="enabled" value="true" />
            <Button type="submit" size="sm">
              Enable
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
