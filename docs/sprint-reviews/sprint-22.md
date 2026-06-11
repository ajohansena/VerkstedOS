# Sprint 22 (D3) Implementation Review — Office tasks + task templates (planner-as-heart)

**Status:** Complete
**Date:** 2026-08-15
**Branch / PR:** committed directly to `main` (incremental commits — Phase B, Phase E, Phase F).
**Demoable outcome:**

1. A receptionist opens a case at `/cases/{id}` and sees a new **Kontoroppgaver** card under bookings. They type "Bestill deler til front", pick **Bestill deler** + **Høy** prioritet, set a due date 3 days from now, and submit. The card row appears with overdue countdown styling planned for after due.
2. The same receptionist clicks **Fullfør** on the row → status flips to `completed`, the row dims, and the planner's My Tasks view loses the row from "Today".
3. The production manager opens `/production` in Day View and sees a new **Kontor** lane at the top — amber background, distinct from resource lanes — showing today's open office tasks across the whole workshop. Week View shows an office row at the top with per-day count badges.
4. The admin opens `/admin/task-templates` (fresh org, empty list) and clicks **Opprett standardmaler**. Five rows appear: Bestill deler, Ring kunde dagen før, Klargjør faktura, Bestill leiebil, Følg opp etter levering — each with its trigger event type and due-offset displayed. They click **Deaktiver** on one row → badge flips to "Nei".
5. A platform engineer opens `/dev/task-templates`, picks an org, sees the same templates cross-org, clicks **Force-disable** on a runaway template → audited via `recordPlatformAudit({action:'data_repaired', targetEntityType:'task_templates', reason})`.
6. The Inngest cron `generate-office-tasks-from-events` runs every 5 minutes, scans the last 30 minutes of published outbox events per org, and idempotently creates office tasks via `createOfficeTaskSystem`. Replaying the same event window is a no-op — the partial unique index `office_tasks_template_event_unique` absorbs duplicates at the DB boundary.

This review follows the six-dimension Implementation Review Gate (CLAUDE.md § 9.1).

---

## Deliverables: planned vs shipped

| Deliverable | Status | Notes |
|---|---|---|
| `office_tasks` entity + RLS | ✅ | migrations `0051_office_tasks_tables.sql` + `0052_office_tasks_rls.sql`; 5 indexes; CHECK `office_tasks_single_assignee_chk` enforces exactly-one assignee (resource OR user, never both) |
| Office-task lifecycle service | ✅ | create / assign / start / complete / cancel (with required reason) — each writes audit + outbox in the same transaction; idempotent on already-terminal states |
| `task_templates` entity + RLS | ✅ | migrations `0053_task_templates_tables.sql` + `0054_task_templates_rls.sql`; partial unique index `office_tasks_template_event_unique` on `(generated_from_template_id, generated_from_event_id)` for replay idempotency |
| Event-driven generator (Inngest cron) | ✅ | `inngest/functions/generate-office-tasks-from-events.ts`, every 5 min; per-org loop with `runWithContext`; 30-min lookback window |
| Default Norwegian templates (5) | ✅ | `src/lib/seed/default-task-templates.ts` — Bestill deler, Ring kunde dagen før, Klargjør faktura, Bestill leiebil, Følg opp etter levering. Seeded via `/admin/task-templates` → "Opprett standardmaler" |
| Day View "Kontor" lane | ✅ | top of resource grid, amber, fmtTime + title + kind/priority + case link |
| Week View office row | ✅ | top of tbody, count badges per day |
| My Tasks (office) — today / later split | ✅ | direct user assignment OR via owned resources; overdue red highlighting |
| Case detail integration | ✅ | `CaseOfficeTasksSection` with inline create form + per-row complete + cancel-with-reason |
| Admin `/admin/office-tasks` | ✅ | org-wide open-tasks table with overdue highlighting, gated by `admin:config` |
| Admin `/admin/task-templates` | ✅ | seed-defaults button, inline create form (with shallow JSON filter editor), per-row enable/disable |
| Dev `/dev/office-tasks` | ✅ | cross-org inspector + force-cancel for stuck tasks, audited |
| Dev `/dev/task-templates` | ✅ | cross-org inspector + force-disable for runaway templates, audited |
| Intake cleanup — remove `?legacy=1` | ✅ | `IntakeSearch` component deleted, `quickIntakeAction` removed, `legacyHref` / `legacyLink` removed from `IntakeWizard`; `cases/new/page.tsx` is now wizard-only |
| Docs — doc 13 §§ 10 + 16.1 marked IMPLEMENTED | ✅ | added D3 resolution callouts pointing at this sprint and ADR 0010 |
| ADR 0010 | ✅ | `docs/adrs/0010-office-tasks-and-task-templates.md` |

