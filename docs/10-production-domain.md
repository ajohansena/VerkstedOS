# 10 — Production Domain Architecture

> The success or failure of VerkstedOS will be determined primarily by the quality of the production planning and workshop operations model.

This document is written from the perspective of a collision-repair operations expert, not a generic ERP architect. The production domain is the heart of VerkstedOS. Everything else exists to feed it, support it, or report on it.

---

## What we are NOT building

We are not building:

- **A manufacturing production system.** Manufacturing assumes a known bill of materials, repeatable times, and minimal discovery. Collision repair has none of those.
- **A generic ERP scheduler.** Generic ERP assumes a job is a fixed assignment of work to resources. Collision repair work changes daily as damage is discovered and approvals shift.
- **A generic job-board / Kanban tool.** Kanban shows status; collision repair needs forecasts, capacity, and bottleneck detection.
- **A project management tool.** Projects have stable scope; cases don't.

What collision repair production actually looks like:

- A unique "product" every time (a damaged vehicle), with the bill of work derived from estimation and revised mid-flow
- Multiple skill domains (body, paint, mechanical, electrical, calibration) operating in partial sequence and partial parallel
- A small number of high-value bottleneck resources (paint booth, frame bench, calibration rig)
- Frequent waiting states (parts, insurance approval, customer decisions, paint cure)
- Heavy physical-location concerns (vehicles take up bays, need parking, occasionally move between sites)
- High variability in actual time vs estimated time
- Mid-flow scope changes are the norm, not the exception
- Quality control is a gate that can send work backwards
- Real money is involved on every line — insurers and accountants will audit

Think of a case like a film production, not a factory order: there's a script (estimate), it changes during shooting (supplements), different crew at different stages (departments), some locations have unique equipment (paint booth), and the "product" needs to be physically tracked between sets.

---

## The eleven operational questions

The production domain must answer these questions at all times, for any user with permission:

1. **Where is the vehicle right now?** — physical location (workshop, yard spot, on transport)
2. **What work has been completed?** — closed work segments, time logged
3. **What work remains?** — open work segments, estimated remaining hours
4. **Who is responsible?** — currently assigned technician(s)
5. **Which department is responsible?** — current active department
6. **Which workshop is responsible?** — current case assignment
7. **Are all required parts available?** — part requirements vs received
8. **Is the vehicle on schedule?** — current forecast vs commitment
9. **What is the expected delivery date?** — forecast with confidence
10. **What is causing delays?** — active waiting states, missing inputs
11. **What is the next bottleneck?** — capacity projection across resources

Every screen in the production domain should help someone answer at least one of these questions. Screens that don't are deleted.

---

## Production aggregates

The Case is the operational root (per the architecture). Within a Case, the production aggregate hierarchy is:

```
Case (root, org-scoped)
 │
 ├── ProductionOrder (1:1 with Case)
 │     │
 │     ├── ProductionStateHistory (event-log of state transitions)
 │     │
 │     ├── WorkSegment (N) — the decomposition of work
 │     │     │
 │     │     ├── ResourceAssignment (N) — planned/actual resource bindings
 │     │     ├── Task (N) — finer-grained sub-segments
 │     │     ├── TimeEntry (N) — actual logged work
 │     │     └── WorkSegmentDependency (N) — prerequisites
 │     │
 │     ├── DeliveryForecast (continuously recomputed)
 │     ├── HoldRecord (N) — explicit pause records when in waiting states
 │     └── BottleneckIndicator (N) — current detected issues
 │
 ├── CaseAssignment (N) — workshop/department over time
 │
 └── TransferEvent (N) — movements between workshops
```

### ProductionOrder

- 1:1 with Case, created when the case is opened
- Holds the current workflow state, current delivery forecast, and an aggregate view of segment status
- The "production summary" that production managers read first
- Survives transfers, pauses, supplements — never recreated

### WorkSegment

The unit of work. A case has many. A segment is **decomposed work**, not a status.

```
work_segments
 ├── id
 ├── organization_id
 ├── case_id
 ├── production_order_id
 ├── segment_code              (e.g. 'reception' | 'damage_assessment' |
 │                              'disassembly' | 'structural_repair' |
 │                              'body_repair' | 'mechanical_repair' |
 │                              'electrical_repair' | 'paint_preparation' |
 │                              'paint_application' | 'paint_cure' |
 │                              'assembly' | 'calibration_adas' |
 │                              'alignment' | 'quality_control' |
 │                              'detailing' | 'delivery_prep' |
 │                              'customer_handover' | custom)
 ├── label                     (display, configurable per org)
 ├── sequence_no               (default ordering within the case)
 ├── planned_workshop_id       (where it's planned to happen)
 ├── planned_department_id
 ├── required_skills           (array of skill codes — see Resource model)
 ├── required_equipment_kinds  (array — 'paint_booth', 'frame_bench', ...)
 ├── planned_minutes           (from estimate or planner)
 ├── actual_minutes            (computed from time entries)
 ├── remaining_minutes_estimate (recomputed continuously)
 ├── status                    ('not_started' | 'queued' | 'in_progress' |
 │                              'paused' | 'blocked' | 'completed' | 'cancelled')
 ├── blocked_reason            (when status = blocked or paused)
 ├── scheduled_start_at        (computed from forecast)
 ├── scheduled_end_at          (computed from forecast)
 ├── actual_start_at
 ├── actual_end_at
 ├── default_funding_source_id (technician's time inherits this)
 ├── parent_segment_id         (nullable — supports nested segments where useful)
 ├── prerequisite_segment_ids  (array — see WorkSegmentDependency)
 └── audit fields
```

**Why decompose into segments and not just tasks?**

Because departments, skills, and equipment line up at the segment level. "Body repair" needs a body tech and a frame bench. "Paint application" needs a painter, a paint booth, and consumes a paint-booth slot. Different segments hit different resources and different bottlenecks. Tasks live inside segments for finer time tracking but the segment is what we plan against.

### Task

Tasks are the technician's view of "what I'm doing right now." A 4-hour body-repair segment might break into:
- "Pull rear quarter panel" (90 min)
- "Drill spot welds" (45 min)
- "Strip damaged trim" (30 min)
- "Initial body filler" (75 min)

