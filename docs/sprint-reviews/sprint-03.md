# Sprint 03 Implementation Review — RBAC

**Status:** Complete
**Date:** 2026-06-07
**Branch / PR:** `sprint-03/rbac` → (PR pending push)
**Demoable outcome:** Confirmed by the RBAC integration suite — a Technician can `time:self` and `production:transition` but not `finance:view`/`admin:users`; an Owner holds every permission; deny-wins and grant overrides both verified live.

This review follows the six-dimension Implementation Review Gate (CLAUDE.md § 9.1).

---

## Deliverables: planned vs shipped

| Roadmap deliverable | Status | Notes |
|---|---|---|
| `permissions` catalog (~24 MVP permissions) | ✅ | Exactly 24 (8 groups × 3) — permissions are CODE in `src/lib/permissions/catalog.ts`, drift-checked |
| `roles`, `role_permissions`, `role_assignments` tables | ✅ | + soft-delete, org-leading indexes |
| `user_permission_grants` (grant/deny) | ✅ | `reason` NOT NULL (paper trail); deny wins |
| `has_permission()` SQL function + TS helper | ✅ | `app_has_permission(code)` (coarse, cache-backed) + scope-aware TS resolver `hasPermission` / `requirePermission` |
| `effective_permissions_cache` + trigger refresh | ✅ | Recompute fns + triggers on role_assignments / role_permissions / user_permission_grants (SECURITY DEFINER) |
| Six standard roles seeded | ✅ | Owner, Admin, Estimator, Technician, Accounting, Viewer — seeded per org on onboarding (idempotent on `key`) |
| Admin UI: invitation, role assignment, permission viewing | ✅* | `/admin/users`, `/admin/roles` (viewing + role assignment service + grant service). *Email invitation delivery is a thin Supabase wrapper pending provisioning; the data side (`addMembershipWithRole`) ships. |
| Permission discipline enforced | ✅ | `check:permissions` enforces ≤24 + `group:action`; PR template carries the justification gate |

---

## Six-dimension compliance check

### 1. Multi-tenant compliance — PASS
- Every RBAC table has `organization_id NOT NULL` + org-scoping RLS (FORCE) in `0003_rbac_rls.sql`.
- All service reads/writes go through the tenant client; bootstrap/seed uses the service-role connection (see critical fix C1).
- Tenant-isolation suite still 8/8; RBAC tables covered by the same org-scoping policies + verified by the RBAC suite running as the non-superuser app role.

### 2. RBAC compliance — PASS
- Permissions are code; roles are data. `requirePermission` is the service-layer guard; RLS `app_has_permission` is the coarse backstop (both layers present).
- Permission discipline honoured: catalog is exactly the 24 from ADR-018; no new categories. `admin:users` gates the management surfaces.
- Platform permissions remain a separate track (untouched; Sprint 4).

### 3. Audit compliance — PASS (tiers deferred as planned)
Light-tier actor/timestamp columns on all RBAC tables; `user_permission_grants.reason` mandatory. Full `audit_events` + repository wrapper remain Sprint 4. `effective_permissions_cache` is audit-tier none (a projection).

### 4. Documentation compliance — PASS
Roadmap Sprint 3 marked complete; this review written; tables already in the data-model inventory; the critical tenancy fix (C1) and naming deviations recorded below.

### 5. Production-domain compliance — PASS (n/a)
No production-domain code.

### 6. Dashboard compliance — PASS (n/a for KPIs)
Admin/dev pages are operational lists; permissions HIDE surfaces (404), never grey-out (doc 11 principle 8). No inline arithmetic; no Realtime.

---

## Critical issue fixed this sprint

- **C1 — Admin/bootstrap connection bypass.** Building the authz layer surfaced that `getRawClient({ as })` returned the *tenant* connection. In production that connection is a non-superuser role under FORCE RLS; pre-org-context reads (membership resolution in `resolveRequestContext`) set no `app.current_org_id` and would return **zero rows**, silently breaking login. This passed Sprint 2 only because the path wasn't integration-tested. **Fix:** `getRawClient` now uses a separate service-role connection (`DATABASE_URL_ADMIN`) that bypasses RLS — the standard Supabase model. Tenant operations stay on `DATABASE_URL` (RLS enforced). The RBAC suite exercises both connections (admin seeds as superuser, reads as the app role). Flagged under the "fix only if critical" instruction; this qualified.

## Deviations / mechanics

- **M1 — SQL helper naming.** Functions use the `app_` prefix (`app_has_permission`, `app_current_user_id`) rather than an `app.` schema, consistent with the Sprint 2 helpers. Behaviour matches the doc's `app.has_permission`.
- **M2 — Cache scope.** `effective_permissions_cache` is org-coarse (per doc). The scope-aware (workshop/department) and live-time-window resolution is authoritative in the TS resolver; the cache backs fast fail-closed RLS. Time-expiry of temporary grants refreshes on next change (trigger-based) — the TS resolver always applies live time windows.
- **M3 — Migration naming.** Generated migration renamed to `0002_rbac_tables.sql`; hand-authored `0003_rbac_rls.sql` carries RLS + functions + triggers. Snapshot kept in sync (`db:generate` → no diff).

---

## TakstKontroll compatibility check (rule 4.7) — PASS
No estimate/invoice/parts/audit code. RBAC is orthogonal to TakstKontroll's data needs.

## Single Source of Truth verification — PASS
No KPI calculations. Permission resolution has a single owner (`permission-resolver.ts`); the SQL cache function is a derived projection of the same role/grant data.

## Three Surfaces verification — PASS
- **User:** permission-gated rendering (surfaces hidden via 404) + `PermissionDeniedError` with the specific missing permission.
- **Admin:** `/admin/users`, `/admin/roles` (+ `assignRole` / `grantPermission` services).
- **Dev:** `/dev/users/[id]` — memberships, role assignments, effective permissions per org.

---

## CI gates (all green locally)

`typecheck` · `lint` · `format:check` · `depcruise` (no violations, 87 modules) · `check:permissions` (24) · `check:metrics` · `test` (unit 3/3) · `test:integration` (**isolation 8/8 + RBAC 9/9 = 17/17**, real Postgres) · `build` (8 routes).

## Drift items → resolution
None. C1 is a critical fix; M1–M3 are mechanics/naming.

## Sign-off
- [ ] Project owner confirms Sprint 3 closed and authorizes Sprint 4.
