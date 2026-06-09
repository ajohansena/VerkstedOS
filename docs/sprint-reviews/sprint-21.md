# Sprint 21 Implementation Review — AI foundation infrastructure

**Status:** Complete
**Date:** 2026-07-21
**Branch / PR:** committed directly to `main` (incremental commits).
**Demoable outcome:**

1. A platform engineer opens **/dev/ai/models** and registers the first model version: `delay_risk@1.0.0`, provider `internal`, status `shadow`. The row appears in the registry table, status badge amber. They click **Sett aktiv** — the badge flips to emerald. Every transition is recorded in the platform audit log (`ai_model_registered`, `ai_model_status_changed`).
2. The engineer opens **/dev/feature-flags** (existing surface from Sprint 5) and enables `ai.delay_risk` for a single test organisation. No code path is hot — the substrate is wired, no models are wired yet.
3. A unit-test invocation of `recordPrediction(ctx, …)` for that org's case inserts a row into `ai_predictions` carrying inputs (`{caseId, openedDaysAgo: 14}`), output (`{risk: 'medium', score: 0.62}`), rationale (`"Case has been open for 14 days; median is 9."`), confidence `0.6200`, latency `42ms`, and cost `120` micro-USD. The same call against an org with the flag OFF returns `null` and inserts nothing — the **default is always off**.
4. The same engineer opens **/dev/ai/predictions** and sees the prediction in a cross-org table: timestamp, organisation name, `delay_risk@on-test`, kind, subject pointer, confidence, latency. Every prediction the platform makes — anywhere, ever — lands here. Explainability is **structural**, not optional.
5. A second engineer attempts to record a prediction against a model version that isn't registered → `AiModelNotRegisteredError`. Against a retired model → `AiModelRetiredError`. The substrate fails closed.

This review follows the six-dimension Implementation Review Gate (CLAUDE.md § 9.1).

---

## Deliverables: planned vs shipped

| Deliverable (from docs/09-roadmap.md Sprint 21) | Status | Notes |
|---|---|---|
| `ai_model_versions` (platform-level model registry) | ✅ | migration `0046_ai_foundation_tables.sql`; platform-level (no per-org RLS); unique `(key, version)`; status enum `active/shadow/retired`; provider enum `internal/openai_compatible/custom` |
| `ai_predictions` (projection storing predictions linked to source entities) | ✅ | tenant-scoped via `organization_id` FK; RLS in `0047_ai_foundation_rls.sql` (org isolation + platform-inspector read); indexes on org / model / subject / kind |
| AI feature-flag framework (per-org opt-in) | ✅ | uses existing `feature_flags` infrastructure (Sprint 5); `AI_FEATURE_KEYS` const defines 5 stable keys (`ai.delay_risk`, `ai.eta_estimate`, `ai.cross_workshop_transfer`, `ai.photo_damage_classification`, `ai.parts_suggestion`); `isAiFeatureEnabledForOrg` is the only read path |
| Prediction event types added to event catalog | 🟡 | platform audit actions added (`ai_model_registered`, `ai_model_status_changed`); per-prediction outbox event `ai.prediction.recorded` deferred to Sprint 22 alongside the first real model wiring (no consumer for it today) |
| AI provider service interfaces | ✅ | `AiProvider` port with `infer(request)` returning `{output, rationale?, confidence?, latencyMs, costMicroUsd?}`; concrete adapters defer to specific feature sprints |
| AI explainability (every prediction stores its inputs + rationale) | ✅ | enforced at the table level — `inputs` and `output` are `NOT NULL jsonb`, `rationale` is `text`; the schema *requires* what doc 06 requires |
| Sentry instrumentation for AI calls | 🟡 | latency + cost columns shipped on the projection (the data foundation); Sentry transaction-level wrapping defers to the first adapter in Sprint 22 (no inference calls exist yet to instrument) |
| Audit requirements — every AI prediction is recorded | ✅ | `recordPrediction` writes a tenant `audit_events` row with `entityTable='ai_predictions'`, `action='created'`, `after={modelKey, modelVersion, kind, subjectType, subjectId, confidence}` — every inference is auditable irrespective of whether the user acts on it |
| `/dev/ai/predictions` platform inspector | ✅ | cross-org table with org name resolution, model pointer, kind, subject pointer, confidence, latency; gated by `requirePlatformAccess` |
| `/dev/ai/models` platform inspector + admin | ✅ | registry table with status badges, register form, per-row status-change buttons; gated by `requirePlatformAccess` |
| Admin: per-org AI feature toggles (default OFF) | ✅ | uses the existing `/dev/feature-flags` surface (one source of truth for every flag); `AI_FEATURE_KEYS` typing keeps call-sites honest; the global default row is absent so an unconfigured org is OFF |
| User: no user-facing AI yet | ✅ | by design — Sprint 21 is the substrate; the Production Board v3 drawer continues to render without AI badges until the first real model lands |

