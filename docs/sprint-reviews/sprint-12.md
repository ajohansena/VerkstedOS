# Sprint 12 Implementation Review — Quality, Images, Documents, Communication & Acceptance + Dev Control Plane (Milestone: First Friendly Customer)

**Status:** Complete
**Date:** 2026-06-08
**Branch / PR:** committed directly to `main` (incremental commits).
**Demoable outcome:** Confirmed by a domain-level **primary-flow E2E** against real Postgres — a single case runs the whole lifecycle: intake (customer + vehicle + case) → the customer approves the repair start (acceptance gate) → production workflow advances `received → … → ready_for_delivery` → a work segment is planned and completed → a delivery checklist passes QC sign-off → the handover is sealed into the tamper-evident signature chain → the case is `delivered`.

This is the milestone sprint. A friendly Norwegian workshop with 8–20 employees can run their entire repair flow on VerkstedOS.

This review follows the six-dimension Implementation Review Gate (CLAUDE.md § 9.1).

---

## Binding directive (this sprint): primary language + customer acceptance

1. **Norwegian (nb-NO) is the primary application language.** All user-facing labels, navigation, buttons, validation messages and workflows are Norwegian by default; database schema, code, APIs and technical internals remain English. A per-org `settings.locale` may override. Implemented via `src/lib/i18n` (type-safe nb/en catalogs; `getDictionary`/`resolveLocale`/`format`). Every screen added this sprint is Norwegian.
2. **Customer acceptance of every repair start, traceable.** The customer must approve EVERY repair start and staff must SEE it at a glance. Implemented exactly as specified: an SMS (preferred) or email (backup, and always an option for customers without a phone) sends a link to the customer's **job card** (`/jobbkort/<token>`, public, no auth) where they accept/decline; OR the customer replies **OK** to the SMS and we mark it accepted (`sms_reply`). The whole SMS/email conversation is stored in `communication_messages` (both directions) — fully traceable. SMS provider is not wired yet, so outbound messages are stored `queued` (never lost) until the API is provided.

---

## Deliverables: planned vs shipped

| Roadmap deliverable | Status | Notes |
|---|---|---|
| `documents` module (+ `document_links`, `document_access_events`) | ✅ | sensitivity-class buckets; append-only access log (Part 1) |
| Image upload (mobile + desktop) + pipeline | ✅ | signed direct-to-Storage; drag&drop, mobile camera, multiple, progress; on-the-fly thumbnails |
| Photo gallery (before/during/after) | ✅ | full-screen viewer; før/under/etter; metadata-only fallback when storage absent |
| `checklist_templates`/`_items`/`runs`/`responses` | ✅ | per-workshop configurable; status DERIVED at sign-off |
| QC sign-off flow | ✅ | comment/photo required on fail (enforced in service); `quality:signoff` |
| `quality_deviations` | ✅ | severity; internal-rework kept separable (rework KPI) |
| `digital_signatures` with cryptographic chain | ✅ | per-case tamper-evident hash chain; verify detects mutation |
| Communication module (SMS / email) | ✅ | threads + messages; gated adapters (queued without a provider) |
| Customer status update emails/SMS | ✅* | messaging service sends to the customer; status-change templates are a thin follow-up |
| **Customer repair-acceptance** (directive) | ✅ | job-card link + SMS "OK" reply; status visible; traceable thread |
| Dev: impersonation (full audit) | ✅ | `platform_impersonation_sessions`; start/end → `platform_audit_events` |
| Dev: feature flags | ✅ | `feature_flags` (global + per-org); `/dev/feature-flags`; audited |
| Dev: rebuild-projection / repair tools | ✅ | shipped earlier (parts status rebuild, segment recompute); doc/quality/comms inspection added |
| Dev: virus-scan failure log | ⏸ Deferred (D1) | no AV provider yet; `documents.is_processed` already models the backlog (`/dev/documents`) |
| E2E coverage on the primary flow | ✅ | domain-level E2E (real Postgres) — see D2 on browser E2E |
| Case intake UX (reg/phone search) | ✅ | added per your Sprint-12 directive; reused existing services |
| **First Friendly Customer** milestone | ✅ (gate ready) | end-to-end proven; go-live is your decision |

---

## Six-dimension compliance check

### 1. Multi-tenant compliance — PASS
- New customer-facing tables (communication ×3, digital_signatures, quality ×5, documents ×3) are `organization_id`-scoped with FORCE RLS. The two append-only ledgers (`document_access_events`, `digital_signatures`) are INSERT+SELECT only. Platform tables (`feature_flags`, `platform_impersonation_sessions`) use FORCE RLS with no policy (service-role only), mirroring `platform_*`. The public job-card path resolves the org from the opaque token via the integration connection, then writes under that org. Tenant isolation 8/8 still green.

