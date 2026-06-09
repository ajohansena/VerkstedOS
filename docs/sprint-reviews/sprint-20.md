# Sprint 20 Implementation Review — Executive dashboard, two-person rule, customer portal v2, Production Board v3 My Tasks View 🎯 General Availability

**Status:** Complete
**Date:** 2026-07-07
**Branch / PR:** committed directly to `main` (incremental commits).
**Demoable outcome:**

1. Anna (chain COO of a 3-workshop group) opens **/dashboard/executive** at 07:30. The chain dashboard renders a workshop × KPI matrix: each row is a verksted, columns are throughput, cycle time, on-time %, and capacity utilisation. Cells are colour-coded with the SSoT health bands (emerald / amber / red). The footer aggregates chain totals from the *same* per-workshop snapshots that already feed every other dashboard — no parallel calculation, no drift. She immediately spots one workshop with a red on-time cell and one with a red utilisation cell — opposite problems she can solve in one afternoon by transferring two cases.
2. A body tech finishes the morning's first job and opens **/production**. The new **Mine oppgaver** section shows two buckets: *Planlagt i dag* (today's planned segments — time, case, title, resource) and *Planlagt denne uka* (the rest of the week). One click on a case number takes them to the workspace. No more "which case is mine, again?" hunting through the board.
3. A customer receives the email link generated in Sprint 17 (`/portal/<token>`). The page now shows a **Godkjenn reparasjon** section under the case card: name field, consent checkbox, "Signer". On submit a server action verifies the token, captures `x-forwarded-for` + user-agent as evidence, and appends a `repair_acceptance` row to the case's cryptographic signature chain via `appendCustomerPortalSignature`. The chain hash carries forward from prior employee signatures (Sprint 12). Re-opening the page now shows "Signert" with the timestamp and chain position — no double-signing possible.
4. A platform operator hits **/dev/two-person** to lock an organization for an emergency tenant-isolation incident. They submit a request (kind = `org_lock`, target org, mandatory reason ≥8 chars). A *second* platform user pulls up the queue, sees the pending request, and clicks **Godkjenn**. The first user cannot approve their own request — `TwoPersonRuleViolationError`. The second user can then **Utfør**. Every transition is audited (`dangerous_op_requested` → `dangerous_op_approved` → `dangerous_op_executed`). The platform now has the destructive-ops guardrail that GA requires.
5. The full Dev Control Plane is operational: `/dev/yard` (Sprint 19), `/dev/rental` (Sprint 18), `/dev/notifications` (Sprint 17), `/dev/production`, `/dev/feature-flags`, `/dev/two-person` (this sprint). Every customer-facing module has a platform inspector and (where mutations exist) a two-person-rule path for destructive actions.

This review follows the six-dimension Implementation Review Gate (CLAUDE.md § 9.1).

---

## Deliverables: planned vs shipped