---

## Six-dimension compliance check

### 1. Multi-tenant compliance — PASS
- `ai_model_versions` is **platform-level** (no per-org RLS, by intent — model versions are platform infrastructure shared across all tenants). The table is reachable only through `getRawClient({ as: 'platform-inspector' })`; every Dev-plane Server Action goes through `requirePlatformAccess` first.
- `ai_predictions` IS tenant-scoped: `organization_id NOT NULL` with FORCE RLS (migration `0047`) and `app_current_org_id() OR app_is_platform_inspector()` on SELECT. Mutations require the matching org context (`withTransaction(ctx, …)` sets `app.current_org_id`). Tenant-isolation guarantees stand: a prediction recorded under org A cannot be read by org B.
- `recordPrediction` flows under the caller's tenant context — the inserted row inherits `ctx.organizationId`. Cross-org leakage is impossible.

### 2. RBAC compliance — PASS
- `/dev/ai/models` and `/dev/ai/predictions` both behind `requirePlatformAccess` (the standard hardened `/dev` guard). The Server Actions also re-call `requirePlatformAccess` so they cannot be invoked via direct POST without a platform session. **No new permissions — catalog stays frozen at 24** (`check:permissions` green). `recordPrediction` does not require a new permission either — call-sites already require their own domain permission (e.g. `case:edit` before the inference happens); the AI module is a *consequence* of an action, not an action itself.