Tasks are optional decomposition. Many segments will not be split into tasks. Tasks exist to support more granular time tracking and to feed the technician queue UI.

### WorkSegmentDependency

```
work_segment_dependencies
 ├── segment_id (the dependent)
 ├── prerequisite_segment_id
 └── dependency_kind ('must_complete_before' | 'must_start_before' | 'soft_preferred')
```

Most dependencies are `must_complete_before` (you can't paint a panel that isn't body-repaired). Some are `soft_preferred` (calibration is best done after alignment but not strictly required). The forecast engine respects these.

---

## Work segment catalog (default, configurable)

Standard collision-repair segments shipped as seed data. Orgs can add/rename/disable:

| Code | Typical department | Typical resources | Notes |
|---|---|---|---|
| `reception` | Reception | Customer service | Customer drop-off, initial intake |
| `pre_wash` | Detailing | Detailer | Some workshops wash before assessment |
| `damage_assessment` | Estimating | Estimator | Drives the estimate; precedes most other segments |
| `disassembly` | Body | Body tech, lift | Often surfaces supplements |
| `supplement_assessment` | Estimating | Estimator | Re-estimate cycle |
| `structural_repair` | Body | Body tech, frame bench | High-value equipment |
| `body_repair` | Body | Body tech | Most common segment |
| `mechanical_repair` | Mechanical | Mechanic, lift | Suspension, cooling, drivetrain |
| `electrical_repair` | Electrical | Electrical tech | Often calibration-adjacent |
| `glass_replacement` | Glass | Glass specialist | Often subcontracted |
| `paint_preparation` | Paint | Body tech or painter, prep bay | Sanding, masking, priming |
| `paint_application` | Paint | Painter, paint booth | The classic bottleneck |
| `paint_cure` | Paint | Paint booth | Time-based, not labor — booth-occupying |
| `paint_polish` | Paint | Painter | Final finish |
| `assembly` | Body | Body tech, lift | Re-fitting components |
| `alignment` | Mechanical | Mechanic, alignment rig | After structural |
| `calibration_adas` | Calibration | Calibration tech, ADAS rig | Increasingly required |
| `quality_control` | QC | QC inspector | Gating; may send back |
| `detailing` | Detailing | Detailer | Cleaning, polishing |
| `delivery_prep` | Reception | Customer service | Paperwork, photos |
| `customer_handover` | Reception | Customer service | Final delivery |
| `internal_transport` | Operations | Driver, transport | Between workshops |
| `external_subcontract` | Various | External vendor | Subcontracted work tracked as black box with start/end |

Customs:
- Frame work splits into `structural_repair` (cutting, replacing) and `alignment` (verifying geometry)
- Paint splits into `paint_preparation`, `paint_application`, `paint_cure`, `paint_polish` — each has different resource profiles
- Cure is a real segment because it occupies the booth without consuming labor

---

## Resource model

Resources are not just employees. Capacity planning must include equipment and facilities because in collision repair these are often more constrained than labor.

### Resource types

```
resources
 ├── id
 ├── organization_id
 ├── workshop_id            (resources are workshop-scoped by default)
 ├── kind                   ('person' | 'equipment' | 'facility')
 ├── name
 ├── status                 ('active' | 'inactive' | 'maintenance')
 ├── calendar_id            (FK — work hours, holidays, planned downtime)
 ├── metadata               (jsonb — kind-specific)
 └── audit fields
```

#### People

Linked to `employees` via `resource_person_links` (1:1). Carry skill tags:

```
resource_skills
 ├── resource_id (must be kind='person')
 ├── skill_code            ('body' | 'paint' | 'mechanical' | 'electrical' |
 │                          'calibration' | 'frame' | 'glass' | 'detailing' |
 │                          'qc' | 'estimating' | custom)
 ├── proficiency           ('apprentice' | 'qualified' | 'expert')
 └── valid_from / valid_until
```

A single person can hold multiple skills. The scheduler matches required skills to available people with the appropriate proficiency.

#### Equipment

Examples and their behavior:

| Equipment kind | Properties | Why it matters |
|---|---|---|
| **Paint booth** | Capacity 1 (or 2 for double booths). Sequential blocking. Has cure time as an occupying-but-not-labor state. | The single most common bottleneck in collision repair. Throughput-limiting. |
| **Frame bench / chassis rig** | Capacity 1. High setup time per car. | Limits structural repair throughput. Workshops with 1 bench can only repair 1 structural at a time. |
| **Calibration rig (ADAS)** | Capacity 1. Specific to make/model in some cases. Setup-heavy. | Increasingly required, often subcontracted. |
| **Alignment rig** | Capacity 1. Quick turnover. | After structural repair. |
| **Lift / bay** | Capacity 1 vehicle. Many workshops have 4-8 bays. | Limits parallel work-in-progress count. |
| **Prep bay** | Capacity 1 vehicle. Multiple usually exist. | Paint prep area, not the booth itself. |

Equipment can be **shared between workshops** in a chain (a calibration rig at HQ serves three locations) — handled via `resources.workshop_id` being nullable plus an explicit "serving workshops" list.

#### Facilities

A facility is a physical area with shared constraints — e.g. "Paint hall" (max 4 cars at once: 1 booth + 2 prep bays + 1 polish station). Modeled separately because it's distinct from any single equipment item.

### Calendar

Every resource has a calendar that defines:
- Default working hours per weekday
- Recognized holidays (Norwegian public holidays seeded; per-org override)
- Planned downtime (vacation for people; maintenance for equipment)
- Special schedules (apprentice working ¾ time)

The calendar is the input to capacity calculation. Vacation is integrated here (an `AbsenceEntry` writes to the calendar).

### ResourceAssignment

Plans a resource onto a work segment for a time block:

```
resource_assignments
 ├── id
 ├── organization_id
 ├── work_segment_id
 ├── resource_id
 ├── role                  ('primary' | 'assist' | 'observer')
 ├── planned_start_at
 ├── planned_end_at
 ├── actual_start_at        (derived from clock events)
 ├── actual_end_at
 ├── status                 ('planned' | 'confirmed' | 'in_progress' |
 │                           'completed' | 'cancelled')
 ├── conflict_resolved_at   (if a conflict was detected, when overridden)
 ├── conflict_override_by_user_id
 └── audit fields
```

