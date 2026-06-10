#!/usr/bin/env tsx
/**
 * Route audit (Sprint 20 — Platform Maturity completion).
 *
 * Two checks:
 *  1. Inventory  — enumerate every `src/app/**\/page.tsx` and derive the route.
 *  2. Cross-ref  — collect every static `href="/..."` referenced in the /dev
 *                  surface and verify it resolves to an actual page file.
 *
 * Output:
 *  - docs/route-inventory.md (the canonical inventory)
 *  - Exit code 1 if any /dev href points at a route with no page.tsx.
 *
 * The script does not hit the network. The /dev 404 bug that motivated this
 * audit was a missing leaf page, not a runtime regression — static analysis
 * catches that class of bug without needing auth.
 */

import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join, relative, resolve } from 'node:path';

const REPO_ROOT = resolve(__dirname, '..');
const APP_ROOT = join(REPO_ROOT, 'src', 'app');
const DEV_ROOT = join(REPO_ROOT, 'src', 'app', '(dev)');

async function walk(
  dir: string,
  predicate: (path: string) => boolean,
): Promise<string[]> {
  const out: string[] = [];
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
      out.push(...(await walk(full, predicate)));
    } else if (predicate(full)) {
      out.push(full);
    }
  }
  return out;
}

type RouteRow = {
  route: string;
  file: string;
  kind: 'page' | 'route';
  isDynamic: boolean;
  group: string | null;
};

function pageFileToRoute(file: string): string {
  const rel = relative(APP_ROOT, file).replace(/\\/g, '/');
  const segments = rel.split('/').slice(0, -1); // drop "page.tsx" / "route.ts"
  const out: string[] = [];
  for (const seg of segments) {
    if (seg.startsWith('(') && seg.endsWith(')')) continue; // route group
    out.push(seg);
  }
  const route = '/' + out.join('/');
  return route === '/' ? '/' : route.replace(/\/$/, '');
}

function extractGroup(file: string): string | null {
  const rel = relative(APP_ROOT, file).replace(/\\/g, '/');
  const m = rel.match(/\(([^)]+)\)/);
  return m ? m[1] ?? null : null;
}

async function inventory(): Promise<RouteRow[]> {
  const files = await walk(
    APP_ROOT,
    (p) =>
      p.endsWith('/page.tsx') ||
      p.endsWith('/route.ts') ||
      p.endsWith('/route.tsx'),
  );
  const rows: RouteRow[] = files.map((f) => {
    const route = pageFileToRoute(f);
    const kind: RouteRow['kind'] = f.endsWith('/page.tsx') ? 'page' : 'route';
    return {
      route,
      file: relative(REPO_ROOT, f),
      kind,
      isDynamic: /\[[^\]]+\]/.test(route),
      group: extractGroup(f),
    };
  });
  rows.sort((a, b) => a.route.localeCompare(b.route));
  return rows;
}

/** Collect every static href="/..." literal under src/app/(dev)/. */
async function collectDevHrefs(): Promise<{ href: string; from: string }[]> {
  const files = await walk(
    DEV_ROOT,
    (p) => p.endsWith('.ts') || p.endsWith('.tsx'),
  );
  const hrefRe = /href=["'`](\/[^"'`${}]+)["'`]/g;
  const out: { href: string; from: string }[] = [];
  for (const file of files) {
    const src = await readFile(file, 'utf8');
    for (const m of src.matchAll(hrefRe)) {
      const href = m[1];
      if (!href) continue;
      // Strip query/hash + trailing slash
      const clean = href.split('?')[0]?.split('#')[0] ?? href;
      const normalized =
        clean.length > 1 ? clean.replace(/\/$/, '') : clean;
      out.push({ href: normalized, from: relative(REPO_ROOT, file) });
    }
  }
  return out;
}

function routeMatches(routes: RouteRow[], href: string): boolean {
  // Direct match
  if (routes.some((r) => r.route === href)) return true;
  // Dynamic match: replace each [param] with [^/]+ and test
  const hrefSegments = href.split('/');
  for (const r of routes) {
    if (!r.isDynamic) continue;
    const rs = r.route.split('/');
    if (rs.length !== hrefSegments.length) continue;
    let ok = true;
    for (let i = 0; i < rs.length; i++) {
      const a = rs[i] ?? '';
      const b = hrefSegments[i] ?? '';
      if (a.startsWith('[') && a.endsWith(']')) continue;
      if (a !== b) {
        ok = false;
        break;
      }
    }
    if (ok) return true;
  }
  return false;
}

const EXTERNAL_OR_API_PREFIXES = ['/api/', '/_next/'];

async function main() {
  const rows = await inventory();
  const hrefs = await collectDevHrefs();

  // Cross-ref: a /dev href that does NOT resolve to a known page is a regression.
  const missing: { href: string; from: string }[] = [];
  const seen = new Set<string>();
  for (const { href, from } of hrefs) {
    if (EXTERNAL_OR_API_PREFIXES.some((p) => href.startsWith(p))) continue;
    const key = `${href}::${from}`;
    if (seen.has(key)) continue;
    seen.add(key);
    if (!routeMatches(rows, href)) {
      missing.push({ href, from });
    }
  }

  // Build report.
  const lines: string[] = [];
  lines.push('# Route inventory');
  lines.push('');
  lines.push(
    `Generated by \`scripts/route-audit.ts\`. ${rows.length} page routes total ` +
      `(${rows.filter((r) => r.isDynamic).length} dynamic).`,
  );
  lines.push('');
  lines.push('## All page routes');
  lines.push('');
  lines.push('| Route | Kind | Group | File |');
  lines.push('|---|---|---|---|');
  for (const r of rows) {
    lines.push(
      `| \`${r.route}\` | ${r.kind} | ${r.group ?? ''} | \`${r.file}\` |`,
    );
  }
  lines.push('');
  lines.push('## /dev cross-reference');
  lines.push('');
  if (missing.length === 0) {
    lines.push('All static `href="/..."` references inside `/dev` resolve to a known page route. ✅');
  } else {
    lines.push(
      'The following `/dev` references point at routes with **no `page.tsx`** — they will 404:',
    );
    lines.push('');
    lines.push('| Broken href | Referenced from |');
    lines.push('|---|---|');
    for (const m of missing) {
      lines.push(`| \`${m.href}\` | \`${m.from}\` |`);
    }
  }
  lines.push('');

  const out = join(REPO_ROOT, 'docs', 'route-inventory.md');
  await writeFile(out, lines.join('\n'));
  console.log(`Wrote ${relative(REPO_ROOT, out)} (${rows.length} routes).`);

  if (missing.length > 0) {
    console.error(
      `\n✖ ${missing.length} /dev href(s) point at routes with no page.tsx:`,
    );
    for (const m of missing) {
      console.error(`  ${m.href}   (from ${m.from})`);
    }
    process.exit(1);
  }
  console.log('✓ All /dev hrefs resolve.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
