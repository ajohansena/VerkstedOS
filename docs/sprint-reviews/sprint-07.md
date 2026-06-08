# Sprint 07 Implementation Review — Estimate Import (DBS)

**Status:** Complete
**Date:** 2026-06-08
**Branch / PR:** committed directly to `main` (per the new workflow agreed after Sprint 6).
**Demoable outcome:** Confirmed in tests — an estimator imports a normalized DBS takst onto a case; it lands as an immutable version-1 snapshot with labor time preserved in **periods** (100 = 1 hour); operations are allocated to funding sources; the estimate locks (immutable from there); a supplement supersedes the original on lock; a locked estimate cannot be edited (service guard + RLS).

This review follows the six-dimension Implementation Review Gate (CLAUDE.md § 9.1).

---

## Research grounding (real DBS format)

The estimate model was built from the actual DBS material the project owner supplied (now in `docs/reference/dbs/`):
- **EN64251.pdf** — a real Takstrapport (estimate) example.
- **FNF_Integrasjonsguide.pdf** — the DBS↔insurer message protocol (Oppdrag, `sendOppdrag`, REST+token).
- Contracts reference: produksjon.webdbs.no/Kontrakter/Kontrakter.htm.

**Verified the "periods" rule directly from the data:** Karosseriarbeide `Tid 3260` × rate 955 = 31,133 NOK ⇒ 32.60 hours; Lakkarbeide `Tid 1091` × 1175 = 12,819.25 ⇒ 10.91 hours. So **`Tid` is in periods, 100 periods = 1 hour.** Periods are stored verbatim (immutable snapshot); conversion is the SSoT calc `periodsToHours`.

The estimate's observable structure (Sammenstilling header, Arbeidsspesifikasjon operations, Reservedelsspesifikasjon parts, Detaljspesifikasjon labor detail, totals) maps directly to the six estimate tables.

---

## Deliverables: planned vs shipped

| Roadmap deliverable | Status | Notes |
|---|---|---|
| DBS file parser adapter | ✅ | `parseDbsEstimate` validates a normalized DBS payload (Zod) → entities; `DbsParseError` on bad input |
| `estimate_imports` with DRAFT→ACTIVE→LOCKED | ✅ | + `superseded`; version chain via `supersedes_id`; `kind` original/supplement/re_estimate |
| `estimate_documents/operations/labor_lines/paint_lines/parts/totals` (immutable when locked) | ✅ | all carry periods verbatim; immutability via service + RLS UPDATE guard |
| Estimate detail UI with funding allocation per line | ✅ | `/cases/[id]/estimate` shows ops (periods→hours), parts, totals; lock action; per-line funding via `allocateOperationFunding` |
| Correction mechanism / supersession via new versions | ✅ | supplements supersede on lock; locked rows never edited in place (rule 4.7) |
| `integration_inbox` landing zone | ✅ | raw payload landed first (audit/replay), then processed; parse errors recorded |
| `/dev/integrations/dbs` (import history, parse errors, replay) | ✅ | inbox list + received/processed/failed stats; replay tooling builds on stored raw payloads |

---

## Six-dimension compliance check

### 1. Multi-tenant compliance — PASS
- All 8 new tables have org scoping; RLS (FORCE) in `0012_estimate_rls.sql`. Repos filter by `organization_id` explicitly.
- `integration_inbox` is the documented pre-context landing zone (nullable org; service-role writes); reads org-scoped once assigned.
- Tenant-isolation suite 8/8; estimate suite runs through the non-superuser app role (incl. the immutability RLS check).

### 2. RBAC compliance — PASS
- Import/correct require `estimate:edit`; lock requires `estimate:lock` (both existing catalog permissions — none added).

### 3. Audit compliance — PASS
- Import creation, funding allocation, and lock all write `audit_events` transactionally; lock uses action `transitioned` with a mandatory reason. New events: `estimate.import.created`, `estimate.import.locked`, `estimate.import.superseded`.

### 4. Documentation compliance — PASS
- Roadmap Sprint 7 marked complete; this review written; reference PDFs filed under `docs/reference/dbs/`; new events + the periods rule documented here and in the calc's doc comment.

### 5. Production-domain compliance — PASS (n/a)
- No production-domain code. The estimate's labor periods are the input the Sprint 10 work-segment planner will consume — kept verbatim for that purpose.

### 6. Dashboard compliance — PASS
- Estimate UI shows labor in hours via the SSoT `periodsToHours` — **no inline `/100`** anywhere in presentation. No KPIs, no Realtime.

---

## TakstKontroll compatibility check (rule 4.7) — PASS (central to this sprint)
- Estimates are **immutable versioned snapshots**: locked imports + their child lines are never edited in place; corrections create a new version that supersedes the prior one. Enforced twice (service + RLS UPDATE guard restricted to unlocked imports).
- Periods stored verbatim; money as `numeric(14,2)` + currency; per-line `funding_source_id` retained for line-for-line comparison. No truncation, no in-place edits, no destructive deletes. This is exactly the substrate TakstKontroll will replay against.

## Single Source of Truth verification — PASS
- Periods→hours and estimate labor roll-ups have ONE owner (`estimating/application/calculations/estimate-labor.ts`), registered in `src/metrics/registry.ts` (`periods_to_hours`, `estimate_labor_hours`). The UI and tests call it; no duplicate conversion.

## Three Surfaces verification — PASS
- **User:** `/cases/[id]/estimate` (import, view ops/parts/totals in hours, lock, per-line funding).
- **Admin:** estimate retention follows the global audit/retention policy (no estimate-specific admin screen needed this sprint).
- **Dev:** `/dev/integrations/dbs` (inbox history, parse errors, stats); estimates visible via `/dev/inspect` through their case.

---

## Deviations / mechanics

- **M1 — Normalized payload, not raw DBS transport.** Per ADR-004 (one-way import for MVP) and the No Cleverness rule, the parser consumes a NORMALIZED JSON shape; a thin transport layer maps the actual SOAP `sendOppdrag` / REST message to it when the live DBS connection is provisioned. The parsing contract, immutability, periods handling, and funding allocation are all real and tested now.
- **M2 — Migration numbering.** `0011_estimate_tables` (drizzle) + hand-authored `0012_estimate_rls`. Snapshot in sync.
- **M3 — Harmless FK-name truncation NOTICE** for `estimate_paint_lines`/`estimate_parts` funding FK (>63 chars); Postgres truncates deterministically.

---

## CI gates (all green locally)

`typecheck` · `lint` · `format:check` · `depcruise` (no violations, 168 modules) · `check:permissions` (24) · `check:metrics` (2) · `test` (unit **29/29** incl. 9 estimating: periods + parser) · `test:integration` (**43/43**: isolation 8 + RBAC 9 + audit/outbox 5 + customer/vehicle 9 + case-funding 5 + estimate 7, real Postgres) · `build` (21 routes).

## Drift items → resolution
None. M1 is the documented MVP transport boundary (ADR-004); M2/M3 are mechanics.

## Provisioning follow-ups (project-owner)
- Live DBS connection (SOAP `sendOppdrag` / REST + token) + the transport→normalized mapping, when DBS access is granted.

## Sign-off
- [ ] Project owner confirms Sprint 7 closed and authorizes Sprint 8 (Production workflow — REMEMBER the Sprint 8 guardrail: cases.status is a projection; ProductionOrder is a container; workflow states are not the source of truth).