A segment can have multiple assignments (e.g. two body techs working in parallel on a large structural repair).

### Multi-resource segments

Some segments need multiple resources at once:

- Body work: 1 body tech + 1 bay
- Paint application: 1 painter + 1 booth + 1 helper (optional)
- Calibration: 1 calibration tech + 1 ADAS rig + 1 bay

Segment definition specifies the resource requirements; the planner must satisfy all.

---

## Workflow engine

Workflow states and transitions are **data, not code.** Every organization can define its own. The system ships with a sensible default that workshops can adapt.

### Default workflow states

States have **categories** that drive behavior:

| State (default) | Category | Notes |
|---|---|---|
| Received | active | Vehicle arrived; no work started |
| Estimated | active | Estimate complete and locked |
| Approved | active | Insurance/customer approval received |
| Awaiting parts | waiting | Blocked on parts arrival |
| Awaiting approval | waiting | Supplement/decision pending |
| Awaiting customer | waiting | Customer decision needed |
| Ready for disassembly | active | Approved and parts available |
| In disassembly | active | Body tech disassembling |
| In structural repair | active | Frame bench in use |
| In body repair | active | Standard body work |
| In paint preparation | active | Prep bay occupied |
| In paint application | active | Paint booth occupied (active labor) |
| In paint cure | waiting | Paint booth occupied (no labor) |
| In assembly | active | Reassembly |
| In calibration | active | ADAS work |
| In quality control | active | QC inspection |
| In rework | active | Failed QC, looped back |
| Ready for delivery | active | All work complete, awaiting handover |
| Delivered | terminal | Vehicle returned to customer |
| Cancelled | terminal | Case cancelled before completion |
| Total loss | terminal | Declared total loss mid-repair |

### State categories

| Category | Behavior |
|---|---|
| **active** | Work being performed. Production clock running. Counts toward throughput. |
| **waiting** | Work is paused by an external dependency. Production clock paused for SLA. Vehicle still occupies yard. |
| **terminal** | Case is closed. No further work expected. Audit-locked. |

The category drives:
- Whether the production-time clock counts for delivery forecasting
- Whether bottleneck detection considers this case "active"
- Whether the dashboard shows the case in the active board or the archive
- Whether a customer status notification is appropriate

### Transitions

```
workflow_transitions
 ├── id
 ├── organization_id
 ├── workflow_definition_id
 ├── from_state_id
 ├── to_state_id
 ├── trigger_kind          ('manual' | 'automatic' | 'event_driven')
 ├── event_type            (when trigger_kind='event_driven', e.g. 'parts.received')
 ├── required_permissions  (array of permission codes)
 ├── required_conditions   (jsonb — e.g. all_segments_complete=true)
 ├── side_effects          (jsonb — emit_notification, generate_invoice_basis, ...)
 └── audit fields
```

Examples:
- "Approved" → "Ready for disassembly" automatic when all parts received
- "In quality control" → "Ready for delivery" manual, requires QC sign-off
- "In quality control" → "In rework" manual, creates internal_rework funding source
- "Awaiting parts" → "Ready for disassembly" event-driven on `parts.requirement.satisfied`

### Audit during workflow evolution

When a workshop changes its workflow definition:
- Existing cases keep the *version* of the workflow they were created against
- New cases use the current version
- Audit reports can still resolve historical state names because the WorkflowDefinition is versioned

---

## Capacity engine

Capacity is the **core operational intelligence** of VerkstedOS. It answers: "Given everything currently in flight, what can we accept, when can we deliver, and where will we hurt?"

### Capacity dimensions

We compute capacity along multiple dimensions, all in **minutes per day**:

| Dimension | Granularity |
|---|---|
| Per resource (person, equipment, facility) | Daily, with hourly precision for the next 7 days |
| Per skill within a department | Daily |
| Per department | Daily |
| Per workshop | Daily |
| Per organization | Daily |

### Daily capacity computation

For each resource:

```
total_minutes = calendar.working_minutes_for_day
   - absences (vacation, sick leave)
   - planned downtime (maintenance)
   - other unplanned absences

committed_minutes = sum of confirmed resource_assignments on that day

available_minutes = total_minutes - committed_minutes
```

Aggregations roll up: department capacity = sum of resource capacities in that department, etc.

### Capacity forecast

The capacity forecast looks forward N days (default 14, configurable per org). For each day in the window:

1. Read all current `ResourceAssignment` records with status in (`planned`, `confirmed`, `in_progress`)
2. Read the active calendar for each resource (including upcoming absences)
3. Compute available minutes per resource
4. Aggregate up the hierarchy
5. Cache as `capacity_forecast_snapshots` for fast dashboard queries

Refresh triggers:
- Any new ResourceAssignment created or modified
- Any AbsenceEntry created or modified
- Any case transferred between workshops
- Nightly full rebuild via Inngest cron

### "What if we accept this work?" simulation

For new cases (or new supplements on existing cases), the planner can simulate impact:

```
simulateCaseAcceptance({
  case_id,
  proposed_segments: [...],
  desired_start_date,
  desired_workshop_id,
}) → {
  feasibility: 'comfortable' | 'tight' | 'overbooked',
  projected_delivery_date: Date,
  projected_delivery_confidence: 0..1,
  impacted_resources: [...],
  impacted_cases: [...],
  bottlenecks_introduced: [...],
}
```

This is the answer to: "If we accept this rear-end collision today, when can we deliver it, and what does it do to the cases already in flight?"

### Overbooking policy

Default: warn but allow. Overbooking is sometimes the right call (technicians work overtime, weekend shifts, expedited paint). The system surfaces overbooking but doesn't prevent it.

Policy is configurable per org:
- `strict` — block planning that exceeds capacity
- `warn` — warn but allow (default)
- `silent` — allow without warning (rarely used)

---

## Delivery forecasting

The delivery forecast is **continuously recomputed**. Every event that affects the case updates it.

### Inputs

