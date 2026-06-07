# Sprint 05 Implementation Review — Customer & Vehicle

**Status:** Complete
**Date:** 2026-06-07
**Branch / PR:** `sprint-05/customer-vehicle` → (PR pending push)
**Demoable outcome:** Confirmed — an estimator creates customers (kind-aware, checksum-validated) and vehicles with owner/user split; ownership history is tracked automatically; the reg-plate field is wired to the Vegvesen adapter (returns `not_configured` until an API key is provisioned). Phase 2 (Operational MVP) has begun.

This review follows the six-dimension Implementation Review Gate (CLAUDE.md § 9.1).

---

## Deliverables: planned vs shipped

| Roadmap deliverable | Status | Notes |
|---|---|---|
| `customers` CRUD with kind-aware UI | ✅ | individual/company/leasing/fleet; `/customers`, `/customers/new` |
| `vehicles` CRUD with owner/user split | ✅ | `/vehicles`, `/vehicles/new`; separate owner/user customer FKs |
| Vegvesen lookup adapter (cached) | ✅ | `vegvesen_lookups` cache, 7-day TTL, cache-first; provider call gated behind `VEGVESEN_API_KEY` |
| 1881 lookup adapter (cached) | ✅ | `phone_lookups_1881` cache, 30-day TTL; gated behind `SVEVE_1881_API_KEY` |
| Customer search (name, phone, org_no, personnummer) | ✅ | `searchCustomers` ilike across name/phone/email/identifier |
| Vehicle search (reg, VIN, owner) | ✅ | `searchVehicles` on reg/VIN |
| Vehicle ownership history | ✅ | append-only `vehicle_ownership_history`; row on create + on owner/user/type change |
| Norwegian validation (personnummer + orgnummer checksums) | ✅ | `@/lib/validation/norwegian` (mod-11), 9 unit tests; enforced in customer service |

---

## Six-dimension compliance check

### 1. Multi-tenant compliance — PASS
- All new tables (`vegvesen_lookups`, `phone_lookups_1881`, `vehicle_ownership_history`) have `organization_id NOT NULL` + org-scoping RLS (FORCE) in `0008_customer_lookup_rls.sql`.
- Every repository query filters by `organization_id` explicitly; RLS is the backstop. Lookup-cache writes use the service-role connection (caches are audit-none).
- Tenant-isolation suite still 8/8; the customer/vehicle suite runs through the non-superuser app role.

### 2. RBAC compliance — PASS
- Customer/vehicle mutations call `requirePermission(ctx, 'case:edit')` (the existing catalog permission for case-adjacent data — no new permission introduced). Reads are session-scoped.

### 3. Audit compliance — PASS
- Customer/vehicle create/update/delete go through the full-audit writer (`recordAuditEvent`) transactionally; delete requires a `reason` (compile-time enforced).
- `vehicle_ownership_history` is append-only (event tier) — INSERT+SELECT RLS only.
- Lookup caches are audit tier none (per data-model).

### 4. Documentation compliance — PASS
Roadmap Sprint 5 marked complete; this review written; the three new tables are caches/projection consistent with the data-model conventions. New event types listed below.

### 5. Production-domain compliance — PASS (n/a)
No production-domain code.

### 6. Dashboard compliance — PASS (n/a for KPIs)
Customer/vehicle pages are operational list/search/CRUD; no inline arithmetic; no Realtime.

---

## New events (outbox)
`customer.customer.created` · `customer.customer.updated` · `customer.customer.deleted` · `customer.vehicle.created` · `customer.vehicle.updated`. All via the transactional outbox.

## TakstKontroll compatibility check (rule 4.7) — PASS
No estimate/invoice/parts code. Customer/vehicle model preserves the owner/user split and identifier integrity TakstKontroll relies on.

## Single Source of Truth verification — PASS
No KPI calculations. Identifier validation has one owner (`@/lib/validation/norwegian`), consumed by the customer service.

## Three Surfaces verification — PASS
- **User:** `/customers`, `/customers/new`, `/vehicles`, `/vehicles/new` (search + kind-aware CRUD + reg lookup).
- **Admin:** GDPR/retention — customer soft-delete with mandatory reason ships; a dedicated `/admin` data-retention/export screen is deferred to when the case/document model exists (noted below).
- **Dev:** `/dev/inspect` already returns customers + vehicles (Sprint 4); ownership history queryable.

---

## Deviations / mechanics

- **M1 — Admin GDPR surface partial.** The roadmap lists "customer data retention, GDPR export" under Admin. The data-layer foundation ships (soft-delete + reason + full audit + ownership history). A dedicated GDPR-export screen is most useful once cases/documents reference a customer (Sprint 6+), so the UI screen is deferred; the auditable delete path is live now. Flagged here rather than silently dropped.
- **M2 — Lookup adapters stubbed at the provider boundary.** Cache + parsing contract + TTL are real and tested; the live HTTP call is gated behind the API key and returns `not_configured` until provisioned. No fake data is cached.
- **M3 — Migration numbering.** `0007_customer_lookup_tables` (drizzle) + hand-authored `0008_customer_lookup_rls`. Snapshot in sync (`db:generate` → no diff).

---

## CI gates (all green locally)

`typecheck` · `lint` · `format:check` · `depcruise` (no violations, 133 modules) · `check:permissions` (24) · `check:metrics` · `test` (unit **12/12** incl. 9 validator tests) · `test:integration` (**31/31**: isolation 8 + RBAC 9 + audit/outbox 5 + customer/vehicle 9, real Postgres) · `build` (16 routes).

## Drift items → resolution
None. M1 is a documented scope-sequencing of the Admin GDPR screen; M2/M3 are mechanics.

## Provisioning follow-ups (project-owner)
- `VEGVESEN_API_KEY` + `SVEVE_1881_API_KEY` to enable live lookups.

## Sign-off
- [ ] Project owner confirms Sprint 5 closed and authorizes Sprint 6 (Case core with funding sources).
