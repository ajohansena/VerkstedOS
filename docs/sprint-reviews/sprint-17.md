# Sprint 17 Implementation Review — Notifications, Customer Portal v1, Estimator Dashboard, Production Board v3 Day View

**Status:** Complete
**Date:** 2026-06-10
**Branch / PR:** committed directly to `main` (incremental commits).
**Demoable outcome:**

1. A coordinator opens **Varsler** from the topbar and sees that a part has been waiting four days on case `2026-0001`. Clicking the row jumps into the case's Parts tab. The same coordinator opens **/admin/notifications** and toggles the `parts_delay` rule off; the next evaluation no longer fires.
2. The dispatcher signs in and is routed by role (`case:edit`) to a brand-new **Estimator dashboard** showing today's arrivals, supplements waiting for insurer approval, and customer answers expected today — every row a one-click link into the case.
3. A workshop owner clicks **Send job-card link** on a case (Sprint 12) and the customer, on their phone, sees a clean **customer portal** with case number, current status, vehicle, workshop, and expected ready date — token-gated, no login.
4. The production manager opens **Production** and toggles between **Tavle** (the Sprint-14 board) and **Dag** (a per-resource timeline of today's planned segments) using the new mode tabs — the first step of Production Board v3 (one engine, five visualizations).

This review follows the six-dimension Implementation Review Gate (CLAUDE.md § 9.1).

---

## Deliverables: planned vs shipped

| Deliverable | Status | Notes |
|---|---|---|
| Notification model (5 tables + 6 enums) | ✅ | `notification_rules`, `notification_rule_overrides`, `notifications`, `notification_subscriptions`, `notification_deliveries` + RLS (`0039` / `0040`) |
| Default rule seed (`parts_delay`, `supplement_pending`, `delivery_at_risk`) | ✅ | `src/lib/seed/notification-rules.ts` — idempotent per org |
| Pure trigger detectors (SSoT) | ✅ | `triggers.ts`; same detectors run from cron + Dev "evaluate now" |
| Engine + cron (`*/15`) | ✅ | `inngest/functions/evaluate-notifications.ts`; registered in `/api/inngest`; evaluation is UPSERT-idempotent |
| User notification inbox `/notifications` | ✅ | list + mark read / mark all read / dismiss; topbar bell + unread badge |
| Admin surface `/admin/notifications` | ✅ | rule list + enable/disable (admin:config) |
| Dev surface `/dev/notifications` | ✅ | rules, recent notifications, delivery log + manual "evaluate now" |
| Customer portal v1 `/portal/[token]` | ✅ | unauth'd route, token-gated, scope-aware reads; reuses the Sprint-12 portal token model |
| Estimator dashboard `/dashboard/estimator` | ✅ | three queues (arrivals today, awaiting insurance, awaiting customer); auto-routed from `/dashboard` when the role can `case:edit` |
| Production Board v3 — mode toggle + Day View | ✅ | `Tavle / Dag / Uke / Ressurser / Mine oppgaver` URL-driven tabs; Day View live; the other three are deliberate placeholders for Sprints 18–21 |
| External channels (email / SMS) | ⏸ Deferred (D1) | provider-gated everywhere; `in_app` is the only channel that fires today (matches Sprint 12 communications discipline) |
| Per-user notification preferences UI | ⏸ Deferred (D2) | catalog + schema in place (`notification_subscriptions`, `notification_rule_overrides`); admin per-org toggle ships now, per-user routing later |
| Forecast-driven `delivery_at_risk` precision | ⏸ Deferred (D3) | Sprint 17 uses the `openedAt + 12d` heuristic that the KPI module already uses (NORMAL_REPAIR_DAYS); the canonical forecast calculation arrives with Sprint 21's AI foundation |

---

## Six-dimension compliance check

### 1. Multi-tenant compliance — PASS
- All five new tables carry `organization_id NOT NULL` with FORCE RLS (migration `0040_notifications_rls.sql`). Reads + writes go through `withTransaction` (RLS) for org context; the Inngest cron runs each org under its own `runWithContext` after enumerating from the admin client. The portal route is the one deliberate exception: it uses `getRawClient({as: 'platform-inspector'})` against the token — never an org-scoped read without a token. Tenant isolation suite untouched and green.

### 2. RBAC compliance — PASS
- `listMyNotifications` / mark-read / dismiss authorize via session ownership (every user manages their own inbox). The two admin endpoints (`listOrgNotificationRules`, `setOrgNotificationRuleEnabled`, `listOrgNotificationDeliveries`) all call `requirePermission(ctx, 'admin:config')`. The Dev `/dev/notifications` page is gated by the `/dev` layout's `requirePlatformAccess`. **No new permissions — catalog stays frozen at 24** (`check:permissions` green). Estimator dashboard auto-routes when the session can `case:edit` and falls back to Production Manager otherwise (permissions HIDE the surface — docs/11 §8 / docs/12).

### 3. Audit compliance — PASS (tiered correctly)
- `notifications` and `notification_deliveries` are projections/event-tier — they carry `created_at` + a status enum and are mutated by the engine; no full-audit needed (matches `kpi_snapshots` from Sprint 16). `notification_rules` mutations (admin enable/disable) emit `recordAuditEvent` + outbox events. The portal touch is intentionally light: a `lastUsedAt` stamp on the token, which is the audit signal for the public surface (matches Sprint 12).

### 4. Documentation compliance — PASS
- This review; sprint-17 status updated in `docs/09-roadmap.md`; six new metric / KPI registry entries unchanged (notifications do not register KPIs — the trigger detectors live in `application/calculations/` but represent business-rule outputs, not numeric measurements). The full localized notification labels live in `src/lib/i18n/messages/{nb,en}.ts`; an extension fact (`Messages` typed leaves are `string`, so nested catalog shapes must be flattened — `notifications.titleParts_delay` not `notifications.titles.parts_delay`) was recorded in repo memory.

### 5. Production-domain compliance — PASS
- No production aggregate touched. The Day View is a pure read of planned `resource_assignments` joined to `work_segments` / `cases` for a date range, and adds a single repo method (`listPlannedSegmentsForRange`). The Board, Week, Resource, and My Tasks tabs share the same underlying data; the user just chooses a visualization (Production Board v3 — one engine, five visualizations, per docs/13).

### 6. Single-Source-of-Truth compliance — PASS
- The three trigger rules each have exactly one detector in `triggers.ts`. The cron, the Dev "evaluate now" tool, and any future "what-if rule preview" must call the same detectors — there is no second implementation anywhere. The Day View reuses the canonical capacity / segment data; no inline arithmetic on hours, money, or percentages introduced in presentation.

---

## Testing

- **Unit:** 100 passing (10 new: `triggers.test.ts` — parts_delay threshold/no-fire-when-progressed/custom param; supplement_pending fires/not-once-settled; delivery_at_risk slip-past-min/below-min/missing-date/custom-param).
- **Integration:** 5 new in `notifications-engine.test.ts` (seed installs the three rules; engine fires `parts_delay` once the requirement has been waiting past the threshold; re-evaluation is UPSERT-idempotent; once the requirement progresses it stops firing; disabling the rule silences it). Full integration suite running green at sprint close.
- **Gates:** `typecheck` ✅, `lint` ✅, `depcruise` ✅ (417 modules, cross-module imports only through `public/`), `check:metrics` ✅ (16), `check:permissions` ✅ (24).

---

## UX directive compliance (docs/11 + docs/12 + docs/13)

- **Operations-centric:** the bell takes the user to a real inbox of actionable items, each clickable into the work — not a generic notifications center disconnected from the case.
- **Role-adaptive routing:** `/dashboard` now branches by permission (`finance:view` → Owner, `case:edit` → Estimator, else Production Manager) — the auto-routing pattern docs/11 mandates.
- **Production Board v3 — one engine, five visualizations:** mode tabs are URL-driven, so a saved view is shareable; Day View groups segments by resource on a 24-hour timeline; Week / Resource / My Tasks are deliberate placeholders so users see the destination map even before the sprint that builds each one.
- **Norwegian-first:** every new screen pulls labels from `getDictionary()`; the bell, the inbox, the estimator queues, the portal, and the Day View tabs all read as `nb-NO` for workshop users.
- **No new dashboard widgets on the home:** Operations Center remains the workshop home — the dashboards are deliberate destinations under Insights.

---

## TakstKontroll compatibility check (rule 4.7) — PASS
- Notifications are a read-side projection of existing data; no estimate / invoice / parts / audit shape is mutated, simplified, or de-traced. The `delivery_at_risk` heuristic uses the same `openedAt + 12d` baseline the KPI module already uses, and is scheduled to switch to the canonical forecast calculation in Sprint 21 — no shortcut introduced that would constrain TakstKontroll's later retrospective comparisons.

---

## Three Surfaces verification — PASS
- **User:** `/notifications` (inbox), topbar bell, `/dashboard/estimator`, `/portal/[token]`, `/production?mode=day`.
- **Admin:** `/admin/notifications` (rule enable/disable per org).
- **Dev:** `/dev/notifications` (rule inventory + recent notifications + delivery log + "evaluate now" repair tool).

---

## Deferred / follow-ups
- **D1 — External channels (email + SMS) for notifications** — `notification_deliveries` rows are persisted with `status='pending'` until a provider is wired; mirrors the Sprint-12 communication discipline.
- **D2 — Per-user notification preferences UI** — table exists (`notification_subscriptions` + `notification_rule_overrides`), per-org admin toggle ships now, per-user routing UI deferred.
- **D3 — Forecast-driven `delivery_at_risk`** — switches to the canonical delivery forecast once Sprint 21 registers it.
- **D4 — Production Board v3 Week / Resource / My Tasks** — placeholders ship now (so the destination is visible); each becomes real in Sprints 18–20 per the roadmap.

---

## The eight-hour test
The estimator opens the platform and immediately sees what arrives today, what insurers haven't answered, and what customers haven't replied to — three queues, no scrolling. The coordinator gets a single bell ping the moment a part has been waiting too long, and one click takes them to the parts tab on the right case. The customer can see, on their phone, that their car is in body work and is expected ready next Tuesday — without an email, without a password. And the production manager can switch between the workflow board and the per-resource day timeline as the shift demands — same engine, two visualizations, more to come.
