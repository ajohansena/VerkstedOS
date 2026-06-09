# 13 — Production Planning & Scheduling Domain

This document defines how production planning should work inside a modern Norwegian collision repair workshop. It is the planning-experience layer that sits on top of the Production Domain (doc 10), the role information design (doc 11), and the UX architecture (doc 12).

**This is an architecture and UX document only. No code, no migrations, no database changes.** Where the existing architecture needs a decision before this experience can be built, it is flagged in § 16 (STOP AND ASK) rather than redesigned here.

---

## Status of this document

> **Review basis: documented architecture (Option A).**
> The "Current Production Board review" in § 3 evaluates the *designed* Production Board as specified in doc 11 (Production Manager dashboard) and doc 12 (Production Board section). It is **not** a review of the actual sprint 1–16 implementation, because that code has not been provided. Every finding in § 3 marked ⚠ *(verify against code)* must be confirmed against what was actually built before it is treated as fact.
>
> When the real implementation is available, § 3 should be re-run against it. The rest of the document (the target experience, the planning modes, the architecture-compatibility validation in § 16) stands regardless.

---

## 0. How to read this document

This document cross-references the rest of the package heavily. It deliberately does not duplicate them.

| When this document refers to... | The authoritative source is... |
|---|---|
| ProductionOrder, WorkSegment, ResourceAssignment, Resource, Capacity engine, DeliveryForecast, CaseTransfer, WorkflowDefinition | doc 10 — Production Domain |
| What each role needs to see | doc 11 — Dashboards |
| Navigation, Operations Center, Case Workspace, command palette, design principles, anti-patterns | doc 12 — UX Architecture |
| Multi-tenancy, permissions | doc 05 |
| Events, real-time | doc 02 |
| Governance rules (Database First, No Cleverness, Three Surfaces, SSoT) | CLAUDE.md / doc 07 |

If this document and any of the above appear to conflict, the conflict is surfaced in § 16, not resolved unilaterally here.

---

## 1. Core philosophy — planning is the heart

The directive proposes that the true heart of VerkstedOS is not the Operations Center but the **Production Planning experience**. After evaluating this against the documented architecture, the philosophy is **validated, with one refinement.**

### Validation

The claim holds for one specific role: the **Production Manager**. For them, the Operations Center provides *awareness* ("what needs attention now?"), but the Planning Board is where the actual day's work of *running the workshop* happens — assigning, sequencing, rebalancing, resolving. A production manager who only had the Operations Center could see problems but not act on them efficiently. The Planning Board is where action lives.

This aligns with doc 12 § 6, which already states: *"The manager lives on the Production Board and the Operations Center. They visit Capacity and Planning when they need to plan."* This document elevates that — the Planning Board *absorbs* the separate "Capacity view" and "Planning calendar" that doc 12 listed as distinct surfaces. They become **modes of the Planning Board**, not separate destinations (see § 2).

### The refinement

"Planning is the heart" is true **for the production manager**, not for every role. The center of gravity differs by role:

| Role | Where they spend most of their day | Why |
|---|---|---|
| Production Manager | **Planning Board** | Running and rebalancing the workshop |
| Technician | My Tasks (mobile queue) | Doing the assigned work |
| Estimator | Case Workspace + intake | Creating and locking estimates |
| Parts Coordinator | Parts surface | Resolving parts across cases |
| Workshop Owner | Operations Center + Insights | Health and oversight |

So the precise statement is: **The Case is the center of gravity of the product (doc 12 § 1). The Planning Board is the center of gravity of the production manager's day.** Both are true; they operate at different levels. This document does not displace the case-centric model — the Planning Board is a surface *over* cases, and clicking any planned item opens the case (as a drawer; see § 7).

### The three surfaces and their relationship (preview of § 15)

```
Operations Center   →  "What needs attention right now?"   (awareness)
Production Board     →  "How do I run the workshop today?"  (action / planning)
Case Workspace       →  "Do the work on this one case"      (execution / detail)
```

The production manager flows: glance at Operations Center → spend the day on the Planning Board → drop into a Case (drawer) when a specific case needs attention → back to the board. Full treatment in § 15.

---

## 2. The Production Board v3 principle

**Decision (validated): this is not a separate "Calendar" module. The existing Production Board evolves into a richer planning system — Production Board v3 — where the different planning modes are different visualizations over the same underlying planning engine.**

This is the single most important architectural principle in this document, and it is **fully compatible** with doc 10.

### One engine, many views

```
                    ┌─────────────────────────────────────┐
                    │      PLANNING ENGINE (doc 10)        │
                    │                                      │
                    │  ProductionOrder · WorkSegment       │
                    │  ResourceAssignment · Resource       │
                    │  Capacity engine · DeliveryForecast  │
                    │  WorkflowDefinition · CaseTransfer   │
                    │  production_holds · dependencies     │
                    └───────────────┬──────────────────────┘
                                    │  (same data, same business logic)
        ┌───────────┬───────────┬───┴────────┬───────────────┐
        ▼           ▼           ▼            ▼               ▼
   ┌────────┐  ┌────────┐  ┌────────┐  ┌──────────┐   ┌──────────┐
   │ BOARD  │  │  DAY   │  │  WEEK  │  │ RESOURCE │   │ MY TASKS │
   │ (state)│  │(timeline)│ │ (grid) │  │ (people) │   │(personal)│
   └────────┘  └────────┘  └────────┘  └──────────┘   └──────────┘
   Only the presentation differs. The engine is identical.
```

### What this means concretely

- A drag in Board View and a drag in Day View both result in the **same** underlying operation: updating a `ResourceAssignment` and/or a `WorkSegment`. The validation, conflict detection, recalculation, and audit are identical (§ 8). Only the visual gesture and the rendering differ.
- Switching from Week View to Resource View does **not** change any data, any permission, any calculation. It re-projects the same `ResourceAssignment` and `Capacity` data through a different layout.
- There is one delivery forecast, one capacity calculation, one set of work segments. Every view reads them. No view computes its own version of anything (Single Source of Truth, doc 07).
- Adding a future view (e.g. a Gantt view, a paint-booth-specific view) is a presentation addition only — no engine change.

### Why this matters

It keeps the planning system from fragmenting into five inconsistent tools. It honors the No Cleverness rule (one engine, not five). And it means the heavy correctness work (capacity math, conflict rules, forecast) is done once and trusted everywhere.

### Compatibility note

Doc 10 already models everything the engine needs: `WorkSegment` carries `scheduled_start_at`, `scheduled_end_at`, `planned_workshop_id`, `planned_department_id`, `required_skills`, `required_equipment_kinds`, `planned_minutes`, `actual_minutes`, `status`, and `default_funding_source_id`. `ResourceAssignment` carries `resource_id`, `planned_start_at`, `planned_end_at`, `actual_start_at`, `actual_end_at`, `status`, `role`. The Capacity engine produces `capacity_forecast_snapshots`. **All five views read these existing structures.** No new planning engine is required. (Exceptions flagged in § 16.)

---

## 3. Current Production Board review (theoretical — verify against code)

This reviews the Production Board as **designed** in doc 11 and doc 12. Every item is marked with confidence. ⚠ = must be verified against actual sprint 1–16 code before treating as fact.

### Designed strengths

- **Case-centric cards** — cards are cases, click opens the case. Good foundation. ✓ (design)
- **State columns** — kanban grouped by workflow state, with waiting states visually distinct. ✓ (design)
- **Drag to transition** — drag a card between columns triggers a state transition, permission-checked. ✓ (design)
- **Group by / filter** — group by status/department/workshop/technician/insurer; composable filters; saved as views. ✓ (design)
- **Real-time** — cards move as states change anywhere. ✓ (design)
- **Risk indicators** — 🔴🟡🟢 per card. ✓ (design)

