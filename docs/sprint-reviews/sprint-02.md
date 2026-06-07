# Sprint 02 Implementation Review — Identity & Multi-Tenancy Core

**Status:** Complete
**Date:** 2026-06-07
**Branch / PR:** `sprint-02/identity-tenancy` → (PR pending push)
**Demoable outcome:** Confirmed via the tenant-isolation suite — two orgs, isolation enforced through the real `withTransaction` production path. UI: signed-in user sees their org + workshops and can switch orgs; `/admin` lists workshops; `/dev/orgs` lists orgs cross-tenant.

This review follows the six-dimension Implementation Review Gate (CLAUDE.md § 9.1).

---

## Deliverables: planned vs shipped

| Roadmap deliverable | Status | Notes |
|---|---|---|
| `organizations`, `workshops`, `workshop_departments`, `users`, `memberships` tables | ✅ | + indexes, org-level unique constraints, soft-delete columns |
| Tenant-aware Drizzle client with session-var enforcement | ✅ | `withTransaction` sets `app.current_org_id`/`current_user_id`/`current_workshop_id` via `set_config(…, true)` (txn-scoped) |
| AsyncLocalStorage request-context propagation | ✅ | `src/lib/tenancy/context.ts` — `runWithContext` / `requireContext` |
| Org switcher in UI (multi-org users) | ✅ | `src/components/org-switcher.tsx` + `switchOrganization` server action (membership-validated) |
| Initial tenant-isolation integration tests | ✅ | 8 tests, real Postgres via Testcontainers, run as **non-superuser** role |
| Customer table with `kind` discriminator | ✅ | individual / company / leasing_company / fleet_operator |
| Vehicle table with separate owner/user | ✅ | `owner_customer_id` + `user_customer_id` |
| Platform-shared `insurance_companies` seeded | ✅ | 10 Norwegian insurers; idempotent seed + `pnpm db:seed` |

**Note on the demoable:** the roadmap demo ("a user in two orgs switches between them") is proven by the isolation test (two orgs, scoped reads through `withTransaction`) and the org-switcher UI. A live two-user click-through requires Supabase provisioning (owner action); no dev org/user seed ships because those rows must correspond to real Supabase Auth users.

---

## Six-dimension compliance check

### 1. Multi-tenant compliance — PASS
- Every tenant-scoped table has `organization_id NOT NULL` (FK `ON DELETE RESTRICT`).
- All reads/writes go through the tenant-aware client (`withTransaction`) or the explicit, grep-able `getRawClient({ as })` escape hatch (used only for pre-context bootstrap: membership resolution, user upsert, platform inspection).
- RLS present on every table **before** API exposure (org-scoping policies in `0001_rls_policies.sql`, `FORCE ROW LEVEL SECURITY`).
- Tenant-isolation suite gates merge: proves scoped reads, `WITH CHECK` write blocking, no-context = no rows, WHERE-spoof defeated, and the production `withTransaction` path — all as a non-superuser role (RLS only binds non-superusers).
- No cross-tenant leak path: repositories filter by `organization_id` explicitly (primary defense) **and** RLS backs it (defense-in-depth).

### 2. RBAC compliance — PASS (n/a for content)
No permissions/roles this sprint (Sprint 3). `accessibleWorkshopIds` is org-wide for now; role-scoped narrowing arrives with RBAC. No permission added to the catalog.

### 3. Audit compliance — PASS (deferred tiers documented)
Light-tier actor/timestamp columns (`created_by`/`updated_by`/`created_at`/`updated_at`/`deleted_at`) on all new tables. Full before/after audit (`audit_events` + repository wrapper) is a Sprint 4 deliverable per roadmap; no table allows app-layer hard delete (soft-delete columns in place).

### 4. Documentation compliance — PASS
- Roadmap Sprint 2 marked complete.
- This review created.
- Tables already enumerated in `docs/03-data-model.md` entity inventory (no drift).
- Sequencing decision recorded below (S1).

### 5. Production-domain compliance — PASS (n/a)
Sprint did not touch the production domain.

### 6. Dashboard compliance — PASS (n/a)
No dashboards/KPIs. Admin + home are operational lists; no inline arithmetic; no Realtime write paths.

---

## TakstKontroll compatibility check (rule 4.7) — PASS
No estimate/invoice/parts/audit code shipped. Customer/vehicle/funding scaffolding preserves the documented shapes.

## Single Source of Truth verification — PASS
No calculations introduced.

## Three Surfaces verification — PASS
- **User:** `/` (greeting + workshops + org switcher), `/login`.
- **Admin:** `/admin` (org + workshop list).
- **Dev:** `/dev/orgs` (cross-org list), `/dev/health`.

---

## Sequencing decisions

- **S1 — RLS timing.** The roadmap lists "RLS on every foundation table" under Sprint 4, but CLAUDE.md § 4.2 ("RLS present before any table is exposed via API") and Appendix C ("no migration without RLS policy") are hard rules, and Sprint 2 exposes these tables. Resolution: ship **org-scoping RLS now** (`0001_rls_policies.sql`); Sprint 4 extends policies with `app.has_permission()` once RBAC exists, and adds the broader gating suite. Satisfies both documents.

## Deviations / mechanics

- **M1 — Migration runner.** `db:migrate` uses a small custom runner (`src/db/migrator.ts`) instead of `drizzle-kit migrate`, because hand-authored RLS `.sql` files live alongside the generated migration and must be applied in order. The same runner backs the isolation-test harness, so tests exercise the exact production SQL.
- **M2 — Enum emission.** Enums must be re-exported from the schema barrel for drizzle-kit to emit `CREATE TYPE`; done in `src/db/schemas/index.ts`.

---

## CI gates (all green locally)

`typecheck` · `lint` · `format:check` · `depcruise` (no violations, 70 modules) · `check:permissions` · `check:metrics` · `test` (unit 3/3) · **`test:integration` (tenant isolation 8/8, real Postgres)** · `build` (6 routes, no warnings). CI updated to run `test:integration` as a merge gate.

## Drift items found → resolution
None. S1 is a documented sequencing reconciliation; M1/M2 are mechanics.

## Sign-off
- [ ] Project owner confirms Sprint 2 closed and authorizes Sprint 3.
