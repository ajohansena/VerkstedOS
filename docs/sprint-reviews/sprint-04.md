# Sprint 04 Implementation Review — Audit + Outbox + Dev Control Plane v1

**Status:** Complete
**Date:** 2026-06-07
**Branch / PR:** `sprint-04/audit-outbox-dcp` → (PR pending push)
**Demoable outcome:** Confirmed — full-audited mutations write immutable `audit_events` + transactional `outbox_events` atomically (proven in tests); the publisher ships pending events; the hardened `/dev` surface (audit search, org/user inspection, universal search) returns 404 to non-platform users.

This review follows the six-dimension Implementation Review Gate (CLAUDE.md § 9.1). This is the last foundation sprint — the audit + tenant-isolation gates now protect every sprint after.

---

## Deliverables: planned vs shipped

| Roadmap deliverable | Status | Notes |
|---|---|---|
| `audit_events` partitioned by month | ✅ | Hand-authored `0005_audit_partitioned.sql` (RANGE on occurred_at, DEFAULT + monthly partitions, PK incl. partition key) |
| Audit writer enforced on full-audit tables | ✅ | `recordAuditEvent` with compile-time mandatory `reason` for transitions/deletions; wired into `assignRole`/`grantPermission` |
| Tiered audit (full/event/light/none) | ✅ | Full = audit_events; event = append-only rows; light = actor/timestamp columns; none = caches/projections |
| `outbox_events` + Inngest publisher | ✅ | `emitEvent` (transactional) + `publishPendingOutbox` core + Inngest cron function + `/api/inngest` |
| RLS on every foundation table | ✅ | `0006_audit_outbox_platform_rls.sql`; audit_events append-only (INSERT+SELECT only) |
| **Tenant isolation integration suite (gates merge)** | ✅ | 8 isolation + 5 audit/outbox + 9 RBAC = **22 integration tests**; CI runs `test:integration` |
| `platform_users`, `platform_role_assignments`, `platform_permissions`, `platform_role_permissions` | ✅ | Separate identity track; RLS-locked from tenants |
| `platform_audit_events` | ✅ | Partitioned; `logPlatformAudit` writer |
| `/dev` hardened middleware (IP allow-list + platform auth) | ✅ | `(dev)/layout.tsx` → `requirePlatformAccess`: IP allow-list (prod) → auth → active platform_users → else **404** |
| `/dev/audit` (cross-org audit search) | ✅ | Filter by org/entity/action |
| `/dev/orgs/[id]` (org inspection + health badge) | ✅ | Read-only via platform-inspector |
| `/dev/users/[id]` (user inspection) | ✅ | From Sprint 3, now under the hardened layout |
| `/dev/inspect` (universal entity search) | ✅ | Vehicle reg / case / customer / UUID |
| 2FA enforced on platform_users | ⚠️ Provisioning | Supabase Auth MFA is a project-level config; enforced at provisioning. Code path requires an active platform_users row + (in prod) IP allow-list. |

---

## Six-dimension compliance check

### 1. Multi-tenant compliance — PASS
- Every new tenant-scoped table (`audit_events`, `outbox_events`, `failed_events`) has `organization_id` + org-scoping RLS (FORCE).
- Platform tables are RLS-locked: invisible to tenant connections; resolved only via the service-role connection.
- Tenant-isolation suite still 8/8; audit/outbox suite verifies the audit insert runs under org RLS.

### 2. RBAC compliance — PASS
- Audited mutations (`assignRole`, `grantPermission`) call `requirePermission('admin:users')` first.
- Platform permission catalog (`platform:*`, ~18 codes) is a SEPARATE track from customer RBAC — no code path bridges them.

### 3. Audit compliance — PASS (the sprint's core)
- Full-audit primitive: `recordAuditEvent` inserts an immutable row in the SAME transaction as the mutation; `reason` is TypeScript-mandatory for transitions/deletions.
- `audit_events` is append-only — only INSERT + SELECT policies exist; the suite proves UPDATE/DELETE affect **zero rows** and the row survives unchanged.
- Outbox writes are transactional with the mutation (proven atomic in tests).
- Partitioned by month with retention-friendly structure.

### 4. Documentation compliance — PASS
Roadmap Sprint 4 marked complete; this review written; audit/platform tables already in the data-model + dev-control-plane docs. Mechanics recorded below.

### 5. Production-domain compliance — PASS (n/a)
No production-domain code.

### 6. Dashboard compliance — PASS (n/a)
Dev surfaces are operational inspection lists; no KPIs, no inline arithmetic, no Realtime.

---

## Critical / notable items

- **Append-only semantics.** A missing UPDATE/DELETE RLS policy does not raise an error in Postgres — it silently filters all rows out (zero rows affected). The test asserts zero-rows-affected + row-unchanged (the correct proof), not an exception. Worth remembering for future audit-tier tests.

## Deviations / mechanics

- **M1 — Partitioned tables hand-authored.** Drizzle can't express `PARTITION BY`, so `audit_events` / `platform_audit_events` live in `0005` (hand-authored) and are NOT in the schema barrel; their Drizzle table objects exist for typed queries only (excluded from `db:generate`).
- **M2 — Outbox publisher is Inngest-free at the core.** `publishPendingOutbox(send)` is pure plumbing (testable); the Inngest cron function injects the real `send`. The publisher uses the service-role connection (runs without org context by design).
- **M3 — `/dev` guard via layout, not middleware file.** Enforced in the `(dev)` route-group layout so every page is guarded uniformly; `/dev/health` (a route handler, not wrapped by layouts) stays intentionally open as the deploy check.
- **M4 — Migration numbering.** `0004` (drizzle: outbox/failed/platform tables) + hand-authored `0005` (partitioned audit) + `0006` (RLS/append-only). Snapshot in sync (`db:generate` → no diff).

---

## TakstKontroll compatibility check (rule 4.7) — PASS
The audit architecture (immutable, before/after, partitioned, full-tier with reason) is exactly what TakstKontroll will replay against. No truncation of payloads; no audit table allows UPDATE/DELETE.

## Single Source of Truth verification — PASS
One audit writer, one outbox emitter, one publisher core. No duplicated logic.

## Three Surfaces verification — PASS
- **User / Admin:** unchanged (as planned).
- **Dev:** `/dev/audit`, `/dev/inspect`, `/dev/orgs/[id]`, `/dev/users/[id]` — all behind the hardened guard; `/dev/health` open.

---

## CI gates (all green locally)

`typecheck` · `lint` · `format:check` · `depcruise` (no violations, 113 modules) · `check:permissions` (24) · `check:metrics` · `test` (unit 3/3) · `test:integration` (**22/22**: isolation 8 + RBAC 9 + audit/outbox 5, real Postgres) · `build` (13 routes incl. `/api/inngest` + 4 dev surfaces).

## Drift items → resolution
None. 2FA is a provisioning item (Supabase project config); all other deliverables shipped.

## Provisioning follow-ups (project-owner)
- Enable Supabase Auth MFA + seed `platform_users` for the founding team.
- Set `PLATFORM_ALLOWED_IPS` in production; configure the Inngest cron schedule.

## Sign-off
- [ ] Project owner confirms Sprint 4 closed and authorizes Sprint 5 (Phase 2 — Operational MVP).