### Designed weaknesses and gaps

| Gap | Severity | Notes |
|---|---|---|
| **Only one view mode** | High | Doc 11/12 describe a single kanban board. No Day, Week, Resource, or My Tasks modes. This is the core of what Production Board v3 adds. |
| **No time dimension** | High | The board groups by *state*, not by *time*. A manager cannot see "what is happening at 09:00 today" or "who is doing what Wednesday." Planning a day or a week is impossible on a pure state-kanban. |
| **No resource-centric view** | High | Cannot see a technician's load, free capacity, or overload at a glance. Capacity was a *separate* surface (doc 12), not integrated into the board. |
| **Cards too sparse** ⚠ | Medium | Designed cards show case number, vehicle, assigned tech, one fact, risk. Missing: parts status, supplement status, QC status, transfer status, planned vs consumed hours, delivery promise. (§ 5 fixes this.) |
| **No drag-to-plan** | High | Drag only *transitions state*. You cannot drag to move work between days, between technicians, or to reschedule. That is scheduling, which the board doesn't do. |
| **Office work invisible** | High | The board shows production work only. Order-parts, call-customer, insurer-follow-up tasks have no place. (§ 10 — and a flagged decision in § 16.) |
| **Click navigates away** ⚠ | Medium | Doc 12 says "click a card → the Case Workspace. Always." That navigates the manager off the board. Drawer-first (§ 7) keeps them on the board. |
| **Limited quick indicators** | Medium | Risk dot only. No at-a-glance icons for missing parts, transfer, customer-action, supplement, invoicing, quality. (§ 6.) |
| **Capacity/Planning split off** | Medium | Doc 12 listed "Capacity view" and "Planning calendar" as separate surfaces. Production Board v3 absorbs them as modes. |

### Missing operational information (on the card)

The designed card cannot answer, without opening the case: *Is it waiting for parts? Is a supplement pending? Has it passed QC? Is it being transferred? How many planned hours remain? When was it promised?* These are exactly the questions a production manager asks all day. § 5 and § 6 fix this.

### Missing planning capabilities

- Scheduling work into specific days / time blocks
- Assigning and reassigning work to specific people by dragging
- Seeing and resolving resource conflicts and overload
- Planning non-production (office) work alongside production
- Reprioritizing the queue manually ⚠ *(verify whether any manual priority exists)*

### Missing interactions

- Drag to reschedule (not just transition)
- Drawer-first case inspection
- Multi-select and bulk actions (assign 3 cases to one tech)
- Inline quick actions on the card (without opening anything)

### Summary

The designed board is a solid **status board**. It is not yet a **planning board**. Production Board v3 turns the status board into a planning system by adding time-based and resource-based views, richer cards, drag-to-plan, drawer-first inspection, and office work — all over the *existing* engine. Nothing in this requires redesigning doc 10 (with the exceptions in § 16).

---

## 4. The planning modes

Five visualizations over one engine (§ 2). Each is described with: what it's for, who uses it, what it reads, what drag does, and a textual wireframe.

A persistent mode switcher sits at the top of the board:

```
┌──────────────────────────────────────────────────────────────────────┐
│ Production Board · Oslo Sentrum                                        │
│ [ Board ] [ Day ] [ Week ] [ Resource ] [ My Tasks ]   Filter ▾  ⌘K   │
└──────────────────────────────────────────────────────────────────────┘
```

Switching modes never changes data, permissions, or calculations — only the projection.

### 4.1 Board View (kanban by state)

**For:** the at-a-glance "where is everything in the process" picture.
**Reads:** case `status` (workflow state) + work segment status + the card data (§ 5).
**Drag does:** transition a case's workflow state (permission-checked). Same as today's designed board.

```
┌──────────┬──────────┬──────────┬──────────┬──────────┬──────────────────┐
│ AWAITING │ READY    │ BODY     │ PAINT    │ ASSEMBLY │ READY FOR        │
│ PARTS (7)│ START (3)│ REPAIR(6)│ (4)      │ + QC (5) │ DELIVERY (4)     │
├──────────┼──────────┼──────────┼──────────┼──────────┼──────────────────┤
│ ┌──────┐ │ ┌──────┐ │ ┌──────┐ │ ┌──────┐ │ ┌──────┐ │ ┌──────┐         │
│ │4690🟡│ │ │4731  │ │ │4722  │ │ │4711🟢│ │ │4665🔴│ │ │4651  │         │
│ │⬡ ⟳   │ │ │      │ │ │👤Per │ │ │🎨Erik│ │ │⏱due  │ │ │✓     │         │
│ │ETA Wed│ │ │👤Lars│ │ │      │ │ │cure  │ │ │now   │ │ │ready │         │
│ └──────┘ │ └──────┘ │ └──────┘ │ │→14:30│ │ └──────┘ │ └──────┘         │
│ ┌──────┐ │          │          │ └──────┘ │          │                  │
│ │4682🔴│ │          │          │          │          │                  │
│ │⬡ ⏱   │ │          │          │          │          │                  │
│ │promis│ │          │          │          │          │                  │
│ └──────┘ │          │          │          │          │                  │
└──────────┴──────────┴──────────┴──────────┴──────────┴──────────────────┘
  ⬡ = missing parts   ⟳ = backorder ETA   ⏱ = time-critical   🎨 = in booth
```

Columns are the org's configured workflow states (doc 10 WorkflowDefinition). Waiting states (Awaiting parts) are visually distinct. Best for the quick "process picture" — but it has no time axis, which is why the other modes exist.

### 4.2 Day View (today's timeline)

**For:** the **morning meeting**. "What is everyone doing today, and in what order?"
**Reads:** `ResourceAssignment` where `planned_start_at` is today, laid out on a time axis, grouped by resource.
**Drag does:** move an assignment to a different time, or to a different resource lane (re-time / reassign). Validation in § 8.

```
┌─────────────────────────────────────────────────────────────────────────┐
│ Day View · Tue 09 Jun · Oslo Sentrum                          [today ▾]  │
├──────────┬────────────────────────────────────────────────────────────────┤
│          │ 07   08   09   10   11   12   13   14   15   16              │
├──────────┼────────────────────────────────────────────────────────────────┤
│ Per H.   │ ▓▓▓▓BMW disassembly▓▓▓│░░░│▓▓▓▓Audi body repair▓▓▓▓▓▓▓▓▓│   │
│ (body)   │                                                              │
├──────────┼────────────────────────────────────────────────────────────────┤
│ Ola O.   │      │▓▓▓Audi body repair▓▓▓▓│▓▓▓▓VW body▓▓▓▓│              │
│ (body)   │                                                              │
├──────────┼────────────────────────────────────────────────────────────────┤
│ Kari N.  │ ░░░ │▓▓▓Tesla paint prep▓│███booth: Tesla paint███│cure→16  │
│ (paint)  │                                                              │
├──────────┼────────────────────────────────────────────────────────────────┤
│ Erik S.  │ ▓▓▓Audi paint app▓▓│cure│▓▓polish▓│                         │
│ (paint)  │                                                              │
├──────────┼────────────────────────────────────────────────────────────────┤
│ BOOTH 1  │ ░░ │██Tesla██│░░│███Audi███│░░░░░░░░░░░░░░░░░░░             │
│ (equip)  │                                                              │
└──────────┴────────────────────────────────────────────────────────────────┘
  ▓ = active labor   █ = equipment occupied   ░ = free   │ = block boundary
```

