# ADR 0010 — Office tasks + task templates (planner-as-heart)

- **Status:** Accepted
- **Date:** 2025-01-12
- **Sprint:** D3
- **Supersedes:** —
- **Superseded by:** —
- **Related:** docs/13-production-planning.md §§ 10, 16.1; CLAUDE.md §§ 4.4, 4.7

## Context

Doc 13 (Production Planning) flagged a real gap: the planner needs to surface
**office work** (order parts, call customer the day before, prepare invoice,
book rental, follow up after delivery) alongside production segments — but
nothing in doc 10 (Production Domain) modelled standalone, case-linked,
plannable office work.

Three options were considered (doc 13 § 16.1):

1. **New `OfficeTask` entity** — clean separation; minor new surface area.
2. **Extend `WorkSegment`** with non-production segment kinds — reuses the
   engine but overloads the segment concept and risks polluting production
   metrics (hours, throughput).
3. **Surface notifications as the office task list** — no new entity, but
   notifications are not schedulable / assignable / Day-Week-board-displayable
   the way office tasks must be.

The TakstKontroll constraint (CLAUDE.md § 4.7 — never double-count or pollute
case cost numbers a future TakstKontroll integration trusts) makes Option 2
error-prone: any office "work segment" that escaped exclusion in the case-cost
aggregation would corrupt the cost number.

## Decision

**Adopt Option 1.** Ship two new entities:

- **`office_tasks`** — id, organization_id, workshop_id?, case_id?, title,
  kind (enum: order_parts / customer_call / insurer_followup / rental_booking
  / invoice_prep / customer_followup / documentation / other), priority, status
  (open → in_progress → completed / cancelled), due_at, assignee_resource_id?,
  assignee_user_id? (CHECK: exactly one), provenance columns for the generator,
  lifecycle columns. Migrations `0051_office_tasks_tables.sql` +
  `0052_office_tasks_rls.sql`.
- **`task_templates`** — id, organization_id, workshop_id?, name,
  trigger_event_type, trigger_event_filter (jsonb, shallow equality),
  task_kind, task_title_template (with `{caseNumber}` / `{customerName}`
  interpolation), due_offset_minutes, due_reference (event_time /
  case_expected_arrival_at / case_promised_delivery_at), default_assignee_*,
  default_priority, is_active. Migrations `0053_task_templates_tables.sql` +
  `0054_task_templates_rls.sql`.

A partial unique index `office_tasks_template_event_unique` on
`(generated_from_template_id, generated_from_event_id)` enforces per-event
idempotency at the database boundary, so the generator can re-process an
outbox window safely.

Generation is event-driven: the Inngest cron
`generate-office-tasks-from-events` runs every 5 minutes, lists every org,
scans the last 30 minutes of published outbox events under each org's tenant
context, and calls `evaluateAndGenerate(ctx, event)` which fans out to every
active matching template.

## Consequences

**Positive:**

- Office work is now a first-class plannable + auditable thing, surfaced in
  three places (My Tasks, Day-View Kontor lane, Week-View office row).
- The capacity engine remains pure (office tasks never book minutes).
- Case cost remains pure (office tasks never aggregated — TakstKontroll-safe).
- Templates are the "open brain" — admins add their own without code changes.
- The generator is idempotent at the DB boundary; re-running an outbox window
  is a no-op for already-generated tasks.

**Negative / trade-offs:**

- Two new tables + two new enums (`office_task_*`, `task_template_due_reference`).
- Generator runs the system user (`00000000-…`) and bypasses the user-level
  permission gate — justified because the source event is already authorized,
  but documented as the explicit `createOfficeTaskSystem` entry point so the
  bypass is auditable in code review.
- 30-minute lookback window is a soft contract: pausing the Inngest cron for
  longer than 30 min would require manual replay (future dev tool).

**Neutral:**

- Five default Norwegian templates ship in `src/lib/seed/default-task-templates.ts`
  and are seeded via `/admin/task-templates` → "Opprett standardmaler". Orgs
  start empty and opt in.
- The capacity engine, production metrics, and case cost calculations remain
  unchanged.

## Alternatives rejected

- **WorkSegment extension** — rejected per TakstKontroll risk (above) and the
  No Cleverness principle (don't overload a domain concept).
- **Notification-only** — rejected; notifications carry no assignment / due-
  date / state machine and cannot appear as scheduled blocks.

## Verification

- Unit tests: `src/modules/workforce/application/calculations/office-tasks.test.ts` (6 tests).
- Integration tests:
  - `tests/integration/office-tasks.test.ts` (5 tests — lifecycle, cancel-reason,
    list/isolation, listMy, capacity-engine-ignores).
  - `tests/integration/planner-office-tasks.test.ts` (3 tests — planner lane sources).
  - `tests/integration/task-templates.test.ts` (4 tests — create / list-for-event,
    evaluate-and-generate, replay idempotency, filter narrowing).
- Permission catalog unchanged (24 permissions) — D3 reuses `case:edit`,
  `production:plan`, `admin:config`.
- Metric registry: +1 entry (`open_office_tasks_for_case`), 20 total.