| Input | Source |
|---|---|
| Remaining work hours by segment | Open segments, `remaining_minutes_estimate` |
| Department capacity over forecast window | Capacity engine |
| Parts arrival dates | Part requirement status + supplier ETAs |
| Open waiting states | Workflow state + `HoldRecord.expected_resolution_at` |
| Historical variance | Per-segment-code historical actual / planned ratios |
| Current workshop load | All in-flight cases at this workshop |

### Output

```
delivery_forecasts
 ├── case_id
 ├── computed_at
 ├── forecast_date          (the predicted delivery date)
 ├── confidence_score       (0..1)
 ├── delay_risk             ('low' | 'medium' | 'high')
 ├── primary_blocker        (text — what's most likely to cause delay)
 ├── critical_path_segments (array of segment_ids on the critical path)
 ├── components             (jsonb — breakdown of where the days go)
 └── inputs_snapshot        (jsonb — what the forecast was based on)
```

### Confidence model

Confidence is shaped by:

- **Open waiting states drop confidence sharply.** A case waiting for parts with no supplier ETA gets `confidence < 0.4`.
- **Historical variance.** If similar segments have 30% variance historically, the forecast confidence shrinks.
- **Cases late on prior forecasts.** A case that's already missed two prior forecasts gets a confidence penalty.
- **Critical-path segments on overbooked resources.** A paint segment due in week 1 on an already-overbooked booth = low confidence.

### Forecast history

Every recomputation creates a new row in `delivery_forecast_history` (event-audited, append-only). This gives:
- A view of how the forecast evolved over time
- Feedback into the model: how often were our forecasts right?
- Customer-trust feedback: "We promised week 12; delivered week 14; here's why."

### Customer-facing delivery date vs internal forecast

These are intentionally different:
- **Promised date** = what the customer was told (committed via case field)
- **Forecast date** = the system's current best estimate
- **Buffer** = the difference

When forecast drifts past promised, the system raises a `delivery.commitment_at_risk` event. Notification engine optionally informs the customer.

---

## Bottleneck detection

Runs continuously. Outputs are surfaced on the workshop dashboard and emit events that drive proactive notifications.

### Categories of bottleneck

| Category | Detected by |
|---|---|
| **Overloaded resource** | Capacity forecast shows resource at >100% utilization across forecast window |
| **Overloaded department** | Aggregate of overloaded resources of one skill type |
| **Equipment bottleneck** | High-value equipment (paint booth, frame bench) booked solid for >5 days |
| **Missing parts** | Cases with `awaiting parts` status > 3 days |
| **Pending approval** | Cases with `awaiting approval` status > 2 days |
| **Pending customer** | Cases with `awaiting customer` status > 5 days |
| **Stuck segment** | Segment in `in_progress` for >2× planned time without time entries in 24h |
| **Forecast drift** | Forecast date has moved later by >3 days compared to forecast 7 days ago |
| **Approaching commitment** | Forecast date within 3 days of promised date with confidence <0.6 |

### Output

```
bottleneck_indicators
 ├── id
 ├── organization_id
 ├── workshop_id            (nullable — some are org-level)
 ├── category               (one of the above)
 ├── severity               ('info' | 'warning' | 'critical')
 ├── related_case_ids       (cases affected)
 ├── related_resource_ids   (resources causing the issue)
 ├── related_segment_ids    (segments affected)
 ├── first_detected_at
 ├── last_seen_at
 ├── resolved_at            (nullable)
 ├── resolution_reason
 ├── message                (human-readable summary)
 └── recommended_actions    (jsonb — suggested next steps)
```

Indicators are deduplicated: the same paint-booth overload doesn't generate a new indicator every 5 minutes, it updates `last_seen_at`.

### Resolution

Indicators auto-resolve when the underlying condition clears (parts arrived, capacity rebalanced, segment completed). A user can also manually dismiss an indicator with a reason.

---

## Production queue: "what should I do next?"

The most common workshop-floor question. Drives the technician mobile UI.

For a logged-in technician, the queue shows:

1. **Currently active work** — any segment they're clocked into right now (always top)
2. **Ready to start** — segments assigned to them whose prerequisites are complete and resources are available
3. **Queued for them** — segments planned to them in the future, in priority order
4. **Available unassigned** — segments matching their skills with no current assignment (workshop preference: opt-in)

### Priority logic

Within "ready to start," priorities are computed:

```
priority = weighted_sum(
   days_until_promised_delivery        (closer = higher),
   forecast_confidence_inverse         (lower confidence = higher),
   case_priority_flag                  (insurance-driven SLA cases get boost),
   waiting_blocker_resolved_recently   (just-unblocked cases bubble up),
   prerequisite_segments_just_completed (chain continuity)
)
```

The priority isn't shown to the technician as a number. It just orders the list. The UI shows context: "Due Friday, customer was promised tomorrow, paint just unblocked."

### Anti-thrashing

We don't want technicians constantly switching cases. The queue applies:
- A new case bumped to the top doesn't auto-interrupt the current one
- Switching cases requires a clock-out + clock-in (creating a small friction that discourages thrashing)
- Manager override is always available

---

## Multi-location operations

Multi-location is **not an edge case.** It's a primary use case. The case stays single across all workshop assignments and transfers.

### Scenarios (recapping for context)

| Scenario | Pattern |
|---|---|
| Body at A, paint at B, return to A | Three CaseAssignments, two CaseTransfers |
| Entire case transferred to B | One end-of-A assignment, one new B assignment, one transfer |
| Calibration at a specialist site | A → specialist → A; specialist's WorkSegment carries their workshop_id |
| Workshop A's overflow temporarily handled by B | Same pattern |

### CaseAssignment lifecycle

```
case_assignments
 ├── id
 ├── organization_id
 ├── case_id
 ├── workshop_id
 ├── department_id           (nullable — workshop-level when null)
 ├── role                    ('body' | 'paint' | 'mechanical' | 'calibration' |
 │                            'assembly' | 'qc' | 'storage' | 'in_transit' |
 │                            'customer_handover' | custom)
 ├── sequence_no             (order across the case lifetime)
 ├── started_at
 ├── ended_at                (nullable while active)
 ├── ended_reason            (when ended)
 ├── notes
 └── audit fields
```