Equipment (paint booth, frame bench) gets its own lanes — critical because the booth is the workshop's bottleneck (doc 10). The morning meeting walks down this view top to bottom. Clicking a block opens the case drawer (§ 7).

### 4.3 Week View (the week's schedule)

**For:** instant understanding of the week's capacity and commitments. Planning sessions.
**Reads:** `ResourceAssignment` across the week, grouped by resource × day; aggregated against `Capacity` per day.
**Drag does:** move a job to a different day or a different technician. Recalculates capacity and forecast (§ 8).

```
┌──────────────────────────────────────────────────────────────────────────┐
│ Week View · 9–13 Jun · Oslo Sentrum                          [this week ▾]│
├──────────┬──────────┬──────────┬──────────┬──────────┬───────────────────┤
│ Resource │ Mon 9    │ Tue 10   │ Wed 11   │ Thu 12   │ Fri 13            │
├──────────┼──────────┼──────────┼──────────┼──────────┼───────────────────┤
│ Per H.   │ BMW      │ Audi     │ Tesla    │ Tesla    │ Tesla             │
│ (body)   │ ███ 8h   │ ███ 8h   │ ▓▓░ 6h   │ ███ 8h   │ ▓▓░ 5h            │
├──────────┼──────────┼──────────┼──────────┼──────────┼───────────────────┤
│ Ola O.   │ Audi     │ Audi     │ VW       │ VW       │ —                 │
│ (body)   │ ███ 8h   │ ███ 8h   │ ▓▓▓ 7h   │ ▓▓░ 6h   │ ░░░ free          │
├──────────┼──────────┼──────────┼──────────┼──────────┼───────────────────┤
│ Kari N.  │ Tesla    │ Tesla    │ BMW      │ BMW      │ Audi              │
│ (paint)  │ ███ 8h   │ ███⚠ 9h  │ ███ 8h   │ ███⚠ 9h  │ ███⚠ 9h           │
├──────────┼──────────┼──────────┼──────────┼──────────┼───────────────────┤
│ DEPT LOAD│ Body 94% │ Body 100%│ Body 81% │ Body 88% │ Body 63%          │
│          │ Paint 88%│ Paint102%⚠│ Paint 91%│ Paint102%⚠│ Paint 97%        │
└──────────┴──────────┴──────────┴──────────┴──────────┴───────────────────┘
  ⚠ = over capacity   colour-coded load bars per cell
```

The bottom DEPT LOAD row reads the Capacity engine. Cells over 100% are flagged. This view answers "can we take another paint job this week?" instantly — and feeds the "simulate accepting a new case" flow (doc 10 § Capacity engine).

### 4.4 Resource View (people-first)

**For:** balancing the team. Finding overload, free capacity, conflicts.
**Reads:** `Resource` + `ResourceAssignment` + `Capacity`, projected per-person.
**Drag does:** move work *off* an overloaded person *onto* one with free capacity. Conflict/skill validation (§ 8, § 9).

```
┌──────────────────────────────────────────────────────────────────────────┐
│ Resource View · This week · Oslo Sentrum                      Group: skill│
├──────────────────────────────────────────────────────────────────────────┤
│ BODY                                                                       │
│  Per H.    ████████████████████░░  92%   4 cases   no conflicts           │
│  Ola O.    ██████████████░░░░░░░░  71%   3 cases   ░ 11h free this week    │
│  Anders L. ████████████████████████ 108% ⚠ 5 cases  OVERLOADED — Fri/Thu  │
│                                                                            │
│ PAINT                                                                      │
│  Kari N.   ████████████████████████ 102% ⚠ booth-bound, cannot offload    │
│  Erik S.   ██████████████░░░░░░░░░░  68%   ░ capacity for 1 more paint job │
│                                                                            │
│ CALIBRATION                                                                │
│  Nils K.   ████████░░░░░░░░░░░░░░░░  41%   ░ heavily underutilised         │
│                                                                            │
│ APPRENTICE                                                                 │
│  Tom (¾)   ████████████░░░░░░░░░░░░  58%   supervised work only            │
├──────────────────────────────────────────────────────────────────────────┤
│ SUGGESTION: Anders is overloaded Thu/Fri. Ola has 11h free. [Rebalance →] │
└──────────────────────────────────────────────────────────────────────────┘
```

This is where a manager fixes imbalance. Drag a job from Anders to Ola; the system checks Ola has the skill and capacity (§ 9), recalculates both their loads and the case forecasts, and confirms. The SUGGESTION line is an optional assist (not auto-applied).

### 4.5 My Tasks View (personal)

**For:** each individual's personal work queue. Differs by role.
**Reads:** `ResourceAssignment` filtered to the current user (technicians); office tasks for office roles (⚠ entity decision — § 16).
**Drag does:** reorder own priorities where permitted.