### 2. RBAC compliance — PASS
- Communication + acceptance reuse `case:view`/`case:edit`; QC reuses `quality:view`/`edit`/`signoff`; signatures reuse `case:view`/`edit`; templates/suppliers use `admin:config`. **No new customer permissions — catalog stays at 24.** Dev impersonation + flags are platform-track only (hardened `/dev` guard).

### 3. Audit compliance — PASS (tiered correctly)
- Acceptances, signatures, deviations, checklist runs/sign-offs, document registration are full-audited (`recordAuditEvent`). Messages + access events + signature chain are event-tier/append-only. Outbox events added: `communication.acceptance.requested/accepted/declined`, `communication.message.sent`, `quality.checklist.started/signed_off`, `quality.deviation.raised`, `quality.signature.appended`, `documents.document.registered`. Dev impersonation + flag changes go to `platform_audit_events` (`impersonated_started/ended`, `feature_flag_changed`).

### 4. Documentation compliance — PASS
- Roadmap Sprint 12 marked complete; localization policy recorded as binding; this review; 2 new metrics registered (`qc_failure_rate`, `rework_rate`).

### 5. Production-domain compliance — PASS
- No production aggregate simplified. The acceptance gate is a customer decision (the kind of genuine business decision the guardrail reserves for humans), distinct from the derived status projection. QC sign-off and signatures attach to the case/segment without changing the workflow-as-data model.

### 6. Dashboard / mobile compliance — PASS
- Photo uploader is mobile-first (camera capture, large touch targets, progress). The public job card is a minimal mobile page. No inline business arithmetic in presentation — QC + signature logic lives in services/SSoT calcs.

---

## TakstKontroll compatibility check (rule 4.7) — PASS
- Customer acceptance is captured immutably (status + method + response text + audit) — the approval trail TakstKontroll-style comparisons rely on. Quality rework stays **separable** via the `internal_rework` funding link on deviations. The signature chain is append-only and tamper-evident. Documents keep case-level linkage via `document_links`. Nothing in the parts/estimate/funding traceability was weakened.

## Single Source of Truth verification — PASS
- New SSoT calcs: `calculateQcFailureRate`, `calculateReworkRate`, and the signature-chain `hashPayload`/`computeChainHash`/`verifyChain`. The Dev quality summary and the in-app verify both call the same functions. No duplicated metric logic.

## Three Surfaces verification — PASS
- **User:** photo upload + gallery, QC panel + run page, acceptance card + thread, signatures, reg/phone intake — all Norwegian.
- **Admin:** `/admin/checklists` (QC templates + seed), `/admin/suppliers`.
- **Dev:** `/dev/documents`, `/dev/quality`, `/dev/communication`, `/dev/feature-flags`, `/dev/impersonation`.

---

## Deviations / mechanics

- **D1 — Virus-scan failure log deferred.** No AV provider is wired. `documents.is_processed` already models the unprocessed/scan backlog and is visible in `/dev/documents`; the AV adapter + failure log lands when a scanner is provisioned (same gating pattern as SMS).
- **D2 — E2E is domain-level, not browser.** Playwright is not installed and a browser E2E needs Supabase-auth fixtures + browser binaries that can't gate deterministically in this CI. The shipped `primary-flow.e2e.test.ts` drives the entire lifecycle through the real service layer against real Postgres — the system behaviour that matters, run deterministically. A browser smoke layer can be added later without rework.
- **M1 — SMS/email providers gated.** Until the SMS API is provided, outbound messages are stored `queued` (never lost) and the UI says so in Norwegian. Wiring the provider is a single adapter change.
- **M2 — Migrations.** 0025/0026 (communication), 0027/0028 (digital signatures, append-only), 0029/0030 (platform flags + impersonation). Drizzle-generated files renamed to sequential tags + journal synced.
- **M3 — Customer status-update templates (M-deferred).** The messaging rail to text/email the customer on status changes exists; a small templated trigger per status is a follow-up, not a blocker.

---

## CI gates (all green locally)

`typecheck` · `lint` · `format:check` · `depcruise` (no violations, 313 modules) · `check:permissions` (24) · `check:metrics` (8) · `test` (unit **56/56**) · `test:integration` (**94/94**, incl. the primary-flow E2E, communication-acceptance, digital-signatures — real Postgres) · `build`.

## Drift items → resolution
None blocking. D1/M1/M3 are provider-gated follow-ups (AV, SMS); D2 is a deliberate, documented test-strategy choice with the lifecycle fully covered.

## Sign-off
- [ ] Project owner confirms Sprint 12 closed and the First-Friendly-Customer go-live decision.