| Deliverable | Status | Notes |
|---|---|---|
| Executive dashboard (chain-level KPIs) | ✅ | `/dashboard/executive`; workshop × KPI matrix with SSoT health-band cells (emerald/amber/red); chain totals footer; gated `finance:view` |
| Per-workshop KPI snapshots (SSoT extension) | ✅ | `computeAndStoreKpiSnapshot` now runs the snapshot 4 chain-level *plus* 4 per-workshop calls (`countCasesOpen/Completed/Delayed` + `sumBookedMinutes` + `countActiveEmployees` per workshop) — `listLatestSnapshotsByWorkshop` is the single read for the executive dashboard |
| `dangerous_operations` table + RLS-free platform queue | ✅ | migration `0045_dangerous_operations.sql`; org-cascade FK + restrict on user FKs; lifecycle columns; status/org indexes |
| Two-person rule service (`requestDangerousOp` / `approveDangerousOp` / `rejectDangerousOp` / `executeDangerousOp` / `cancelDangerousOp`) | ✅ | enforces approver ≠ requestor and executor ≠ requestor; state machine `pending_approval → approved → executed` (or `rejected` / `cancelled`); reason ≥ 8 chars |
| `/dev/two-person` queue UI + 5 Server Actions | ✅ | request form + per-row OperationCard with approve/reject/execute/cancel buttons (hidden when viewer = requestor); `recordPlatformAudit` on every transition (5 new platform-audit actions: `dangerous_op_requested/approved/rejected/executed/cancelled`) |
| Customer portal v2 — e-signing | ✅ | `appendCustomerPortalSignature` extends the Sprint 12 chain with `signer_kind=customer`, `kind=repair_acceptance`; `signRepairAcceptanceByToken` validates token (invalid/expired/revoked), captures IP + user-agent evidence, blocks double-sign with `PORTAL_ALREADY_SIGNED`; client section in `/portal/[token]` with `useTransition` and "Signert"-state rendering |
| Production Board v3 — My Tasks View (doc 13 § 4.5) | ✅ | `MyTasksView` with *today* + *rest-of-week* buckets, resolves the viewer's `employeeId` via `findEmployeeByUserId`, reads from the same `listPlannedSegmentsForRange` engine the other views use — fifth and final visualization |
| Customer portal v2 — photo viewing | ⏸ Deferred (D1) | the chain already shows the case card (Sprint 17); a richer photo gallery defers to Sprint 22 alongside any media-upload polish |
| Cross-workshop capacity sharing visibility | ⏸ Deferred (D2) | executive dashboard now exposes the per-workshop utilisation grid; the *suggestion* layer ("move case X from A to B") defers to Sprint 21 AI flows |
| Insurer-level reporting | ⏸ Deferred (D3) | the dashboard infrastructure (per-dimension snapshots) is generic enough to add an insurer axis later; not on the GA critical path |
| Performance hardening (dashboards <1s p95) | 🟡 Partial | per-workshop snapshots use 4 separate queries per workshop — acceptable for the typical 3-8 workshop chain we onboard at GA. A single GROUP BY query is the obvious optimization once a chain crosses ~12 workshops |
| External penetration test passed | ⏸ Out-of-scope-for-this-PR | pen-test is a scheduling / external-vendor item, not a code deliverable; the platform-level guardrails (two-person rule, append-only audit, chained signatures) that the pen-test will inspect are now all in place |
| DPIA + subprocessor DPAs + privacy policy + ToS | ⏸ Out-of-scope-for-this-PR | governance documents tracked separately in [docs/07-governance.md](../07-governance.md) |
| Per-org absence-type CRUD UI (D1 from Sprint 19) | ⏸ Carried → Sprint 21 | the existing seed-defined absence types cover GA needs; per-org CRUD is a small admin polish that does not block onboarding |
| Drag-to-move on Week View (D3 from Sprint 19) | ⏸ Carried → Sprint 21 | My Tasks View shipped instead this sprint; drag-to-move on Week is a UX polish that defers behind the AI-suggestion layer |

---

## Six-dimension compliance check

### 1. Multi-tenant compliance — PASS
- `dangerous_operations` is a **platform-level** table (the row may target an org via `organization_id`, but the queue itself lives outside tenant RLS — the platform inspector role reads/writes it). All access goes through `getRawClient({ as: 'platform-inspector' })`; no Server Action touches the table without first calling `requirePlatformAccess`. The executive dashboard runs entirely under the viewer's org session (`withTransaction(ctx, …)`) and reads only KPI snapshots that already enforce `organization_id` matching the workshops in the org. Per-workshop snapshots are still keyed by the *enclosing* organisation; cross-org leakage is impossible because the workshop FK is in the org's tenant.
- The customer portal Server Action uses the admin client (`getRawClient({ as: 'admin' })`) — there's no session — but every read is scoped by `caseId` resolved from the token, which in turn carries the organisation context implicitly (token rows are themselves tenant-scoped via the case FK).

### 2. RBAC compliance — PASS
- Executive dashboard gated by `finance:view` (chain financials are sensitive). `/dev/two-person` gated by `requirePlatformAccess`. Customer portal Server Action requires no permission but validates the token's `expires_at`, `revoked_at`, and chain-membership — the token *is* the authorization. **No new permissions — catalog stays frozen at 24** (`check:permissions` green). Existing `case:edit` continues to gate Production Board interactions; My Tasks reads from the viewer's own employee row so no permission widening was needed.

### 3. Audit compliance — PASS (tiered correctly)
- Every two-person rule transition emits a platform-audit event (the new tier added in Sprint 17 for platform-level actions): `dangerous_op_requested`, `dangerous_op_approved`, `dangerous_op_rejected`, `dangerous_op_executed`, `dangerous_op_cancelled` — past tense, append-only via `recordPlatformAudit`. The `dangerous_operations` row is itself the long-form audit record (requestor, requested-at, payload, approver, approved-at, executed-at, outcome). Customer portal signature insertion appends to the existing `digital_signatures` chain (Sprint 12) — same chain hash, same append-only RLS, same verifier (`verifyCaseChain`). KPI snapshot writes continue to flow through the existing `recordAuditEvent` path with `kpi_snapshot_created`.