At any moment, a case has **at most one active CaseAssignment** (`ended_at IS NULL`). The current workshop is denormalized on `cases.current_workshop_id` for fast queries.

### TransferEvent

```
case_transfers
 ├── id
 ├── organization_id
 ├── case_id
 ├── from_workshop_id
 ├── to_workshop_id
 ├── from_department_id      (nullable — workshop-level transfer)
 ├── to_department_id        (nullable)
 ├── reason                  (text)
 ├── transport_mode          ('drive' | 'tow' | 'transport_truck' | 'customer_drives')
 ├── transport_provider      (text, optional)
 ├── initiated_by_user_id
 ├── initiated_at
 ├── expected_departure_at
 ├── expected_arrival_at
 ├── departed_at             (nullable)
 ├── arrived_at              (nullable)
 ├── confirmed_by_user_id    (who confirmed receipt at destination)
 ├── notes
 └── audit fields
```

### Transfer workflow

```
1. User initiates transfer in case detail UI
2. System validates:
   - Target workshop accepts this kind of work
   - Capacity check at target (warning if tight)
   - No incomplete segments blocked at current workshop
3. Create CaseTransfer record, status = 'planned'
4. End current CaseAssignment (set ended_at)
5. Create new CaseAssignment with role = 'in_transit', workshop_id = target
   (some workshops prefer to keep the case 'at' the source until physical arrival;
    configurable per org)
6. Production state may transition to a "in_transit" waiting state
7. Document links updated — documents follow case_id, not workshop_id
8. Notifications fire: receiving workshop alerted, customer optionally informed
9. On arrival, user at receiving workshop confirms
10. CaseAssignment role updates to actual work role
11. Production state transitions back to active
```

### Cross-location planning

The planner UI can show:
- "Capacity at workshop B for paint work in the next 7 days" when planning a paint segment
- "What we'd send to workshop B" — pending paint work that could be transferred to relieve A's overloaded booth
- Chain-wide bottleneck view (executive dashboard)

### Cost allocation across workshops

Each WorkSegment is tagged with the workshop where it was performed. Each TimeEntry carries workshop_id. This enables:
- Inter-workshop billing (chain accounting)
- Per-workshop profitability (who actually did the work)
- Transfer overhead tracking (how much time is spent on internal transport)

---

## Yard and physical location

Where the vehicle physically is matters as much as where it is in the workflow.

### Two axes

Every vehicle has two locations at any time:

| Axis | Meaning | Source |
|---|---|---|
| **Workflow state** | Where in the production process | `cases.status` + `production_state_history` |
| **Physical location** | Where the vehicle is parked / being worked on | `vehicle_placements` |

These move semi-independently. A car can be in "Paint application" state but physically in the paint booth, or in "Awaiting parts" state but physically in long-term storage.

### VehiclePlacement

```
vehicle_placements
 ├── id
 ├── organization_id
 ├── case_id
 ├── workshop_id
 ├── yard_location_id        (FK yard_locations — specific spot)
 ├── placed_at
 ├── released_at             (nullable while occupying)
 ├── placed_by_user_id
 ├── released_by_user_id
 ├── notes
 └── audit fields
```

A case has exactly one active placement at any moment (across all workshops). When the case moves between bays, a new placement starts (and the prior one ends).

### VehicleMovement

```
vehicle_movements
 ├── id
 ├── organization_id
 ├── case_id
 ├── from_yard_location_id
 ├── to_yard_location_id
 ├── moved_at
 ├── moved_by_user_id
 ├── reason
 ├── correlation_id          (links to a transfer if cross-workshop)
 └── audit fields
```

Append-only. The full physical movement history of every vehicle is reconstructable.

### "Where is the car?"

This is question #1 from the eleven operational questions. The system answers via a single query:

```
SELECT
  c.case_number,
  c.current_workshop_id,
  vp.yard_location_id,
  yl.label as yard_label,
  c.status,
  ca.role as current_assignment_role
FROM cases c
LEFT JOIN vehicle_placements vp ON vp.case_id = c.id AND vp.released_at IS NULL
LEFT JOIN yard_locations yl ON yl.id = vp.yard_location_id
LEFT JOIN case_assignments ca ON ca.case_id = c.id AND ca.ended_at IS NULL
WHERE c.id = $1
```

Fast. Always available. Surfaced on every case page header.

---

## Waiting states (the pause/resume model)

Waiting states are first-class. They are not just metadata on the case — they are explicit pause events with expected resolution dates and resolution criteria.

### HoldRecord

```
production_holds
 ├── id
 ├── organization_id
 ├── case_id
 ├── hold_kind               ('parts' | 'approval_insurance' | 'approval_customer' |
 │                            'transport' | 'subcontractor' | 'documentation' |
 │                            'equipment_offline' | 'paint_cure' | 'other')
 ├── reason                  (text)
 ├── created_at
 ├── created_by_user_id
 ├── expected_resolution_at  (nullable but encouraged)
 ├── resolved_at             (nullable while active)
 ├── resolved_by_user_id
 ├── resolution_note
 ├── related_part_requirement_ids (when hold_kind='parts')
 ├── related_claim_id        (when hold_kind='approval_insurance')
 └── audit fields
```

### Behavior

- When a hold is created, the workflow state typically transitions to the matching waiting state
- The production-time clock pauses for SLA / forecast purposes
- The vehicle remains in its current placement (yards still occupied)
- A notification fires when a hold is created or resolved
- Open holds drive bottleneck detection (if many cases hold on parts, parts is the systemic bottleneck)

### Multiple concurrent holds

A case can have multiple active holds (waiting on parts AND waiting on insurance). The forecast considers the latest expected resolution among all open holds.

---

## Supplements and re-estimates

The single most common reason for delays. Handled as first-class events.

### Trigger

During disassembly or repair, additional damage is discovered. A supplement workflow starts:

