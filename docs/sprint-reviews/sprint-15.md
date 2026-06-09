# Sprint 15 Implementation Review — Parts Financial Reconciliation & Invoice Basis → Accounting Export

**Status:** Complete
**Date:** 2026-06-09
**Branch / PR:** committed directly to `main` (incremental commits).
**Demoable outcome:** A locked DBS estimate on an insurance case with a deductible generates **two invoice bases** — the insurance "fakturagrunnlag" (net of the deductible) and a separate **deductible (egenandel) basis** billed to the customer — that provably sum to the estimate. Approving both and pressing **Export** writes one **immutable accounting export** (with a SHA-256 payload hash + voucher reference) to Tripletex and flips each basis to `exported`. Generation/approval happens in the Case Workspace finance section; the cross-case `/finance` surface shows what's ready to book plus the immutable export log.

This review follows the six-dimension Implementation Review Gate (CLAUDE.md § 9.1).

---

## Deliverables: planned vs shipped

| Deliverable | Status | Notes |
|---|---|---|
| `invoice_basis` (+ `invoice_basis_lines`) per funding source | ✅ | one basis per active funding source; deductible carved as its own `kind=deductible` basis |
| Deductible (egenandel) split | ✅ | negative transfer line on the insurance basis + a positive deductible basis to the payer; the two net to the estimate |
| Internal cost separation (goodwill / rework) | ✅ | `kind=internal` basis — flows to accounting, never as an external invoice (TakstKontroll) |
| VAT + basis-total SSoT calculations | ✅ | `calculateLineVat`, `calculateInvoiceBasisTotals` — registered metrics, no inline money math |
| Invoice-basis allocation planner | ✅ | pure `planInvoiceBases` owns the allocation rules; fully unit-tested |
| Approval lifecycle (draft → approved → exported) | ✅ | approval locks a basis; cancel guarded against exported/settled |
| Immutable accounting export + Tripletex adapter | ✅ | content-hashed export record; env-gated adapter (simulated in dev) with retry-in-place |
| `/finance` controller surface + case finance section | ✅ | Norwegian; approved-to-export table + immutable export log; per-case generate/approve/cancel |
| Per-case grouped reconciliation UI, `internal_cost_records`, bulk flows, email ingestion | ⏸ Deferred (D1) | the spine + SSoT ship now; the richer reconciliation views move to the next finance iteration |

---

## Six-dimension compliance check

### 1. Multi-tenant compliance — PASS
- Four new tables (`invoice_basis`, `invoice_basis_lines`, `accounting_exports`, `accounting_export_lines`) are `organization_id`-scoped with FORCE RLS (migration `0036_finance_invoicing_rls.sql`, modelled on `0034`). Platform inspectors get read access via `app_is_platform_inspector()`. Basis numbers are unique per org (`FG-{YYYY}-{NNNN}`). Tenant isolation suite still green — 18 integration files, 109 tests.

### 2. RBAC compliance — PASS
- Generation/approval use `finance:invoice`; export uses `finance:export`; the `/finance` read surface uses `finance:view`. **No new permissions — catalog stays frozen at 24** (`check:permissions` green). All three finance permissions pre-existed in the catalog.

### 3. Audit compliance — PASS (tiered correctly)
- All mutations (`generateInvoiceBasisForCase`, `approveInvoiceBasis`, `cancelInvoiceBasis`, `exportApprovedBases`, `retryExport`) are full-audited via `recordAuditEvent` (past-tense actions). New outbox events: `finance.invoice_basis.generated/approved/cancelled`, `finance.accounting_export.sent/failed`. The accounting export carries a SHA-256 payload hash as immutability evidence (Bokføringsloven traceability).

### 4. Documentation compliance — PASS
- This review; roadmap Sprint 15 marked delivered; two new metrics registered (`invoice_line_vat` → `finance/calculateLineVat`, `invoice_basis_total` → `finance/calculateInvoiceBasisTotals`); `check:metrics` green (12 metrics).

### 5. Production-domain compliance — PASS
- No production aggregate touched. The invoice basis is a projection of the LOCKED estimate (immutable source) + the funding sources; it never edits the estimate. The deductible split is a deterministic allocation, not a business judgment — the genuine business decisions (which funding source, deductible amount) remain human inputs captured upstream on the case.

### 6. Single-Source-of-Truth compliance — PASS
- All money arithmetic lives in `finance/application/calculations` and is registered. The basis generator, approval flow, export, UI preview, and Dev inspector call the same `calculateLineVat` / `calculateInvoiceBasisTotals`. Summing already-rounded line amounts (not re-deriving from a net total) guarantees header = sum of printed lines — the invariant an auditor checks.

---

## TakstKontroll guardrail (§ 4.7) — preserved
Every invoice basis and line stays attributable to its `case_id` + `funding_source_id`. Internal cost (goodwill / internal_rework) is a separate `kind=internal` basis that never mixes with externally-invoiced amounts. The deductible is carved to its own basis with `deductible_of_funding_source_id` back-reference, so the insurance and customer portions stay separable and provably sum to the estimate (asserted in the integration test).

---

## Testing

- **Unit:** 77 passing (14 new: `invoice-vat.test.ts` — line VAT incl. fractional hours / zero-rate / negative deductible line, basis totals netting; `plan-invoice-bases.test.ts` — private single basis, goodwill→internal, the deductible split summing to the estimate, sequence ordering).
- **Integration:** 109 passing across 18 files (new `finance-invoicing.test.ts`: generate insurance + deductible bases that sum to the estimate → refuse regenerate → approve both → export to one immutable record with lines → refuse empty export, against real Postgres + RLS).
- **Gates:** `typecheck` ✅, `lint` ✅, `depcruise` ✅ (371 modules, cross-module imports only through `public/`), `check:metrics` ✅ (12), `check:permissions` ✅ (24), `build` ✅ (`/finance` route present).

---

## Deferred / follow-ups
- **D1 — Per-case grouped reconciliation UI** (supplier invoice ↔ basis ↔ funding source, side by side) + auto-match thresholds.
- **D2 — `internal_cost_records`** as a first-class table (currently modelled as `kind=internal` bases) + a margin/profitability read.
- **D3 — Bulk receipt/invoice + email-attachment ingestion** for supplier documents.
- **D4 — Per-line funding allocation across multiple external payers** (today the primary funding source by sequence receives the estimate category lines; the deductible split is fully modelled).
- **D5 — Live Tripletex API wiring** (the adapter is env-gated and runs simulated in dev; the contract + immutable export record are in place).

---

## The eight-hour test
The controller opens `/finance`, sees exactly which approved bases are ready to book and the immutable history of what was sent — no spreadsheet reconciliation. On a case, generating the basis is one click from the locked estimate, the deductible is handled automatically the Norwegian way, and approval/export never silently rewrite history. Placeholder finance UI is gone.