---

## Six-dimension compliance check

### 1. Multi-tenant compliance — PASS
- `office_tasks` and `task_templates` both have `organization_id NOT NULL` with FORCE RLS — `app_current_org_id() OR app_is_platform_inspector()` on SELECT, `app_current_org_id()` only on mutate. Tenant-isolation tests cover both directions (`tests/integration/office-tasks.test.ts` proves org B cannot see org A's tasks).
- Service writes use `withTransaction(ctx, ...)` which sets `app.current_org_id` for the duration of the tx — every insert / update inherits the caller's org.
- The generator (Inngest cron) loops per-org via `runWithContext(ctx, ...)` — never opens a cross-org transaction. The partial unique index on `(generated_from_template_id, generated_from_event_id)` is per-row, not cross-org (templates carry their own org).

### 2. RBAC compliance — PASS
- **Permission catalog unchanged — 24 permissions** (`check:permissions` green). D3 reuses existing gates:
  - `case:edit` — create case-linked office tasks, complete, cancel
  - `admin:config` — create non-case office tasks, manage templates
  - `production:plan` — assign a resource to an office task
- The generator bypass (`createOfficeTaskSystem`) is the **only** new bypass and is an explicit named entry point — not a flag on the gated function. Code review can grep for its callers (currently only `task-templates.ts evaluateAndGenerate`). The bypass is justified because the source outbox event was authorized at its own origin (a booking was confirmed by a user with `case:edit`; the downstream task it implies should not require re-authorization).

### 3. Audit compliance — PASS (tiered correctly)
- Every office-task mutation (create / assign / start / complete / cancel) writes a tenant `audit_events` row in the same transaction as the mutation (via `recordAuditEvent(tx, ctx, ...)`), with `entityTable='office_tasks'`. Cancel carries the user-supplied reason as the audit `reason` (and is also persisted on the row for queries that don't want to JOIN audits).
- Template create + activate/deactivate write tenant audits with `entityTable='task_templates'`.
- Dev-plane force-cancel + force-disable write **platform** audits (`recordPlatformAudit`, `action='data_repaired'`) — the platform tier introduced in Sprint 17.
- The generator records audits under the **system user** (`00000000-…`) — the audit trail clearly labels system-generated tasks distinctly from user-created ones.

### 4. Documentation compliance — PASS
- This review.
- Doc 13 §§ 10 + 16.1 now carry D3 IMPLEMENTED callouts.
- ADR 0010 ships in `docs/adrs/`.
- The i18n surface added 40+ keys to both `nb.ts` and `en.ts` (officeTask + taskTemplate sections plus `admin.officeTasks` / `admin.taskTemplates` nav labels).

### 5. Production-domain compliance — PASS
- The capacity engine continues to ignore office tasks — verified in `tests/integration/office-tasks.test.ts` (the "capacity engine ignores office tasks" assertion confirms an office task with `assigneeResourceId` set does not reduce the resource's plannable minutes).
- Case cost aggregation is unchanged — office tasks are never summed into the case's billable basis (CLAUDE.md § 4.7 — TakstKontroll-safe). The header comment of `calculateOpenOfficeTaskSummary` explicitly documents this invariant.
- Production state transitions are unchanged — office tasks are a parallel concern, not a state machine input.

### 6. Single-Source-of-Truth compliance — PASS
- One calculation for the office-task summary (`calculateOpenOfficeTaskSummary`) — read by case detail, My Tasks, planner lanes, admin table.
- One repository per read direction (case / org / workshop / user / resource) — the planner page imports the same `listOpenOfficeTasksForOrg` the admin page uses.
- One metric registry entry (`open_office_tasks_for_case`) — 20 total (was 19).
- One event evaluator (`evaluateAndGenerate`) — called by exactly one Inngest function. The shallow-equality filter and `{key}` interpolator both live in the service module and are exercised by the integration test.

---

## Testing

- **Unit:** 139 passing (+6 vs Sprint 21 — the new `office-tasks.test.ts` calc tests).
- **Integration:** +12 new across 3 files:
  - `tests/integration/office-tasks.test.ts` (5 tests): lifecycle (create → assign → start → complete), cancel-with-required-reason + cannot-complete-after-cancel, listOpenOfficeTasksForOrg + cross-org isolation, listMyOpenOfficeTasks by user, capacity-engine-ignores.
  - `tests/integration/planner-office-tasks.test.ts` (3 tests): the three reads the planner consumes — listOpenOfficeTasksForOrg (Day/Week lane source), listMyOpenOfficeTasks (My Tasks source), listOfficeTasksForCase (timeline source).
  - `tests/integration/task-templates.test.ts` (4 tests): template creation + listActiveTaskTemplatesForEvent narrowing, evaluateAndGenerate creates an office task with provenance + correct due time, replay idempotency (unique index absorbs duplicates — second call reports 0 created + 1 skipped), filter narrowing (event without the flag → no task; event with flag → 1 task).
- **Gates:** `typecheck` ✅, `lint` ✅, `depcruise` ✅, `check:metrics` ✅ (20), `check:permissions` ✅ (24), `pnpm test --run` ✅ (139/139), `pnpm test:integration` ✅.

---

## UX directive compliance (docs/11 + docs/12 + docs/13)

- **Planner-as-heart fulfilled:** the production board now shows **all** work — production segments (existing) AND office work (new Kontor lane on Day View + office row on Week View). A manager scanning the board sees the whole workshop, not just the half that touches a vehicle.
- **Three Surfaces parity:**
  - **User:** Case detail card (inline create + per-row complete + cancel); My Tasks (today / later split with overdue red); Day View Kontor lane; Week View office row.
  - **Admin:** `/admin/office-tasks` (org-wide table) + `/admin/task-templates` (seed-defaults, inline create with shallow JSON filter, per-row enable/disable).
  - **Dev:** `/dev/office-tasks` (force-cancel with platform-audit) + `/dev/task-templates` (force-disable with platform-audit).
- **Norwegian-first:** all new screens pull from `getDictionary()`. New `officeTask` + `taskTemplate` sections in both `nb.ts` and `en.ts`; default seed template names + titles are nb-NO.
- **Existing UI improved by sprint touch:** intake cleanup — `?legacy=1` flag and the entire `IntakeSearch` split layout removed (deferred from D2). `/cases/new` is now wizard-only.
- **No new entities, no new permissions hidden behind the work:** the new tables are the only schema additions; the permission catalog stays frozen at 24.

---

## TakstKontroll compatibility check (rule 4.7) — PASS
- Office tasks are explicitly excluded from case cost aggregation — the `calculateOpenOfficeTaskSummary` header comment states the invariant and the integration test "capacity engine ignores office tasks" enforces a related invariant (no minute-booking either). A future TakstKontroll integration that reads case cost will see byte-identical numbers before and after D3 — office tasks are operational concerns, not financial ones.

---

## Three Surfaces verification — PASS
- **User:** ✅ Case-detail card + My Tasks + Day/Week lanes.
- **Admin:** ✅ Two admin pages with full CRUD + seed-defaults.
- **Dev:** ✅ Two Dev inspectors with audited repair tools.

---

## Deferred / follow-ups

- **Manual reprioritization of office tasks** — § 16.2 (manual priority override) was *not* tackled in D3; only office tasks ship. Templates default to a fixed priority per template; users can change priority on the row only via a future edit form.
- **30-minute lookback window** is a soft contract — pausing the Inngest cron longer than 30 min requires manual replay (no UI yet; the `evaluateAndGenerate` service is callable directly from a future dev tool).
- **`production.state.transitioned` event payload shape** — the two default templates that filter on `toStateCode='delivered'` assume the production-state outbox event carries `toStateCode` in the payload. The first end-to-end production flow that consumes these templates will validate this. If the payload shape differs, the templates are easily edited (or the filter widened).