```
1. Technician (or estimator) marks the case as "supplement needed"
2. Production state typically transitions to "Awaiting approval" (insurance) or "Awaiting customer"
3. A HoldRecord is created (kind='approval_insurance' or 'approval_customer')
4. A new EstimateImport is created (kind='supplement', supersedes_id = current estimate)
5. Estimator adds the new operations, parts, labor lines
6. Estimate is sent to insurer (or customer)
7. When approved:
   - The supplement EstimateImport transitions to 'locked'
   - New WorkSegments are created from the supplement
   - PartRequirements are created
   - HoldRecord is resolved
   - Production state transitions out of the waiting state
8. If declined:
   - The supplement is marked declined
   - Optionally, the work is moved to a new funding source (private pay)
   - Or the case continues without the supplement work
```

### Segments and supplements

Supplements ADD segments; they don't modify existing ones. This preserves audit clarity: "These segments came from the original estimate; these came from supplement 1; these from supplement 2."

### Forecast impact

A supplement that adds 8 hours of body work and 2 hours of paint work updates the forecast immediately, *before* approval. The forecast carries a "pending supplement" component clearly visible.

---

## Quality control gates and rework loops

QC isn't just a step — it's a gate that can send work backwards.

### QC states

```
In quality control → (pass)    → Ready for delivery
                  → (fail)    → In rework
```

### Rework loops

When QC fails:

1. QC inspector creates a `QualityDeviation` record (already in quality module)
2. A new WorkSegment is created with `segment_code='rework'` and `references_segment_id` pointing to the failed segment
3. The case enters "In rework" state
4. A funding source of kind `internal_rework` is auto-created (workshop absorbs)
5. The technician who performed the original work is preferred (but not required) for the rework
6. After rework, the case returns to "In quality control"
7. If multiple QC failures occur on the same case, severity escalates (managerial review)

### Rework KPI

Per the Single Source of Truth rule, "rework rate" has one canonical calculation:

```
rework_rate(workshop, period) =
   sum(rework segment minutes in period) / sum(all production minutes in period)
```

Tracked at: technician, department, workshop, organization level. Drives quality dashboards and is part of the executive scorecard.

---

## Sequence diagrams (typical repair flows)

### Flow 1 — Standard insurance repair (single workshop, no surprises)

```
Customer arrives ─► Reception
                  │
                  ▼
              Damage assessment ─► Estimator imports DBS estimate
                  │                  ↓
                  │                  Locks estimate (v1)
                  │                  Creates ProductionOrder
                  │                  Creates WorkSegments per estimate
                  │                  Creates PartRequirements
                  │                  CaseFundingSource: insurance (Fremtind), deductible 6,000
                  │
                  ▼
              Parts ordered ─► Purchase orders sent ─► (waiting state if not all available)
                  │
                  ▼
              All parts received ─► Hold resolved ─► State: "Ready for disassembly"
                  │
                  ▼
              Disassembly segment starts ─► Body tech clocks in ─► WorkSegment in_progress
                  │
                  ▼
              No supplements discovered ─► Disassembly completes ─► State: "In body repair"
                  │
                  ▼
              Body repair segment → completes
              Paint preparation → completes (prep bay)
              Paint application → painter clocks in, booth occupied
              Paint cure → booth occupied, no labor (state: "In paint cure")
              Paint polish → completes
              Assembly → completes
              Quality control → passes
                  │
                  ▼
              State: "Ready for delivery" ─► Customer notified by SMS
                  │
                  ▼
              Customer arrives ─► Handover ─► State: "Delivered"
                  │
                  ▼
              InvoiceBasis generated per funding source:
                IB-1 → Fremtind (insurance lines minus deductible)
                IB-2 → Customer (deductible 6,000)
                  │
                  ▼
              Accounting export → Tripletex
```

### Flow 2 — Multi-location (body at A, paint at B, return to A)

```
Workshop A: Case opened, estimated, parts ordered
            Body repair completes
            ─► State: "Ready for paint"
            ─► User initiates transfer to Workshop B for paint
            ─► CaseTransfer created
            ─► CaseAssignment at A ends
            ─► CaseAssignment at B created (role='paint')
            ─► Vehicle physically transported (tow truck)
            ─► Receiving user at B confirms arrival
            ─► State: "In paint preparation"

Workshop B: Paint prep → paint application → cure → polish
            ─► State: "Ready for assembly"
            ─► User initiates transfer back to A
            ─► CaseTransfer (B → A)
            ─► CaseAssignment at B ends (role='paint')
            ─► CaseAssignment at A created (role='assembly')
            ─► Vehicle returns to A

Workshop A: Assembly → QC → delivery prep → handover

InvoiceBasis lines:
  Body work hours tagged workshop=A
  Paint work hours tagged workshop=B
  Assembly hours tagged workshop=A
  Internal cost allocation between A and B handled by accounting policies
```

### Flow 3 — Supplement during disassembly

```
Disassembly in progress ─► Body tech discovers additional rear quarter damage
                          │
                          ▼
                       Technician flags "supplement needed"
                          │
                          ▼
                       Estimator alerted, walks to vehicle
                          │
                          ▼
                       Estimator creates supplement: new EstimateImport (v2, supersedes v1)
                          │
                          ▼
                       Adds 4 hours body labor, 2 panels, 1 hour paint to supplement
                          │
                          ▼
                       HoldRecord created (kind='approval_insurance')
                       Production state → "Awaiting approval"
                       Disassembly segment paused
                       Forecast updates (pending supplement +6 hours)
                          │
                          ▼
                       Supplement submitted to Fremtind via DBS
                          │
                          ▼   (3 days later)
                       Fremtind approves
                          │
                          ▼
                       Supplement EstimateImport → locked
                       New WorkSegments created from supplement (tagged funding_source=insurance)
                       New PartRequirements created
                       HoldRecord resolved
                       Production state → "Ready for disassembly" (resumes)
                          │
                          ▼
                       Parts for supplement ordered
                       Disassembly resumes when parts arrive
```

### Flow 4 — Parts delay