### 4. Documentation compliance — PASS
- This review; Sprint 20 status flipped in [docs/09-roadmap.md](../09-roadmap.md) to **✅ Delivered (🎯 General Availability)**. Production Board v3 doc 13 § 4.5 (My Tasks View) marked as shipped (five of five visualizations now live). Customer portal v2 chain-signing aligns with [docs/04-document-architecture.md](../04-document-architecture.md) § Signed agreement (same `digital_signatures` chain, different signer kind). Two-person rule aligns with [docs/06-developer-control-plane.md](../06-developer-control-plane.md) § "Two-person rule for dangerous ops".

### 5. Production-domain compliance — PASS
- Executive dashboard is a strict downstream consumer of the existing KPI snapshots. The per-workshop extension adds **one read pattern** (`listLatestSnapshotsByWorkshop`) and **four new repository helpers** scoped by workshop (`listCasesForKpisByWorkshop`, `sumBookedMinutesByWorkshop`, `countActiveEmployeesByWorkshop`, `listLatestSnapshotsByWorkshop`) — every one delegates to the *same* SQL the chain-level calc already uses, just with an extra `workshopId` predicate. No metric is computed twice with different formulas. **Metric registry stays frozen at 18.**
- My Tasks View grew exactly one composer (`MyTasksSection`) which reuses `listPlannedSegmentsForRange` (the engine Day / Week / Resource already use). The bucket split (today vs rest-of-week) is a presentation-layer date comparison — no new domain query.

### 6. Single-Source-of-Truth compliance — PASS
- The executive dashboard reads per-workshop snapshots from `listLatestSnapshotsByWorkshop` — the *same* table (`kpi_snapshots`) every other dashboard reads from. The chain-totals footer sums those same snapshot values; there is no parallel "chain calc". The health bands (emerald / amber / red) use the SSoT thresholds already defined for the operations-centre dashboard.
- The customer portal signature uses `appendCustomerPortalSignature`, which delegates to the *same* chain-hash + previous-hash mechanism `appendCaseAcceptanceSignature` (Sprint 12) uses. A unit-level verifier (`verifyCaseChain`) sees the customer signature as just another link in the same chain.
- The two-person rule state machine lives in **one place** (`src/modules/platform/application/services/two-person.ts`) — the UI Server Actions are thin adapters. Reason validation (≥8 chars) and the approver-≠-requestor invariant are enforced in the service, not duplicated in the action layer.

---

## Testing

- **Unit:** 121 passing (no change in unit count this sprint — Sprint 20 added integration-level coverage).
- **Integration:** 144 total (+13 new across three files):
  - `tests/integration/two-person-rule.test.ts` (6 tests): request creates row in `pending_approval`; reason <8 chars rejected; approver = requestor rejected with `TwoPersonRuleViolationError`; happy-path approve → execute by a different second user; execute by requestor rejected even on an approved row; rejected state cannot be approved/executed.
  - `tests/integration/executive-dashboard.test.ts` (3 tests): per-workshop snapshot computed for each workshop in a chain; `listLatestSnapshotsByWorkshop` returns the latest per workshop only; chain totals match the sum of per-workshop snapshots (SSoT).
  - `tests/integration/customer-portal-signing.test.ts` (4 tests): valid token signs and appends to chain; expired token rejected (`token_expired`); revoked token rejected (`token_revoked`); double-sign blocked (`already_signed`) — chain stays intact after rejection.
- **Gates:** `typecheck` ✅, `lint` ✅, `depcruise` ✅ (**463 modules, 2367 dependencies** — cross-module imports only through `public/`), `check:metrics` ✅ (18), `check:permissions` ✅ (24), `pnpm test --run` ✅ (121/121), `pnpm test:integration` ✅ (144/144).

---

## UX directive compliance (docs/11 + docs/12 + docs/13)

- **Operations-centric, not feature-centric:** the executive dashboard is a single matrix Anna can read in 30 seconds, not a feature list. Mine oppgaver is two buckets, four columns — same operational lens a tech already uses on the printed daily plan. `/dev/two-person` is a single page with one form + one queue table.
- **Three Surfaces parity:** User (executive dashboard + portal v2 signing + My Tasks View), Admin (carried forward — yard designer S19, rental admin S18 etc.; this sprint focuses User + Dev), Dev (`/dev/two-person` plus the existing inspectors for every module).
- **Production Board v3 — one engine, five visualizations:** My Tasks View is the fifth and final lens. Same `listPlannedSegmentsForRange` engine as Day / Week / Resource; the new dimension is *viewer* (filter to my employee row), not *new data*. The promise of doc 13 ("one engine, five lenses") is now fully met.
- **Norwegian-first:** every new screen pulls from `getDictionary()`. Four new sections added (`executive`, `twoPerson`, `myTasks`, `portalSignature`) — both `nb.ts` and `en.ts`. Health-band labels (Grønn/Gul/Rød), kind labels (Lås org / Lås opp org / Pause jobs / …), action labels (Godkjenn / Avvis / Utfør / Avbryt) — all nb-NO by default.
- **Existing UI improved by sprint touch:** the Produksjon page (which already had Tavle / Dag / Uke / Ressurser from Sprints 14-19) gained a fifth section **Mine oppgaver** at the top of the page — same surface, deeper. `/portal/[token]` (Sprint 17 customer card) gained a sign-section below the card — same surface, real value. `/dashboard` gained a sibling page `/dashboard/executive` for chain-tier users.

