# Sprint 01 Implementation Review — Project Skeleton

**Status:** Complete
**Date:** 2026-06-07
**Branch / PR:** `sprint-01/project-skeleton` → [PR #1](https://github.com/ajohansena/VerkstedOS/pull/1)
**Demoable outcome:** Confirmed — home greeting + `/login` placeholder + `GET /dev/health` returns HTTP 200 with a status object. Production build clean; all CI gates green locally.

This review follows the six-dimension Implementation Review Gate (CLAUDE.md § 9.1).

---

## Deliverables: planned vs shipped

| Roadmap deliverable | Status | Notes |
|---|---|---|
| Next.js 16 + TypeScript + Tailwind + shadcn/ui scaffolding | ✅ | Tailwind v3 (matches mandated `tailwind.config.ts`); shadcn-style button/card/input |
| Drizzle ORM + Supabase connection wired | ✅ | Raw client (`src/db/client.ts`); tenant-aware factory deferred to Sprint 2 by design |
| ESLint + module boundary rules (dependency-cruiser) | ✅ | See deviation D1 below |
| Permission catalog drift check + calculation registry coverage check in CI | ✅ | `scripts/check-permission-catalog.ts`, `scripts/check-metric-registry.ts` |
| Prettier, typecheck (strict), Vitest setup | ✅ | Strict flags all preserved through Next's tsconfig rewrite |
| Sentry + Vercel Analytics wired | ✅ | Sentry inert until DSN provisioned; Analytics in root layout |
| Inngest local dev wiring + production project created | ⚠️ Partial | Client wired (`inngest/client.ts`); **production project = owner action** |
| Supabase project (EU region) provisioned | ⚠️ Owner | Code wired; **project provisioning = owner action** |
| Auth flow (Supabase Auth) baseline (email + password) | ✅ | SSR clients + session proxy + `/login` server action |
| Repository conventions documented in `/docs` | ✅ | 12 docs relocated to `docs/`; README updated |
| PR template installed (full Impact Analysis) | ✅ | `.github/PULL_REQUEST_TEMPLATE.md` |
| Architecture documentation copied into repo | ✅ | Already in repo; relocated under `docs/` |

**Pending owner provisioning (not a code gap):** Supabase, Vercel, Inngest, Sentry accounts + secrets. Tracked in `.env.example` and the PR follow-up list.

---

## Six-dimension compliance check

### 1. Multi-tenant compliance — PASS (n/a for content)
No tenant-scoped tables ship this sprint. The raw Drizzle client is documented as Sprint-1-only; Sprint 2 replaces it with the tenant-aware factory that requires `RequestContext` and runs `SET LOCAL app.current_org_id`. No query path that bypasses tenancy was introduced because no business queries exist yet.

### 2. RBAC compliance — PASS (n/a for content)
No actions, no permissions seeded. The permission catalog (`src/lib/permissions/catalog.ts`) is typed and empty; the drift check enforces `group:action` form, uniqueness, and the ≤24 MVP envelope. Platform vs customer permission separation is preserved structurally (separate `platform` module folder).

### 3. Audit compliance — PASS (n/a for content)
No audited entities ship. The `audit` module folder exists; tiered audit + outbox land in Sprint 4 per roadmap. No table allows UPDATE/DELETE from app code because no tables exist.

### 4. Documentation compliance — PASS
- Docs relocated to `docs/`; README links + run/deploy/provisioning sections updated.
- Sprint 1 marked complete in `docs/09-roadmap.md`.
- This review document created.
- Deviations from CLAUDE.md § 15 recorded below (D1–D4) in lieu of separate ADRs; recommend formal ADRs if the project owner wants them ratified.

### 5. Production-domain compliance — PASS (n/a)
Sprint did not touch the production domain. All production aggregate folders exist empty; no simplifications made.

### 6. Dashboard compliance — PASS (n/a)
No dashboards. Home + login are placeholders. No inline arithmetic, no KPIs, no Realtime write paths.

---

## TakstKontroll compatibility check (rule 4.7) — PASS
No estimate, invoice, procurement, audit, or cost-tracking code shipped. Nothing constrains future TakstKontroll compatibility.

## Single Source of Truth verification — PASS
No calculations introduced. Empty metric registry + coverage check guard against future duplication.

## Three Surfaces verification — PASS
- **User:** `/`, `/login`.
- **Admin:** none yet (roadmap: begins Sprint 2).
- **Dev:** `/dev/health`.
Every feature shipped this sprint has its applicable surfaces; admin surface is legitimately empty per the roadmap sequencing.

---

## Deviations from CLAUDE.md § 15 (faithful end-state, modernized mechanics)

- **D1 — ESLint:** Uses `typescript-eslint` flat config instead of the documented legacy `.eslintrc.cjs`. `eslint-config-next`'s bundled `eslint-plugin-react` crashes across the ESLint 9/10 boundary, and `FlatCompat` hit a circular-reference bug. **Consequence:** Next-specific + react-hooks lint rules are temporarily dropped. **Mitigation:** `dependency-cruiser` is the authoritative module-boundary gate; `@typescript-eslint` recommended + `no-explicit-any` cover the TS rules. **Follow-up:** re-add Next lint rules when ESLint 9/10 flat-config compatibility settles.
- **D2 — Drizzle config:** Uses the current `dialect` / `dbCredentials.url` API; the doc's `driver: 'pg'` form was removed in drizzle-kit 0.31.
- **D3 — Middleware:** `middleware.ts` → `proxy.ts` (Next 16 deprecated the filename).
- **D4 — Env typing:** `src/env.d.ts` augments `ProcessEnv` so `process.env.X` dot-access passes `noPropertyAccessFromIndexSignature`.

These were surfaced to and approved by the project owner before sprint close.

---

## CI gates (all green locally)

`typecheck` · `lint` · `format:check` · `depcruise` (no violations, 41 modules) · `check:permissions` · `check:metrics` · `test` (3/3) · `build` (4 routes, no warnings).

## Drift items found → resolution
None. Deviations D1–D4 are intentional modernizations, not drift.

## Sign-off
- [ ] Project owner confirms Sprint 1 closed and authorizes Sprint 2.