**Technician (mobile-first — this is the technician's home, doc 12 § 9):**

```
┌──────────────────────────────┐
│ My Tasks · Per H.    🔔 ⌘K   │
├──────────────────────────────┤
│ NOW                          │
│ ┌──────────────────────────┐ │
│ │ BMW · disassembly        │ │
│ │ clocked in 1h 12m        │ │
│ │ [⏸ Pause] [✓ Complete]  │ │
│ └──────────────────────────┘ │
│ NEXT                         │
│ ┌──────────────────────────┐ │
│ │ Audi · body repair       │ │
│ │ ready · parts ✓          │ │
│ └──────────────────────────┘ │
│ ┌──────────────────────────┐ │
│ │ Tesla · body repair      │ │
│ │ Wed · waiting paint first│ │
│ └──────────────────────────┘ │
└──────────────────────────────┘
```

**Office (desktop):**

```
┌──────────────────────────────────────────────────────────┐
│ My Tasks · Pia (office)                          ⌘K       │
├──────────────────────────────────────────────────────────┤
│ TODAY                                                      │
│  ☐ Order parts · Case 4731 (estimate just locked)          │
│  ☐ Call customer · Case 4665 (ready, arrange pickup)       │
│  ☐ Insurer follow-up · If · Case 4690 (supplement 4d)      │
│  ☐ Rental booking · Case 4711 (repair > 3 days)            │
│  ☐ Invoice · Case 4651 (delivered yesterday)               │
│ OVERDUE                                                    │
│  ⚠ Documentation · Case 4644 (delivered, missing photos)   │
└──────────────────────────────────────────────────────────┘
```

The office My Tasks view is where the **office task** question becomes concrete — see § 10 and the flagged decision in § 16.

### Shared-engine summary

| View | Reads | Drag operates on | New engine concept? |
|---|---|---|---|
| Board | workflow state + segment status | workflow state transition | No |
| Day | ResourceAssignment (today, time axis) | ResourceAssignment time + resource | No |
| Week | ResourceAssignment (week) + Capacity | ResourceAssignment day + resource | No |
| Resource | Resource + ResourceAssignment + Capacity | ResourceAssignment resource | No |
| My Tasks (tech) | ResourceAssignment (self) | own priority order | Manual priority ⚠ § 16 |
| My Tasks (office) | office tasks | office task scheduling | Office task entity ⚠ § 16 |

Four of the five views are fully supported by the existing engine. The two flags are in § 16.

---

## 5. The rich production card

The directive is right: the designed card carries too little. Below is the field inventory with a verdict on each, and the card variants per view.

### Field inventory — what belongs on the card

| Field | On card? | Reasoning |
|---|---|---|
| Registration number | ✅ always | Primary human identifier on the floor |
| Make / model | ✅ always | Recognition; "the silver Audi" |
| Risk level (🔴🟡🟢) | ✅ always | The single most important at-a-glance signal |
| Assigned technician | ✅ always (where relevant) | "Whose is this?" |
| Current bottleneck / blocker | ✅ when present | The reason it's not moving |
| Parts status indicator | ✅ when not OK | Missing parts is the #1 delay cause |
| Supplement status indicator | ✅ when pending | Pending supplement = stalled work |
| Delivery promise | ✅ compact (day) | "When did we promise?" |
| Estimated completion (forecast) | ✅ compact, when ≠ promise | Forecast vs promise gap = risk |
| Transfer status indicator | ✅ when transferring | "It's not even here right now" |
| QC status indicator | ✅ when in/failed QC | Rework loops |
| Customer-action indicator | ✅ when waiting | "We're blocked on the customer" |
| Invoicing-pending indicator | ✅ when delivered, unbilled | Office follow-up signal |
| Planned hours | ◐ on hover / dense views | Useful but secondary on the card face |
| Consumed hours | ◐ on hover / dense views | Useful as planned-vs-consumed, not raw |
| Customer name | ◐ secondary | Often less useful than reg on the floor |
| Insurer | ◐ filter/badge, not face | Matters for filtering more than glancing |
| Workshop | ◐ only in multi-workshop views | Redundant in single-workshop board |
| Department | ◐ implied by column/lane | Usually redundant with position |
| VIN | ✗ never on card | Belongs in the drawer |
| Full estimate total | ✗ never on card | Belongs in the drawer |

Legend: ✅ on the card face · ◐ on hover, dense view, or as a badge · ✗ not on the card.

### Design principle for the card

**The card shows identity + risk + the single most relevant status, plus quiet indicators for anything that needs attention.** It does not try to show everything — that recreates the ERP density the product rejects (doc 12 § 17). Everything else is one click into the drawer (§ 7) or visible on hover.

### Card variants by view

```
COMPACT (Board, Week — high density)        EXPANDED (Day, Resource — more space)
┌────────────────┐                          ┌──────────────────────────────┐
│ AB12345  🔴     │                          │ AB12345 · Audi A4    🔴 at risk│
│ Audi A4         │                          │ Hansen · Fremtind              │
│ 🎨 Erik · cure  │                          │ 🎨 Erik · paint app · cure→16  │
│ ⬡ promised today│                          │ ⬡ missing 1 part · ⚑ supplement│
└────────────────┘                          │ planned 14h · used 9h          │
                                             │ promise Fri · forecast Mon 🔴  │
MICRO (My Tasks mobile)                       └──────────────────────────────┘
┌────────────────┐
│ BMW · disassembly│
│ clocked in 1h12m │
└────────────────┘
```

Same data, three densities. The view picks the density; the data source is identical (SSoT).

---

## 6. Quick indicators — the visual language

Cards must communicate status **without opening the case**. A small, consistent, unobtrusive icon set. Color reinforces but never carries meaning alone (accessibility).

| Indicator | Icon | Color | Meaning | Source |
|---|---|---|---|---|
| Missing parts | ⬡ | amber | One or more part requirements not yet received | doc 10 PartRequirement status |
| Backorder ETA | ⟳ | amber | A part is backordered with an ETA | doc 06/10 part lifecycle |
| Transfer in progress | ⇄ | blue | Case is being / will be transferred to another workshop | doc 10 CaseTransfer |
| Customer action required | 👤! | purple | Blocked on a customer decision | production_holds (customer) |
| Supplement pending | ⚑ | amber | A supplement awaits approval | production_holds (approval) |
| Invoicing pending | kr | grey | Delivered but not yet invoiced | doc 08 InvoiceBasis state |
| Quality issue / rework | ✕QC | red | Failed QC or in rework | doc 10 QualityDeviation |
| Delayed | ⏱ | red | Past a planned milestone / promised date | DeliveryForecast |
| At risk | 🔴 | red | Forecast threatens the promise (confidence low) | DeliveryForecast |
| On track | 🟢 | green | No issues | derived |
| In booth / equipment-bound | 🎨/⚙ | neutral | Occupying a constrained resource | ResourceAssignment (equipment) |

### Rules for indicators

- **Show only what's true and actionable.** A card with no issues shows just 🟢 — no clutter.
- **Maximum ~3–4 indicators on a card face.** Beyond that, a "+2" overflow that reveals the rest on hover.
- **Every indicator is derived from existing data** (doc 10/06/08) — no new state is invented to drive an icon (this matters for SSoT and for the § 16 compatibility check).
- **Icon + color + accessible label** (screen reader / tooltip). Never color alone.
- **Consistent everywhere** — the same ⬡ means missing-parts on the card, in the drawer, in the Operations Center, in notifications.

This is the same red/yellow/green discipline as doc 12 § Design Principles, extended into a small icon vocabulary.

---

## 7. Drawer-first philosophy

**Decision (validated, refines doc 12): clicking a case on the Planning Board opens a right-side drawer — it does not navigate away.**

Doc 12 § 5/§ 6 said "click a card → the Case Workspace. Always." For the Planning Board specifically, that is refined: navigating away from the board breaks the planning flow. Instead, the case opens **as a drawer over the board**, so the manager keeps their context.

```
┌───────────────────────────────────┬────────────────────────────────┐
│  PRODUCTION BOARD (stays visible)  │  CASE 4711 · Audi A4   [↗][✕]  │
│                                    │  🟢 In paint · promise Fri      │
│  [Board][Day][Week][Resource][My]  │ ┌────────────────────────────┐ │
│                                    │ │ Overview Estimate Production│ │
│  ┌──────┐ ┌──────┐ ┌──────┐        │ │ Parts Docs Photos Comms     │ │
│  │ 4690 │ │ 4711◀│ │ 4665 │        │ │ Finance History            │ │
│  │      │ │ open │ │      │        │ ├────────────────────────────┤ │
│  └──────┘ └──────┘ └──────┘        │ │ (current tab content)      │ │
│  ┌──────┐ ┌──────┐                 │ │                            │ │
│  │ 4682 │ │ 4731 │                 │ │ activity timeline,         │ │
│  │      │ │      │                 │ │ inline actions...          │ │
│  └──────┘ └──────┘                 │ │                            │ │
│                                    │ └────────────────────────────┘ │
└───────────────────────────────────┴────────────────────────────────┘
   board remains interactive behind/beside the drawer
```

### Drawer contents (the case, in a drawer)

The drawer is the **Case Workspace** (doc 12 § 5) rendered in a drawer. Same tabs: **Overview · Estimate · Production · Parts · Documents · Photos · Communication · Finance · History.** Same inline actions. Same data. It is not a reduced version — it is the case workspace, positioned as a drawer so the board stays in context.

### Rules

- **Drawer for inspection-in-context** (the default on the Planning Board).
- **Full-page Case Workspace still exists** — the `[↗]` "open full" button in the drawer header navigates to the full page for deep work. So the manager chooses: glance (drawer) or commit (full page).
- **Esc / click-away** closes the drawer, returns focus to the board.
- **The board stays live** behind the drawer — cards still move in real-time.
- On **mobile**, there is no drawer; tapping a card opens the case (mobile slice, doc 12 § 5) full-screen, because side-by-side doesn't fit (§ 14).

This minimizes navigation-away (the directive's goal) while preserving the case-centric model (doc 12 § 1) — the case is still where work happens; it's just presented without losing the board.

---

## 8. Drag & drop planning

Every drag, in every view, resolves to an operation on the **existing** engine (§ 2). Here is what each drag does, and the validation / conflict / recalculation / confirmation / audit pipeline that is identical across views.

### The drag operations

| Gesture | Underlying operation | Entity touched (doc 10) |
|---|---|---|
| Move work to another **day** | change `planned_start_at` / `planned_end_at` | ResourceAssignment |
| Move work to another **time** (Day view) | change `planned_start_at` / `planned_end_at` | ResourceAssignment |
| Move work to another **technician** | change `resource_id` | ResourceAssignment |
| Move work to another **department** | change `planned_department_id` (+ reassign resource) | WorkSegment + ResourceAssignment |
| Move work to another **workshop** | reassign `planned_workshop_id` → triggers/extends CaseAssignment | WorkSegment + CaseAssignment ⚠ § 16 |
| **Reprioritize** within a queue | manual priority override | ⚠ § 16 (no field today) |
| **Transition state** (Board view) | workflow transition | production_state_history |

### The pipeline (identical across all views)

```
1. User drags item to target
        ↓
2. VALIDATE (before drop is committed)
   - Permission: does the user have production:plan? (doc 05)
   - Skill match: does the target resource have the required skill? (doc 10 Resource skills)
   - Equipment: is the required equipment available in the target slot?
   - Dependencies: are prerequisite segments still satisfied? (WorkSegmentDependency)
   - Calendar: is the target resource working then (not on absence)? (doc 10 calendar)
        ↓
3. DETECT CONFLICTS (warn, don't always block)
   - Overlap: target resource already assigned in that slot
   - Overbooking: target day/resource exceeds capacity (Capacity engine)
   - Cross-funding: does the move mis-allocate a funding source? (doc 03)
   Per org overbooking policy (doc 10): strict = block, warn = allow with confirm, silent = allow
        ↓
4. CONFIRM (when the move has consequences)
   - "This moves Audi paint to Friday. Forecast slips to Mon. Confirm?"
   - "Anders is at 108% Friday. Assign anyway?"
   - Trivial moves (free slot, no forecast change) commit without a dialog
        ↓
5. COMMIT (optimistic UI, real change)
   - Update the ResourceAssignment / WorkSegment via the service layer
   - Optimistic update on the board; rollback on server rejection
        ↓
6. RECALCULATE
   - Capacity forecast for affected resources/days (doc 10 Capacity engine)
   - Delivery forecast for the affected case(s) (doc 10 DeliveryForecast)
   - Bottleneck detection re-runs for affected resources
        ↓
7. EMIT EVENTS + AUDIT
   - production.segment.rescheduled / .reassigned (doc 02 outbox)
   - Full audit on the ResourceAssignment/WorkSegment change (doc 03 audit tier)
   - Real-time broadcast: other users' boards update live (doc 02 Realtime)
```

### Why "warn, don't always block"

Collision repair planning is human judgment under pressure. A manager *will* deliberately overbook (overtime, weekend shift, expedited paint). The system surfaces the consequence and lets them proceed — except where org policy is `strict` or where a hard invariant is violated (no skill, equipment physically unavailable, dependency not met). This matches doc 10's overbooking policy and the doc 12 principle of opinionated-but-not-obstructive.

### Audit

Every drag that commits is fully audited (doc 03 — ResourceAssignment and WorkSegment are full-audit). The audit records: who moved what, from where to where, when, and the reason if one was required. This satisfies the governance audit requirement and means the Dev Control Plane can reconstruct any planning decision.

---

## 9. Resource planning (the people model)

The planner must naturally handle the real mix of a Norwegian workshop. The existing `Resource` + `resource_skills` model (doc 10) supports this; here is how the planning experience uses it.

| Resource kind | Planning behavior |
|---|---|
| **Body technician** | Plannable on body segments; matched by `body` skill |
| **Painter** | Plannable on paint segments; often booth-bound (equipment dependency) |
| **Combination employee** | Holds multiple skills (e.g. `body` + `paint`); plannable on either; the planner shows them in both skill groups in Resource View |
| **Apprentice** | Skill at `apprentice` proficiency (doc 10); planner can flag "supervised only" and warn if planned solo on work requiring `qualified`+ |
| **Office worker** | Plannable on office tasks (§ 10); appears in My Tasks (office); not on production segments |
| **Subcontractor** | Plannable as an external resource on segments like `calibration_adas` or `glass_replacement`; tracked as a black box with start/end (doc 10) |

### Multiple competencies

A combination employee with `body` + `paint` skills:
- Appears in **both** skill groups in Resource View, with a single combined utilization (so you never double-count their capacity)
- The planner, when assigning, matches the **segment's** `required_skills` against the person's skills; a combination employee is eligible for either
- Overload is computed on their **total** assignments across all skills, not per-skill — this is the correct real-world behavior (one person, one set of hours)

This is fully supported by doc 10's `resource_skills` (many skills per person) and the Capacity engine (capacity is per-resource, not per-skill). No change needed.

### Apprentice supervision (a planning nuance)

An apprentice planned on work requiring `qualified` proficiency triggers a soft warning ("Tom is an apprentice; this work normally needs a qualified tech — assign a supervisor?"). This is a presentation-layer rule reading existing proficiency data, not a new entity. ✓ compatible.

---

## 10. Office planning

The directive is right that the planning board is not only for workshop staff. Office work — order parts, customer calls, rental booking, supplement requests, insurer follow-up, invoicing, documentation — must be plannable alongside production.

### How office tasks coexist with production

Office tasks differ from production work segments in important ways:
- They are **not** decomposed from an estimate
- They do **not** consume a production resource or equipment
- They are often short, discrete actions ("call the customer")
- They are frequently tied to a case but are not production work *on* the vehicle
- Some are not tied to a single case at all (e.g. "weekly insurer reconciliation")

### The experience (regardless of the underlying model)

- Office tasks appear in **My Tasks (office)** as a personal checklist (§ 4.5)
- They can be surfaced on the **Day** and **Week** views in an "office" lane or row, distinct from production lanes, so a manager sees the whole workshop's work — production and office — in one place
- Many are **generated automatically** by events: estimate locked → "order parts" task; case delivered → "invoice" task; repair > 3 days → "rental booking" task; supplement created → "insurer follow-up" task. This is the same event system (doc 02) that drives notifications — an office task is a actionable, plannable cousin of a notification.
- They carry the same quick indicators where relevant (overdue ⏱, customer-action 👤!)

### The architectural question (FLAGGED — see § 16)

**There is no entity in doc 10 that cleanly represents a standalone office task.** WorkSegment is production work decomposed from an estimate; Task (doc 10) is a finer sub-segment *of* a WorkSegment. Neither fits "call the customer about case 4711."

This is the most significant compatibility finding in this document. Options and a recommendation are in § 16. **It is not resolved here.** The office-planning *experience* described above is what we want; the *entity* that backs it needs a decision.

---

## 11. Workshop transfers (visual)

Inter-workshop transfers (doc 10 CaseTransfer / CaseAssignment) must be visible on the planning board, because a case being transferred is *not available to plan locally* during transit, and the receiving workshop needs to plan for its arrival.

### On the board

A case in transit shows the transfer indicator (⇄) and, in time-based views (Day/Week), appears as a transit block:

```
Day View — a transferring case

│ Case 4688 (Oslo → Drammen)                                          │
│  ⇄ 08:00 depart Oslo  ──transport──▶  09:15 arrive Drammen          │
│  [grey transit block — not assignable to an Oslo resource]          │
```

### Behavior

- **At the sending workshop:** the case's local segments end; it shows as departing; it drops off the local plan after departure.
- **In transit:** a transit block on the timeline (Day/Week) with departure and expected arrival (doc 10 CaseTransfer `expected_departure_at` / `expected_arrival_at`). Not assignable to a local resource.
- **At the receiving workshop:** the case appears as **inbound** — visible on their board *before* it physically arrives, so they can pre-plan (e.g. reserve a booth slot for when it lands). On arrival confirmation (doc 10), it becomes a normal plannable case.
- **Planning updates automatically:** the transfer events (doc 02) drive the board on both sides in real-time. The sending board removes it; the receiving board surfaces it. No manual re-entry.

### Compatibility

Fully supported by doc 10's CaseTransfer + CaseAssignment + the event system. The only new work is presentation (the transit block, the inbound state on the receiving board). ✓ compatible. (Note: dragging a *single segment* to another workshop — as opposed to transferring the whole case — is a separate, subtler question flagged in § 16.)

---

## 12. Flexible production flow

Collision repair is not linear. The planner must support the full sequence, skipping stages for small repairs and adding stages for large ones:

```
Disassembly → Body Repair → Paint Prep → Primer → Paint → Polish
   → Reassembly → Calibration → QC → Delivery
```

Small repairs skip stages (a bumper scuff may go straight to Paint Prep). Large repairs add stages (structural work, multiple paint cycles).

### How the architecture already supports this

Doc 10 models this **without** a rigid linear pipeline:
- **WorkSegments are created from the estimate**, so a small repair simply *has fewer segments*. There is no "skip" — the stage just doesn't exist for that case.
- **WorkSegmentDependency** expresses the real ordering constraints (can't paint an un-repaired panel) without forcing a global linear flow. Independent segments can run in parallel.
- **The segment catalog is configurable** (doc 10) — large repairs add segments; orgs add custom stages.

### The key refinement: derive progress, don't maintain it manually

The directive states: *"Vehicle progress should primarily derive from WorkSegments, technician clock activity, and resource assignments — not manually maintained workflow states."*

This is a **refinement to how workflow state transitions happen**, and it is **compatible** with doc 10 — which already supports `automatic` and `event_driven` transitions, not just manual ones. The refinement is a lean:

- When a technician completes a work segment (clock activity → segment status), an event fires (doc 02).
- That event **drives** the case's workflow-state transition automatically (e.g. all body segments complete → case moves to "Ready for paint").
- The manager rarely sets state by hand; state is a *projection of segment progress*.
- **Manual override remains available** (a manager can force a state) — but it's the exception, not the rule.

### Why this is a refinement, not a conflict

Doc 10 keeps `production_state_history` as the canonical workflow position and supports event-driven transitions. This document recommends **leaning hard on event-driven derivation** so that progress reflects reality (what's actually been done) rather than someone remembering to drag a card. The data model doesn't change; the *transition configuration* leans toward automatic.

**One thing to confirm (mild flag, § 16):** the balance between derived state and the Board View's drag-to-transition. If state is mostly auto-derived, dragging a card between columns in Board View should either (a) be a manual override (logged as such) or (b) be de-emphasized in favor of the time/resource views. Recommendation in § 16.

---

## 13. Filtering & saved views

Users build custom views and save them (doc 12 § 3 already established saved views in the sidebar; this extends them to the planning board).

### Filters (composable)

Filter the board by any combination of:
- Skill / department (paint, body, mechanical, calibration)
- "My jobs" (assigned to me)
- Status (delayed, at risk, waiting for parts, in QC)
- Insurer (Fremtind, If, Gjensidige…)
- Workshop (in multi-workshop orgs)
- Technician
- Funding source kind (insurance, private, internal_rework)
- Risk level

Filters compose: "paint + delayed + Fremtind" shows only at-risk paint jobs for Fremtind. The filter state applies across **all five view modes** — switching from Board to Week keeps your filter.

### Saved personal views

- A user saves a filtered + grouped configuration as a named view ("My delayed paint jobs", "This week's deliveries")
- Saved views live in the sidebar (doc 12)
- Personal by default; a manager can publish a view to the whole workshop ("Workshop morning-meeting view")
- Saved views are configuration data (light audit), per doc 03

### Compatibility

Filtering and saved views read existing data and store small configuration records. No engine change. ✓ compatible. (Saved-view storage is a small config table, consistent with doc 12's existing saved-views concept — confirm it was built in sprint 1–16, otherwise it's a small addition, not a redesign.)

---

## 14. Desktop / Tablet / Mobile — intentional per platform

Per doc 12 § 13 and the directive: do not shrink desktop onto mobile. Each platform gets an intentional planning experience.

### Desktop (the planning cockpit)

- **All five view modes.** The full board, drag-and-drop, drawer-first, multi-select, keyboard-driven.
- This is where the production manager spends most of their day (§ 1, § 15).
- Dense, multi-pane, ⌘K, hover-for-detail.

### Tablet (the morning-meeting & floor-supervisor device)

- **Day View and Board View are first-class** (the morning meeting runs on a wall-mounted or handheld tablet).
- **Week and Resource views: read + light adjust** (drag works with larger targets; complex multi-select is desktop).
- Drawer becomes a full-screen overlay (less horizontal room).
- Touch-optimized: bigger blocks, bigger drag handles.

### Mobile (not a planning device — a participation device)

- **My Tasks is the mobile experience** (the technician's home, doc 12 § 9). Not the full board.
- **Board View: read-only glance** (a manager checking from the floor).
- **No drag-to-plan on mobile** — planning is deliberate desktop/tablet work; doing it on a phone invites errors on shared production data.
- Tapping a card opens the case mobile slice full-screen (no drawer; § 7).

### Platform matrix

| Capability | Desktop | Tablet | Mobile |
|---|---|---|---|
| Board View | ✅ full | ✅ full | ○ read-only |
| Day View | ✅ full | ✅ primary | ○ read-only |
| Week View | ✅ full | ◐ read + light edit | ✗ |
| Resource View | ✅ full | ◐ read + light edit | ✗ |
| My Tasks | ✅ | ✅ | ✅ primary (tech) |
| Drag-to-plan | ✅ | ✅ (larger targets) | ✗ |
| Drawer-first | ✅ side drawer | ◐ full overlay | ✗ full-screen case |
| Multi-select / bulk | ✅ | ○ | ✗ |

✅ first-class · ◐ supported, not primary · ○ limited · ✗ deliberately absent

---

## 15. Operations Center vs Production Board vs Case Workspace

The three core surfaces, clearly distinguished. This resolves where a user is at any moment and why.

| | Operations Center | Production Planning Board | Case Workspace |
|---|---|---|---|
| **Question it answers** | "What needs attention right now?" | "How do I run the workshop today?" | "What's happening with this one case?" |
| **Optimized for** | Awareness, triage | Planning, sequencing, rebalancing | Execution, detail, history |
| **Primary user** | Everyone (role-adaptive) | Production Manager | Everyone who works a case |
| **Time horizon** | Now (live) | Today → this week (planning) | This case's whole lifecycle |
| **Granularity** | Aggregate (what's wrong) | Mid (work × time × people) | Deep (one case, every detail) |
| **Time spent (Prod. Mgr.)** | Minutes (glances) | **Most of the day** | Bursts (when a case needs them) |
| **Entry point** | Login home / ⌘K | Sidebar / ⌘K / from an alert | Click any case anywhere (drawer or full) |
| **Doc reference** | doc 12 § 4 | this doc | doc 12 § 5 |

### The production manager's day (the loop)

```
Morning:
  → Operations Center (2 min): "anything on fire overnight?"
  → Day View morning meeting (15 min): walk the day with the team
  
Most of the day:
  → Production Board (Day/Week/Resource): plan, rebalance, resolve
  → a case needs attention → drawer opens over the board → resolve → back
  → a part arrives / a tech finishes → board updates live → adjust

Periodically:
  → Operations Center glance: did anything new go red?

Rarely:
  → full Case Workspace (deep work on one complex case)
  → Insights (weekly: trends)
```

The Operations Center is the **dashboard of attention**. The Planning Board is the **workbench**. The Case Workspace is the **detail view**. A manager glances at the first, works on the second, and dives into the third when needed. This is the validated philosophy of § 1.

### For non-managers

- **Technician:** lives in My Tasks (a mode of the board); barely touches the other board modes; opens the case slice to do work. Operations Center is a light glance.
- **Estimator:** lives in the Case Workspace + intake; uses the board only to see where their estimated cases are.
- **Owner:** lives in Operations Center + Insights; uses the board to spot-check.

So the Planning Board is the *manager's* heart; the Case is the *product's* heart. No contradiction (§ 1).

---

## 16. Architecture compatibility review (the real validation)

This is the section the directive most needs: an honest check of whether the existing architecture (doc 10) supports this planning experience, with conflicts flagged for decision rather than redesigned.

### Fully compatible — no architecture change required

| Capability | Supported by (doc 10 unless noted) |
|---|---|
| Board / Day / Week / Resource views | WorkSegment, ResourceAssignment, Capacity engine, state history — all exist |
| Rich cards (§ 5) | All fields read existing entity data |
| Quick indicators (§ 6) | All derived from existing data (parts, holds, forecast, transfer, QC) |
| Drag to reschedule / reassign (most) | Updates existing ResourceAssignment / WorkSegment fields |
| Drag pipeline: validate / conflict / recalc / audit (§ 8) | Permission model (05), Capacity engine, DeliveryForecast, audit (03), events (02) |
| Drawer-first (§ 7) | Renders the existing Case Workspace (doc 12 § 5) as a drawer |
| Resource planning incl. multi-competency, apprentice, subcontractor (§ 9) | resource_skills (many per person), capacity per-resource |
| Workshop transfers on the board (§ 11) | CaseTransfer + CaseAssignment + events |
| Flexible / non-linear flow (§ 12) | WorkSegment + WorkSegmentDependency + configurable catalog |
| Event-driven progress derivation (§ 12) | WorkflowDefinition already supports automatic/event-driven transitions |
| Filtering + saved views (§ 13) | Reads existing data + small config records (doc 12 saved views) |

The large majority of Production Board v3 is **presentation over the existing engine.** This validates the core philosophy: the architecture *does* support a world-class planning experience.

### STOP AND ASK — decisions needed before implementation

Four items require a project-owner decision. None is resolved here.

---

**🛑 16.1 — Office tasks: no backing entity (most significant)**

*What:* § 10 needs standalone, plannable, often case-linked office tasks (order parts, call customer, insurer follow-up, invoicing, rental booking, documentation). Doc 10 has no entity for this. WorkSegment = production work from an estimate; Task = sub-segment of a WorkSegment. Neither fits.

*Why it exists:* the production domain was modeled around vehicle work, not office work. Office work was implicitly handled via notifications, not as plannable items.

*Options:*
1. **New lightweight `OfficeTask` (or `PlanningTask`) entity** — `id, organization_id, case_id (nullable), kind, title, assignee_resource_id, due_at, status, generated_by_event, audit`. Cleanest separation; office work is genuinely different from production work. Most new surface area.
2. **Extend the WorkSegment concept with non-production segment kinds** — add office segment codes to the catalog (`office_order_parts`, `office_customer_call`, etc.) with no equipment/skill requirement. Reuses the engine (one planning unit), but overloads WorkSegment's meaning ("segment of vehicle work") and may pollute production metrics (hours, throughput) if not carefully excluded.
3. **Surface notifications as the office task list** — no new entity; My Tasks (office) is a filtered, actionable notification view. Smallest change; but notifications aren't plannable/schedulable/assignable the way tasks need to be, and can't appear as blocks on Day/Week.

*Recommendation:* **Option 1 (new `OfficeTask` entity).** Office work is conceptually distinct from vehicle work; keeping it separate avoids polluting production metrics and honors the No Cleverness rule (don't overload WorkSegment into meaning two things). It's a modest, well-bounded addition, generated largely by existing events. **This requires approval (Architecture Freeze, CLAUDE.md § 4.1) because it adds an entity.**

*TakstKontroll note (CLAUDE.md § 4.7):* office tasks are not billable production work; they must be excluded from estimate/invoice/cost calculations so a future TakstKontroll never mistakes them for billable work. Option 1 makes this exclusion natural; Option 2 makes it error-prone.

---

**🛑 16.2 — Manual reprioritization: no field today**

*What:* § 4.5 / § 8 allow a user to reorder their own queue or a manager to reprioritize jobs. Doc 10's production queue uses a *computed* priority (`production_priority` calculation). There is no manual-override field.

*Options:*
1. Add a nullable `manual_priority_override` to WorkSegment/ResourceAssignment; the queue calculation respects it when present. Small, bounded.
2. Keep priority fully computed; "reprioritization" is achieved indirectly by changing due dates or scheduling (no direct priority handle). No schema change, but less direct UX.

*Recommendation:* **Option 1**, a single nullable override field, respected by the existing `production_priority` calculation (so SSoT holds — the calculation still owns priority, it just reads an override). Minor; needs approval as a field addition.

---

**🛑 16.3 — Single-segment cross-workshop move vs whole-case transfer**

*What:* § 8 lists "move work to another workshop." Doc 10's CaseTransfer moves the *whole case*. But a manager may want to send *one segment* (e.g. paint) to another workshop while the case is "based" at the origin — which doc 10 models as a CaseAssignment with a `role` (e.g. a paint assignment at workshop B) rather than a full transfer.

*The question:* when a manager drags a single paint segment to Workshop B in the planner, is that (a) a partial/role-based CaseAssignment at B, or (b) a full CaseTransfer? Doc 10 supports the A → B → C → A pattern via CaseAssignment, so the capability exists — but the *planner UX semantics* need to be defined so the drag maps to the right operation.

*Recommendation:* dragging a **single segment** to another workshop creates/extends a **role-scoped CaseAssignment** at the target (not a full CaseTransfer); a full CaseTransfer is a distinct, explicit action (the existing transfer flow). No schema change — this is a UX-to-operation mapping decision. Needs confirmation, not redesign.

---

**🛑 16.4 — Board drag-to-transition vs derived progress**

*What:* § 12 recommends leaning on event-driven, derived workflow state (progress from segment completion). But Board View (§ 4.1) lets a manager drag a card between state columns. If state is mostly derived, what does a manual drag mean?

*Options:*
1. A manual drag in Board View is an explicit **manual override** of the derived state, logged as such (audit reason). Override is allowed but visible.
2. De-emphasize drag-to-transition in Board View; make Board View primarily read-only for state (state changes happen via segment completion), with manual override behind an explicit action.

*Recommendation:* **Option 1** — keep drag-to-transition as an explicit, audited manual override. Managers sometimes legitimately need to force state (e.g. mark "Ready for delivery" when reality outran the system). Log it as an override so derived-progress remains the norm and overrides are visible. No schema change. Needs confirmation.

---

### Summary of flags

| # | Item | Type | Needs |
|---|---|---|---|
| 16.1 | Office task entity | **New entity** | Approval (Architecture Freeze) — recommend new `OfficeTask` |
| 16.2 | Manual priority override | New field | Approval — recommend nullable override field |
| 16.3 | Single-segment cross-workshop | UX→operation mapping | Confirmation — recommend role-scoped CaseAssignment |
| 16.4 | Drag-to-transition vs derived state | Behavior decision | Confirmation — recommend audited manual override |

Only **16.1** is a genuine architecture addition (a new entity). The other three are a small field, a mapping decision, and a behavior decision. The planning experience as a whole is **validated as compatible** with the existing architecture, contingent on these four decisions.

---

## 17. Why this surpasses Eflow

Without overstating, the concrete planning advantages this design delivers over legacy workshop planning (Eflow-class tools):

| Dimension | Legacy (Eflow-class) | VerkstedOS Production Board v3 |
|---|---|---|
| Views | Usually one fixed layout | Five modes over one engine (Board/Day/Week/Resource/My Tasks) |
| Planning unit | Often the whole job | Work segments — plan body, paint, calibration independently |
| Capacity awareness | Manual / separate | Live capacity + forecast woven into Week and Resource views |
| Resource model | People only | People + equipment + facilities (booth as first-class constraint) |
| Multi-competency | Awkward | Native (one person, many skills, single capacity) |
| Office work | Outside the planner | Plannable alongside production (pending § 16.1) |
| Multi-location | Rare / clunky | Native transfers visible on both boards, auto-updating |
| Progress | Manually maintained states | Derived from real clock + segment activity |
| Inspection | Navigate away | Drawer-first; stay on the board |
| Forecast | Static promise dates | Live delivery forecast with confidence, updated on every move |
| Devices | Desktop-shrunk | Intentional desktop / tablet / mobile experiences |
| Real-time | Refresh | Live; the board reflects the floor as it happens |

The defining advantage is the **integration**: planning, capacity, forecast, parts status, and multi-location are not separate tools a manager reconciles in their head — they are one board where moving a job instantly shows the capacity and delivery consequences. That integration, built on the doc 10 engine, is the competitive moat.

---

## 18. Edge cases

| Edge case | Planning behavior |
|---|---|
| Technician calls in sick mid-day | Absence (doc 10) marks them unavailable; their remaining assignments highlight as orphaned; Resource View flags the gap; manager drags work to others or to tomorrow |
| Paint booth breaks down | Equipment marked offline (calendar downtime); all booth-bound segments in that window flag as blocked; Day/Week show the gap; cross-workshop overflow surfaced (§ 11) |
| Supplement adds 6h mid-repair | New segments appear (doc 10); they land unplanned in the case; planner sees the case's load grow and forecast slip; manager schedules the new segments |
| Customer wants car back early | Manager re-sequences to prioritize; forecast recomputes; if impossible, the at-risk indicator and a customer-action task (§ 10) surface |
| Two managers drag the same job simultaneously | Optimistic update + server reconciliation; last-write-wins with a conflict toast to the loser; audit records both attempts |
| Drag would violate a hard dependency | Validation (§ 8 step 2) blocks the drop with a clear message ("paint can't precede body repair") |
| Apprentice dragged onto qualified-only work | Soft warning (§ 9); allowed with a supervisor assignment or override |
| Case transferred away while planned locally | Transfer events remove it from the local plan (§ 11); any local future assignments are cancelled with audit |
| Overbooking under `strict` org policy | Drop blocked; manager must free capacity first or change policy |
| Network drop mid-drag (mobile/tablet) | Optimistic update rolls back on failure; the move is not silently lost; user re-tries when reconnected (no offline write queue — doc 12) |
| Office task with no case | Supported (if § 16.1 Option 1): OfficeTask with null case_id, appears in My Tasks/office lane |

---

## 19. Three Surfaces

Per CLAUDE.md, the planning system defines all three surfaces.

### User Surface
- The five-mode Production Board (Board/Day/Week/Resource/My Tasks)
- Drag-to-plan, drawer-first case inspection, rich cards, quick indicators, filtering, saved views
- Routes: `/production` (with mode + filter in state), case drawer overlay
- Permissions: `production:view` (all modes), `production:plan` (drag/assign/reschedule), `production:transition` (Board state drag), `time:self`/`time:other` (clock), office-task permissions TBD with § 16.1

### Admin Surface
- Configure board defaults per org (default mode, default grouping, columns from workflow states)
- Configure office-task auto-generation rules (which events create which tasks) — pending § 16.1
- Configure overbooking policy (strict/warn/silent) — already doc 10
- Publish workshop-wide saved views
- Routes: `/admin/production-board`, `/admin/office-tasks` (pending § 16.1)
- Permissions: `admin:config`

### Dev Surface
- Inspect any ResourceAssignment / WorkSegment and its full reschedule/reassign history
- Replay planning events; rebuild capacity_forecast_snapshots for a workshop/week
- Repair: recompute a case's derived state from its segments; fix orphaned assignments
- Monitor: planning-event throughput, capacity-recalc latency, drag-commit failure rate, real-time board sync lag
- Inspect office-task generation (which event created which task) — pending § 16.1
- Routes: `/dev/production/assignments`, `/dev/production/board-health`, `/dev/production/office-tasks`
- Permissions: `platform:org:view`, `platform:data:repair`, `platform:event:replay`

---

## Relationship to other documents

- **Doc 10 (Production Domain)** — the engine this entire document is a presentation layer over. All planning data lives there. This doc adds no engine concepts except the four flagged in § 16.
- **Doc 11 (Dashboards)** — the Production Manager information inventory; the Planning Board is how that manager actually works. The "Capacity view" and "Planning calendar" doc 11/12 listed as separate surfaces are absorbed here as board modes.
- **Doc 12 (UX Architecture)** — the navigation, command palette, drawer (refined here for the board), design principles, and anti-patterns all govern this board. The Operations Center vs Board vs Case Workspace distinction (§ 15) extends doc 12 § 4-6.
- **Doc 02 (System Architecture)** — events and real-time drive live board updates and office-task generation.
- **Doc 05 (RBAC)** — every drag and view is permission-gated.
- **Doc 03 (Data Model)** — audit tiers for ResourceAssignment/WorkSegment changes; the § 16.1 OfficeTask entity would land here if approved.
- **CLAUDE.md** — Architecture Freeze (§ 16.1 needs approval), Database First (the OfficeTask model precedes any office-task UI), No Cleverness (one engine not five; don't overload WorkSegment), Single Source of Truth (one capacity calc, one forecast, one priority calc, read by all views), Three Surfaces (§ 19), TakstKontroll compatibility (office tasks excluded from billable calculations).

---

## Final note

This document validates the directive's core philosophy: **the Production Planning Board is the production manager's heart, and the existing architecture supports a world-class planning experience** — with one genuine new entity to approve (office tasks, § 16.1) and three smaller decisions (§ 16.2–16.4). Everything else is presentation over the doc 10 engine.

It is an architecture and UX specification, not an implementation. Per Option A, the "current implementation review" (§ 3) is theoretical and must be re-run against the actual sprint 1–16 code before its findings are treated as fact. The target experience, the five-mode model, and the compatibility validation stand regardless of that review.

Nothing here has been built, migrated, or changed. The next step, if this document is approved, is: (1) decide the four § 16 items, (2) run a System Impact Analysis (doc 07 / CLAUDE.md), (3) sequence Production Board v3 into the roadmap (it fits Phase 4, sprints 21-24), (4) only then implement.