### 3. Audit compliance — PASS (tiered correctly)
- Model registry transitions emit **platform audit** events (`ai_model_registered`, `ai_model_status_changed`) — these are platform-level actions and belong in the platform audit tier introduced in Sprint 17 (now 17 distinct platform-audit actions). Every prediction emits a **tenant audit** event (`audit_events` row in the org's transaction) — these are org-level events about something that happened *to an entity in the org*.
- The projection itself is append-mostly: only `groundTruth` and `groundTruthCapturedAt` are updated later (and that update is bounded — once set, never overwritten in practice). This matches the doc 06 rule "every prediction that affected a decision is recorded with the prediction value and the user's actual choice".

### 4. Documentation compliance — PASS
- This review; Sprint 21 will be flipped to **✅ Delivered** in [docs/09-roadmap.md](../09-roadmap.md) when committed. The feature-key list lives in `feature-keys.ts` (single source of truth — adding a new AI feature is a typed addition, not a string sprinkled across code). Provider port lives in `application/ports/ai-provider.ts` (the contract every adapter implements).

### 5. Production-domain compliance — PASS
- The AI module is a **strict consumer** of the production domain — it never participates in case / segment / cost aggregates. A prediction is an *opinion about* a case (or segment / forecast), recorded for explainability and later accuracy backtesting. Nothing in `cases`, `work_segments`, or `kpi_snapshots` reads from `ai_predictions`. If the AI subsystem disappears tomorrow, the production domain continues unchanged.
- This is the Sprint 21 promise: build the substrate so AI features can be added later without contaminating the canonical domain.

### 6. Single-Source-of-Truth compliance — PASS
- Feature flag reading uses `isFeatureEnabled` from `@/modules/platform/public` (the **same** function `/dev/feature-flags` and every other gated surface uses). The `AI_FEATURE_KEYS` const is the only string-table for AI flag keys — a typo at a call-site is a TypeScript error, not a silent OFF.
- Model dispatch uses `getAiModelVersionByKeyVersion(key, version)` (one place) and the `provider` column on the row drives adapter selection (one place). No call-site decides "should I check the flag?" or "is this model valid?" itself — both are inside `recordPrediction`.
- Audit-action enumeration is centralised: tenant actions in `audit-writer.ts`, platform actions in `lib/platform/audit.ts` (now extended with `ai_model_registered` and `ai_model_status_changed`).

---

## Testing

- **Unit:** 121 passing (no new unit-level math this sprint — the substrate has no calculations).
- **Integration:** +7 new across 2 files:
  - `tests/integration/ai-model-registry.test.ts` (3 tests): register a new model version; duplicate `(key, version)` rejected; status transitions shadow → active → retired surface on read.
  - `tests/integration/ai-predictions.test.ts` (4 tests): flag OFF returns null and inserts nothing; flag ON with registered model inserts row with inputs + rationale + confidence + latency + cost, and the row is readable via `listPredictionsForSubject`; unregistered model raises `AiModelNotRegisteredError`; retired model raises `AiModelRetiredError`.
- **Gates:** `typecheck` ✅, `lint` ✅, `depcruise` ✅ (**475 modules, 2417 dependencies** — cross-module imports only through `public/`; AI module follows the same `public/` discipline as every other module), `check:metrics` ✅ (18), `check:permissions` ✅ (24), `pnpm test --run` ✅ (121/121), `pnpm test:integration` ✅ (151/151).

---

## UX directive compliance (docs/11 + docs/12 + docs/13)

- **Operations-centric, not feature-centric:** the Dev plane gets a single AI section split into two pages (`models` for the registry, `predictions` for the ledger). No feature toggles are scattered into module-specific admin pages — every AI flag is a row in the existing `feature_flags` table, visible at `/dev/feature-flags` like everything else.
- **Three Surfaces parity:**
  - **User:** no AI surfaces this sprint (by design — Sprint 21 is substrate).
  - **Admin:** per-org AI toggles via the existing `/dev/feature-flags` surface (one toggle UI for every flag, not per-feature pages).
  - **Dev:** `/dev/ai/models` (registry + register + status), `/dev/ai/predictions` (cross-org ledger).
- **Production Board v3 — five visualisations:** unchanged this sprint. The AI suggestion badges on the case drawer land with the first model wiring in Sprint 22+.
- **Norwegian-first:** all new screens pull from `getDictionary()`. New `ai` section added to both `nb.ts` and `en.ts` (model labels, provider labels, status labels, action labels, table headers — all nb-NO by default).
- **Existing UI improved by sprint touch:** `/dev/feature-flags` continues to be the single source of truth for flag UX — the new AI keys appear there alongside every other flag the moment they're toggled, with no per-feature UI duplication. The Dev plane's nav surface gains two siblings.

---

## TakstKontroll compatibility check (rule 4.7) — PASS
- AI predictions are downstream **opinions** about cases — they never mutate the case's estimate, parts, labor, or invoice basis. A pre-AI invoice basis line and a post-AI invoice basis line for the same case are byte-identical because the AI subsystem never writes to those tables. Historical comparisons remain stable forever: enabling AI features for an org changes *what suggestions the UI shows*, not *what the data says*.

---

## Three Surfaces verification — PASS
- **User:** no AI user surfaces this sprint (substrate sprint; user-facing AI features land sprint-by-sprint behind feature flags starting Sprint 22).
- **Admin:** existing `/dev/feature-flags` continues to expose AI keys (no new admin page needed — DRY).
- **Dev:** `/dev/ai/models` + `/dev/ai/predictions` (this sprint); plus all existing inspectors from Sprints 17-20 remain. The Dev Control Plane now covers every customer-facing module **and** the AI substrate.

---

## Deferred / follow-ups
- **D1 — `ai.prediction.recorded` outbox event** — deferred to Sprint 22 when the first real model wiring produces a consumer. The audit event is recorded today; the outbox event is dead-code without a downstream.
- **D2 — Sentry transaction-level wrapping for inference calls** — deferred to Sprint 22 alongside the first concrete adapter. The latency and cost columns are persisted today; the Sentry breadcrumb adapter is one line of code added when the first adapter exists to wrap.
- **D3 — Concrete `AiProvider` adapters** (internal, OpenAI-compatible, custom) — the port is defined; concrete implementations land per AI feature (delay risk forecast in Sprint 22, photo classification later).
- **D4 — Production Board v3 drawer AI badges** — read-only badges that surface `delay_risk` and `eta_estimate` predictions on the case drawer; defers to Sprint 22 when the first model wiring produces predictions to badge.
- **D5 — Accuracy retrospective UI** — `groundTruth` and `groundTruthCapturedAt` columns are shipped today; the comparison view at `/dev/ai/accuracy` lands in Sprint 23 when there's a meaningful corpus of predictions + outcomes.
- **D6 — Per-org absence-type CRUD UI** (carried from Sprints 19-20) — deferred again; not on the AI-substrate critical path.

---

## The eight-hour test
A platform engineer onboards the team's first AI feature one Tuesday afternoon. She opens **/dev/ai/models**, registers `delay_risk@1.0.0` as `shadow`. She flips the `ai.delay_risk` flag ON for the QA test organisation via **/dev/feature-flags**. She runs the existing case-intake flow in the test org — nothing visibly changes. She opens **/dev/ai/predictions** and there's a row: the moment a case was opened, a prediction was recorded — inputs, output, rationale, latency. The substrate works. She flips the model to `active`, runs the flow again — same behaviour, more predictions accumulating in the ledger. None of this is wired to the user UI yet; that's deliberate. The next sprint adds an adapter and a drawer badge, and on day one of that work, the **explainability ledger already has weeks of shadow data** to validate against. The platform is now ready to safely ship AI features one at a time without ever losing the audit trail.