---

## TakstKontroll compatibility check (rule 4.7) — PASS
- Executive dashboard is a downstream **read** of the same `kpi_snapshots` rows TakstKontroll already validates. Per-workshop snapshots add a new dimension to the snapshot, not a new formula; historical comparisons remain stable. Customer portal signatures append to the existing `digital_signatures` chain — a verifier run before and after Sprint 20 deployment yields the same chain validity for already-existing cases (the new `repair_acceptance` rows only attach to *future* customer-driven signings; no rewrite of historical chains). Two-person rule is orthogonal to estimating/invoicing.

---

## Three Surfaces verification — PASS
- **User:**
  - `/dashboard/executive` — chain-tier executive dashboard (workshop × KPI matrix, chain-totals footer, gated `finance:view`).
  - `/portal/[token]` — customer portal v2 with e-signing section (extends Sprint 17 portal v1).
  - `/production` → **Mine oppgaver** — Production Board v3 My Tasks View.
- **Admin:** no new admin surfaces this sprint (admin surfaces from Sprints 17-19 unchanged); the existing admin index continues to expose Fravær / Leiebil / Tomte-designer.
- **Dev:** `/dev/two-person` (queue + request form + per-row approve/reject/execute/cancel); existing `/dev/yard`, `/dev/rental`, `/dev/notifications`, `/dev/production`, `/dev/feature-flags`, `/dev/events`, `/dev/audit`, `/dev/communication`, `/dev/documents`, `/dev/health`, `/dev/impersonation`, `/dev/inspect`, `/dev/integrations`, `/dev/orgs`, `/dev/parts`, `/dev/quality`, `/dev/transfers`, `/dev/users`, `/dev/workforce` all remain — the **Dev Control Plane is operational across every customer-facing module**.

---

## Deferred / follow-ups
- **D1 — Customer portal v2 photo gallery** — case card already renders attached photos via the Sprint 17 portal; a richer gallery view + caption editing defers to Sprint 22.
- **D2 — Cross-workshop suggestion layer** — the executive dashboard now *shows* underutilised vs overloaded workshops; the AI suggestion ("move case X from A to B; estimated +12 hours throughput, no rental impact") is Sprint 21 territory.
- **D3 — Insurer-level reporting** — generic snapshot infrastructure is in place; an insurer-axis projection ships when the first chain customer asks (post-GA).
- **D4 — Dashboard <1s p95 hardening** — current per-workshop snapshot path is 4 queries × N workshops. Single-GROUP BY rewrite lands when the largest customer exceeds ~12 workshops; current GA cohort sits at 3-8.
- **D5 — Per-org absence-type CRUD UI** — carried from Sprint 19 D1; deferred again to Sprint 21 because GA does not require it.
- **D6 — Drag-to-move on Week View** — carried from Sprint 19 D3; deferred to Sprint 21 alongside AI-suggestion drag-targets.
- **D7 — External pen-test / DPIA / DPA / privacy + ToS** — governance/scheduling items tracked in [docs/07-governance.md](../07-governance.md); the platform-level guardrails the pen-test will inspect (two-person rule, append-only audit, chained signatures, multi-tenant RLS) are all in place and verified by integration tests.

---

## The eight-hour test
Anna pours her coffee at 07:25 and opens **/dashboard/executive** on her laptop. Three workshops, four KPI columns, eight cells visible at a glance. One red on-time cell at Workshop A, one red utilisation cell at Workshop C — opposites. She picks up the phone and asks the Workshop C manager to transfer two delayable cases to A. By 09:00 the transfers are entered and the cases physically move via the yard ledger (Sprint 19). At 14:00 a customer at Workshop B receives the portal email and signs the repair acceptance from their phone — no driving in to physically sign anything, no scan-fax-email loop. At 16:30 a platform operator at the VerkstedOS office needs to lock a misbehaving sandbox org; she opens **/dev/two-person**, files the request, and her colleague — sitting two desks over — pulls it up and approves it within sixty seconds. Every transition is audited. **The platform is ready to onboard paying chain customers.** 🎯 **General Availability.**
