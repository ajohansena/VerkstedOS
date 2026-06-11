# ADR 0011 — CaseBooking and ResourceAssignment are distinct entities

- **Status:** Accepted
- **Date:** 2026-06-11
- **Sprint:** 23 (ST40136 remediation, Phase F)
- **Supersedes:** —
- **Superseded by:** —
- **Related:** docs/13-production-planning.md § 20.4; docs/10-production-domain.md (Capacity engine, Resource, ResourceAssignment); CLAUDE.md § 4.4

## Context

Doc 13 § 20.4 originally stated that "bookings created at intake are normal
`ResourceAssignment` rows". That sentence collapsed two genuinely different
domain concepts into one, and the resulting ambiguity is what produced
ST40136: customer-facing arrival commitments captured at intake never reached
the planner because the planner read model only listed `WorkSegment`-anchored
rows, and the booking-without-a-segment case had no row to project.

The two concepts:

1. **`CaseBooking`** (`case_bookings`) — a **customer-facing commitment**:
   "the car will arrive on Tuesday at 09:00, with a promised delivery on
   Friday afternoon". Lifecycle: `tentative` → `confirmed` → `arrived` →
   (terminal) `cancelled`. There is at most one active booking per case
   (enforced by a partial unique index on `(case_id) WHERE status <> 'cancelled'`).
   A booking can exist before any work is planned in detail — it represents
   the workshop's promise to the customer, not how the work is internally
   scheduled.

2. **`ResourceAssignment`** (`resource_assignments`) — an **internal
   scheduling fact**: "Lakkboks 1 is dedicated to WorkSegment X from
   10:00–12:00 on Wednesday". Tied to a `WorkSegment` and a `Resource`,
   surfaces conflicts, and is the unit the Capacity engine consumes.

These differ across every meaningful axis:

| Axis                | `CaseBooking`                          | `ResourceAssignment`              |
| ------------------- | -------------------------------------- | --------------------------------- |
| Audience            | Customer-facing                        | Internal planner                  |
| Anchors to          | `Case`                                 | `WorkSegment` + `Resource`        |
| Cardinality         | ≤ 1 active per Case                    | N per WorkSegment, N per Resource |
| Lifecycle           | tentative / confirmed / arrived / cancelled | derived from segment status     |
| Capacity engine     | does **not** consume minutes           | consumes minutes                  |
| Permission to write | `case:book`                            | `production:plan`                 |
| When it can exist   | before any plan exists                 | only after a segment exists       |

Conflating them caused four cascading problems:

- The planner was empty for booked-but-not-yet-segmented cases (ST40136).
- Demo seeds had no way to model "an arrival next Tuesday" without forging a
  fake `WorkSegment`.
- Permissions were over-rotated: a receptionist who should be allowed to
  capture a booking would have needed `production:plan` (a planner-tier
  permission) to commit anything.
- The Capacity engine was at risk of double-counting if intake-booked
  "assignments" leaked into resource utilization.

## Decision

**`CaseBooking` and `ResourceAssignment` are permanently distinct entities.**
Neither one is a special case of the other, and the schema reflects that
(separate tables, separate enums, separate write paths, separate
permissions). The doc-13 § 20.4 sentence is rewritten accordingly, and
CLAUDE.md § 4.4 lists "Combine `CaseBooking` and `ResourceAssignment` into
one concept" alongside the existing "Combine `WorkSegment` and `Task`" anti-
pattern.

**UX constraint: one continuous lifecycle in the planner.** Even though the
two entities are distinct in the schema, the planner must present them as a
single continuous lifecycle so operators never see a "gap" where a booked
case disappears from the Day / Week views until segments are added. The
implementing mechanism is a unified read model:

- `PlannerRow` (sub-barrel `src/modules/production/public/index.ts` →
  `listPlannerRowsForRange`) projects two sources into one shape:
  - rows with `lifecycle='booked'`, sourced from active `CaseBooking` rows
    that have **no** active `WorkSegment` for the case yet;
  - rows with `lifecycle='in_progress'`, sourced from `WorkSegment` +
    `ResourceAssignment` joins, optionally annotated with the case's active
    booking as **context** (so a planner can still see the customer-promised
    arrival/delivery while looking at the in-progress segments).
- The transition between the two is purely a consequence of the underlying
  data — adding the first segment to a booked case moves the row from the
  **Booked** lane to the **In Progress** lane without any state machine on
  the booking itself. The booking remains, attached as context.

## Consequences

**Positive:**

- ST40136 fixed at the read-model layer: every booked case is visible on the
  planner from the moment it is booked.
- Each entity carries the permission appropriate to its audience:
  `case:book` for the customer-facing commitment, `production:plan` for the
  internal resource scheduling.
- The Capacity engine remains pure — bookings never enter resource
  utilization (only assignments do).
- The demo seed (Phase E) can populate the planner with both lifecycles
  end-to-end without forging fake segments. The validator run confirmed 5
  pure-booked rows + 3 context bookings on in-progress cases coexisting in
  the same Day / Week views.

**Negative / trade-offs:**

- Two write paths to keep in sync at the UI layer (booking widget at intake,
  resource-assignment widget on the planner). Mitigated by the unified read
  model — once the data is written, the planner shows both uniformly.
- The unified-lifecycle invariant is enforced in code, not in the schema.
  A future "show only assignments" planner mode would have to explicitly
  opt out of the booked lane; the default must always show both.

**Neutral:**

- No schema migration is required by this ADR — `case_bookings` and
  `resource_assignments` already existed as distinct tables; this ADR
  records the principle and removes the misleading doc-13 sentence.
- No new entity, enum, or permission is introduced. The permission catalog
  remains at 24 and the metric registry remains at 20.

## Alternatives rejected

- **Bookings as a special `ResourceAssignment` kind** — the original
  formulation. Rejected on the four cascading problems above (planner
  invisibility, permission over-rotation, Capacity engine pollution risk,
  demo-data forgery requirement).
- **Bookings as a derived view of `WorkSegment`** — would force segments to
  exist before a customer commitment could be recorded, inverting the
  intake-flow's natural order (book first, plan in detail later).
- **Two parallel planner read models, switched per lane** — rejected
  because operators dragging between lanes (e.g. promoting a booking to a
  scheduled segment) would have observed the row briefly disappear from
  one view and appear in the other. The unified `PlannerRow` model
  eliminates that flicker by construction.

## Verification

- Integration tests: `tests/integration/planner-rows.test.ts` (5 tests —
  booked-only, in-progress-only, booked-with-context-promotion, range
  filtering, multi-tenant isolation). Part of the 184/184 sweep.
- Doc 13 § 20.4 rewritten to reflect the distinction and the unified-
  lifecycle invariant.
- CLAUDE.md § 4.4 lists `CaseBooking` alongside `ResourceAssignment` as
  protected aggregates and adds "Combine `CaseBooking` and
  `ResourceAssignment` into one concept" to the may-not list.
- `scripts/seed-demo.ts` (Phase E) populates both lifecycles end-to-end —
  end-to-end run against a fresh testcontainer Postgres produced 5
  pure-booked rows + 3 in-progress cases with context bookings, both
  visible in the same Day / Week views.
- Permission catalog unchanged (24 permissions). Metric registry unchanged
  (20 entries).
