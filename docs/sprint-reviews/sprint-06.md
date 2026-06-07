# Sprint 06 Implementation Review — Case Core with Funding Sources

**Status:** Complete
**Date:** 2026-06-07
**Branch / PR:** `sprint-06/case-funding` → (PR pending push)
**Demoable outcome:** Confirmed in tests — an estimator creates one case funded by **three sources** (Fremtind insurance + deductible, Gjensidige insurance, customer self-pay); two insurance claims are created and linked; the case gets a sequential per-org number. The multi-funding model — the most distinctive part of VerkstedOS — works from day one.

This review follows the six-dimension Implementation Review Gate (CLAUDE.md § 9.1).

---

## Deliverables: planned vs shipped

| Roadmap deliverable | Status | Notes |
|---|---|---|
| `cases` table with key fields incl. `incident_tag` | ✅ | + `current_workshop_id` denorm, `parent_case_id`, per-org unique `case_number` |
| `case_funding_sources` with all five kinds | ✅ | insurance / private_pay / warranty / goodwill / internal_rework |
| `insurance_claims` linked to platform `insurance_companies` | ✅ | created inline during intake when `newClaim` is provided |
| `case_parties` for non-insurance third parties | ✅ | counterparty/witness/guarantor/third_party_payer/other |
| Case intake with funding allocation | ✅ | `createCase` — case + claims + funding in one transaction, validated |
| Case detail page (skeleton) | ✅ | `/cases/[id]` — header + funding sources + parties + add-funding |
| Case search (number, claim number, reg, customer) | ✅ | `searchCases` joins vehicle/customer/claim |
| Multi-funding scenario validation | ✅ | `validateFundingSet` (8 unit tests) — per-kind invariants, deny-on-save |

---

## Six-dimension compliance check

### 1. Multi-tenant compliance — PASS
- All 5 new tables have `organization_id NOT NULL` + org-scoping RLS (FORCE) in `0010_case_funding_rls.sql`.
- Repositories filter by `organization_id` explicitly; RLS backs it. Intake composes case + claims + funding in a single tenant transaction.
- Tenant-isolation suite 8/8; case suite runs through the non-superuser app role.

### 2. Business logic — PASS (SSoT)
- Funding invariants live in one place (`case/domain/case.ts` — `validateFundingSource`/`validateFundingSet`), consumed by the service and unit-tested. No duplication.
- Per-org case-number generation (`case-number.ts`) is the single owner of that format; `formatCaseNumber` is pure and reusable.

### 3. Audit compliance — PASS
- `createCase` and `addFundingSource` write `audit_events` + outbox events transactionally with the mutation.
- New events: `case.case.created`, `case.funding_source.added`.

### 4. Documentation compliance — PASS
Roadmap Sprint 6 marked complete; this review written; entities already in the data-model inventory; new events listed.

### 5. Production-domain compliance — PASS (n/a)
Production order/work segments are Sprint 8+. `current_workshop_id` is the documented denormalization (kept in sync by transfer events from Sprint 13); writable now for single-site flow per the data-model.

### 6. Dashboard compliance — PASS (n/a for KPIs)
Case pages are operational list/detail/search; no inline arithmetic; deductible amounts are displayed verbatim (no computed totals yet — that's finance, later).

---

## TakstKontroll compatibility check (rule 4.7) — PASS
The funding-source model is the spine TakstKontroll depends on: every funding source is preserved with its kind, claim link, deductible, and `references_case_id` back-link for warranty/rework. `internal_rework` keeps `references_case_id` + `rework_reason`. No aggregation that loses case-level traceability.

## Single Source of Truth verification — PASS
Funding validation: one owner. Case number: one owner. No KPIs yet.

## Three Surfaces verification — PASS
- **User:** `/cases` (search), `/cases/new` (intake), `/cases/[id]` (detail + add funding).
- **Admin:** per-org case-number format via `organizations.settings.caseNumberFormat` (consumed by the generator; default `{YYYY}-{SEQ}`). A dedicated settings screen is deferred to the org-config sprint; the data path + default ship now.
- **Dev:** `/dev/inspect` now returns cases (by case number + claim number); funding inspection via the case timeline.

---

## Deviations / mechanics

- **M1 — Insurance funding in the simple intake form.** The `/cases/new` form attaches a first non-insurance funding source; insurance funding (which needs insurer selection) is added on the case detail page. The full multi-source intake wizard with inline insurer pickers is a UX refinement for a later pass — the service + validation already support the full model (proven by the 3-funder integration test).
- **M2 — Admin case-number format screen deferred.** The per-org format is read from org settings with a sensible default; the editing UI lands with the broader org-config admin sprint.
- **M3 — FK name truncation NOTICE.** `case_funding_sources_deductible_payer_customer_id_customers_id_fk` exceeds 63 chars; Postgres truncates deterministically (harmless NOTICE). Functionally correct; snapshot in sync.
- **M4 — Migration numbering.** `0009_case_funding_tables` (drizzle) + hand-authored `0010_case_funding_rls`.

---

## CI gates (all green locally)

`typecheck` · `lint` · `format:check` · `depcruise` (no violations, 148 modules) · `check:permissions` (24) · `check:metrics` · `test` (unit **20/20** incl. 8 funding-validation tests) · `test:integration` (**36/36**: isolation 8 + RBAC 9 + audit/outbox 5 + customer/vehicle 9 + case-funding 5, real Postgres) · `build` (19 routes).

## Drift items → resolution
None. M1/M2 are documented UX-sequencing; M3/M4 are mechanics.

## Sign-off
- [ ] Project owner confirms Sprint 6 closed and authorizes Sprint 7 (Estimate import — DBS).