```
Case in "Awaiting parts" state
HoldRecord(kind='parts', expected_resolution_at=2026-06-15)
Forecast shows: delivery delayed to 2026-06-22, confidence 0.65
                          │
                          ▼
                       Supplier emails: backorder, ETA now 2026-06-25
                          │
                          ▼
                       Parts coordinator updates expected ETA on the part requirement
                       HoldRecord.expected_resolution_at updated
                       Forecast recomputes: delivery now 2026-07-02, confidence 0.55
                          │
                          ▼
                       Forecast crosses promised delivery threshold
                          │
                          ▼
                       Event: delivery.commitment_at_risk
                       Notification engine queues customer SMS
                       Production manager alerted
                          │
                          ▼
                       Parts coordinator searches alternate suppliers
                       Substitute part identified, ordered, expedited
                       Updated ETA: 2026-06-18
                       Forecast recomputes: delivery 2026-06-25, confidence 0.7
                          │
                          ▼
                       Substitute parts arrive 2026-06-18
                       HoldRecord resolved
                       Disassembly resumes
```

### Flow 5 — Quality control fails, rework loop

```
Assembly complete ─► State: "In quality control"
                   │
                   ▼
                QC inspector checks vehicle
                Discovers paint defect on rear quarter
                   │
                   ▼
                Creates QualityDeviation(severity='medium', segment_id=paint_application)
                Creates new WorkSegment(code='rework', references_segment_id=paint_application)
                Auto-creates CaseFundingSource(kind='internal_rework', references_case_id=current)
                Production state → "In rework"
                   │
                   ▼
                Paint tech rework: minor sand and re-spray of affected area
                Rework segment tagged to internal_rework funding source
                Hours logged against internal_rework (workshop absorbs cost)
                   │
                   ▼
                Rework segment complete
                Production state → "In quality control" (re-inspection)
                   │
                   ▼
                QC inspector approves
                State → "Ready for delivery"
                   │
                   ▼
                Rework rate KPI updated for this workshop / technician
```

### Flow 6 — Total loss declared mid-repair

```
Case mid-repair, disassembly partially complete
                   │
                   ▼
                Hidden frame damage discovered during structural inspection
                Estimator's revised estimate: 380,000 NOK on a vehicle valued at 200,000
                   │
                   ▼
                Insurance declares total loss
                   │
                   ▼
                User in production manager role marks case "Total loss"
                   │
                   ▼
                System validation:
                   - All open WorkSegments → status='cancelled'
                   - All open PartRequirements → status='cancelled'
                       Already-ordered parts: keep on case for return processing
                       Already-received parts: keep, generate returns to suppliers
                   - All open Holds resolved with reason='total_loss'
                   - Production state → "Total loss" (terminal)
                   - Vehicle physical location remains until customer arranges removal
                   - Documents and audit preserved
                   │
                   ▼
                Funding source updated:
                   - Insurance now pays for diagnostic and partial work only
                   - InvoiceBasis generated for work performed
                   - Customer ownership / disposal handled outside VerkstedOS
                   │
                   ▼
                Vehicle eventually removed (state remains 'Total loss')
                Case archived but readable forever
```

---

## Risks and edge cases

### Operational risks

| Risk | Mitigation |
|---|---|
| **Forecast accuracy is terrible at launch** | Confidence intervals expose this honestly; historical-variance learning kicks in by month 3 |
| **Workshops over-trust the forecast** | UI consistently shows confidence; users learn to read both number and confidence |
| **Workshops ignore the forecast** | Notifications proactively raise commitment-at-risk; manager dashboard surfaces drift |
| **Paint booth scheduling complex** | Dedicated paint booth view; future enhancement: cure-time-aware scheduling, multi-car loading where possible |
| **Cure time variability (humidity, paint type)** | Per-paint-type cure profiles configurable; manual override available |
| **Subcontractor opacity** | External subcontract segments are tracked as "black box" with manual start/end; we don't pretend to know their internals |
| **Technicians thrashing between cases** | Clock-in/clock-out friction; one active task at a time; manager override |

### Edge cases (the system must handle gracefully)

| Edge case | Behavior |
|---|---|
| **Total loss mid-repair** | See Flow 6 |
| **Customer cancellation mid-repair** | Similar to total loss but funding sources differ; partial invoice; vehicle returned |
| **Insurance withdraws approval after work begun** | Hold record (kind='approval_insurance'), production paused; if not resolved, conversion to private pay or cancellation |
| **Vehicle theft from yard** | Marked stolen; case enters a special terminal state; police report linked; insurance handles |
| **Vehicle damage during repair (slip damage)** | New funding source (internal_rework or goodwill); additional segments added; full audit |
| **Multiple concurrent cases for same vehicle** | Allowed (rare). Each case has its own ProductionOrder. Vehicle has only one active placement. |
| **Workshop closure (fire, flood)** | Emergency: all in-flight cases marked for transfer; Dev Control Plane "Lock workshop" + bulk-transfer tool |
| **Equipment breakdown (paint booth offline)** | Calendar override marks downtime; capacity engine reflects; affected segments need re-planning; cross-workshop opportunity surfaced |
| **Employee unavailable (sickness)** | AbsenceEntry created; affected ResourceAssignments highlighted; reassignment suggested |
| **Parts ordered for wrong vehicle** | Part requirement marked wrong-part; new order placed; old parts initiate return process |
| **Cure time spans weekend** | Calendar handles non-working days; cure-only segments not blocked by labor calendar |
| **Customer wants vehicle back early (rental running out)** | "Partial delivery" supported via funding source split; remaining work continues later in a follow-up case linked via `references_case_id` |
| **VAT change mid-case** | Money columns carry currency; VAT applied at invoice time; rate stored on each invoice basis line |
| **Cross-workshop case where workshop A is part of one org and workshop B is part of another** | Not supported in MVP. Cases are org-scoped. Two-org collaboration requires manual handoff (close case at A, open new case at B). |
| **Case stuck in 'in_transit'** | Bottleneck detector raises after 24h; Dev Control Plane "stuck transfer repair" tool |
| **Vehicle moved between bays without recorded movement** | Mobile yard UI allows technicians to scan QR codes on yard spots; missed movements identified via inventory checks |
| **Forecast disagrees with planner's manual scheduling** | Planner's manual assignment overrides forecast; system warns if manual schedule violates capacity |
| **Concurrent edits to the same case** | Optimistic locking via row version; conflict surfaced; user chooses resolution |

---

## Three Surfaces

### User Surface

**Production manager / workshop owner:**
- Workshop production board (all cases, color-coded by state and risk)
- Capacity calendar (next 14 days, per department)
- Planning calendar (drag-and-drop ResourceAssignments)
- Case detail (full timeline, all segments, all holds, forecast)
- "What if we accept this work?" simulation
- Bottleneck dashboard

**Technician (mobile-first):**
- "What's next for me?" queue
- Clock in/out on a segment
- Mark segment complete / paused / blocked
- Add photos
- Flag supplement needed
- See current case at a glance

**Estimator:**
- Import DBS estimate
- Allocate lines to funding sources
- Create supplements
- Lock estimates

**Routes:** `/dashboard`, `/cases/:id`, `/planning`, `/capacity`, `/bottlenecks`, `/queue`, `/cases/:id/segments/:sid`

**Permissions:** `production:view`, `production:plan`, `production:transition`, `time:self`, `time:other`, `estimate:edit`, `estimate:lock`

### Admin Surface

- Workflow definition editor (states, transitions, side effects)
- Work segment catalog management (add/rename/disable segments per org)
- Resource configuration (people, equipment, facilities)
- Skill catalog management
- Calendar templates (default work hours, public holidays)
- Department configuration
- Overbooking policy
- Forecast window length
- Bottleneck thresholds
- Production-related notification rules

**Routes:** `/admin/workflow`, `/admin/segments`, `/admin/resources`, `/admin/skills`, `/admin/calendars`, `/admin/departments`, `/admin/production-policy`

**Permissions:** `admin:config`

### Dev Surface

- Search any ProductionOrder, WorkSegment, ResourceAssignment, CaseTransfer across all orgs
- Inspect full segment lifecycle (planned → assigned → started → paused → completed)
- View production state history for any case
- Replay production events for a case
- Recompute delivery forecasts (per case, per workshop, all)
- Rebuild capacity_forecast_snapshots
- Inspect stuck transfers / segments
- Repair tool: force-resolve stuck CaseTransfer
- Repair tool: rebuild ProductionStateHistory from event log
- Repair tool: recompute remaining_minutes_estimate on all open segments
- View bottleneck history (resolved indicators)
- Monitor: capacity engine job health, forecast job health, projection lag
- View AbsenceEntry impact on resource availability
- Inspect ResourceAssignment conflicts across the org

**Routes:** `/dev/production/orders`, `/dev/production/segments`, `/dev/production/transfers`, `/dev/production/forecasts`, `/dev/production/bottlenecks`, `/dev/production/repair`

**Permissions:** `platform:org:view`, `platform:data:repair`, `platform:event:replay`

---

## Implementation notes for the production module

### Calculation services (Single Source of Truth)

```
src/modules/production/application/calculations/
   ├── remaining-work.ts          — open segments' remaining minutes
   ├── capacity.ts                — daily/hourly resource capacity
   ├── capacity-forecast.ts       — forward N-day projection
   ├── delivery-forecast.ts       — case-level forecast date + confidence
   ├── bottleneck-detection.ts    — runs continuously, emits indicators
   ├── critical-path.ts           — segment-level critical path computation
   ├── rework-rate.ts             — quality KPI
   └── production-priority.ts     — queue ordering for technicians
```

These are the *only* places these calculations live. Every dashboard, report, API endpoint, and Dev Control Plane tool calls them.

### Events emitted

```
production.order.created
production.order.transferred
production.state.transitioned
production.state.entered_waiting
production.state.exited_waiting
production.segment.created
production.segment.assigned
production.segment.started
production.segment.paused
production.segment.blocked
production.segment.completed
production.segment.cancelled
production.hold.created
production.hold.resolved
production.transfer.initiated
production.transfer.departed
production.transfer.arrived
production.transfer.cancelled
production.forecast.updated
production.forecast.commitment_at_risk
production.bottleneck.detected
production.bottleneck.resolved
production.capacity.overbooked
production.rework.started
production.rework.completed
production.supplement.requested
production.supplement.approved
production.supplement.declined
```

### Projections rebuilt from events

- `capacity_forecast_snapshots` — by day, by resource/dept/workshop
- `delivery_forecast_history` — per case, time-series
- `production_state_history` — per case, append-only
- `bottleneck_indicators` — current + resolved history

All rebuilt by repair tools if drift is detected.

### Performance considerations

- Capacity forecast computation is expensive. Caching is essential. Snapshot tables refreshed by Inngest on events + nightly full rebuild.
- Delivery forecast recomputed on every relevant event but throttled (max once per 30s per case).
- Bottleneck detection runs every 5 minutes via Inngest cron. Per-event detection only for high-impact events (parts received, transfer arrived, supplement approved).
- Production board queries use materialized views for "active cases at this workshop with current state and forecast."
- Realtime channel `workshop:<id>:production` broadcasts production-state changes for live dashboards.

---

## Summary

The production domain in VerkstedOS is built on these principles:

1. **The Case is the operational root.** It moves across workshops; child records preserve workshop_id for audit.
2. **Work is decomposed into segments.** Segments map to skills, equipment, and bottlenecks — they are the planning unit.
3. **Resources are people, equipment, AND facilities.** Capacity planning considers all three.
4. **Workflow is configurable data.** Default workflow ships; orgs customize without code changes.
5. **Capacity and delivery are continuously forecast.** Schedules are computed, not stored.
6. **Bottlenecks are detected automatically.** The system surfaces problems, not just data.
7. **Waiting states are first-class.** Holds with expected resolution dates power forecasting.
8. **Multi-location is primary.** Transfer events preserve a single case timeline across workshops.
9. **Supplements are normal.** The system handles mid-flow scope changes without breaking the forecast.
10. **Rework loops are visible.** Quality control can send work back; the system tracks the cost.
11. **Calculations have one authoritative owner each.** Single Source of Truth applies fully.
12. **Every workshop user can answer "where is my car right now?"** at all times, from any device.

These principles, more than any particular data model choice, are what separate VerkstedOS from generic ERP and from manufacturing systems. The data model serves these principles, not the other way around.
