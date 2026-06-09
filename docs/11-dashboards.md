# 11 — Workshop Operations Dashboards

This document defines the six role-specific dashboards in VerkstedOS. Each is designed for a real persona doing real work, on the device they actually use, with the information they actually need.

These are not generic admin dashboards. They are operational cockpits, each tuned to a specific workshop role.

> **Read alongside [12-ux-architecture.md](./12-ux-architecture.md) and [13-production-planning.md](./13-production-planning.md).** This document defines the *information* each role needs. Doc 12 defines the *experience* that delivers it. Doc 13 is the authoritative specification for the **Production Planner** (Production Manager's primary operational surface). In the product, these six "dashboards" are not six destinations you navigate between — they are role-adaptive renderings of a single **Operations Center** plus the **Case Workspace** where most work happens, with the **Production Planner** as the third primary surface for planning-heavy roles. Treat the per-role content below as the information inventory; treat doc 12 as how that information is surfaced and navigated, and doc 13 as binding for anything Planner-related (doc 13 § 20, directive 2026-06-09).

---

## Design principles

Before the role-specific designs, the principles that apply to all six.

### 1. Role determines the dashboard, not the user's job title

A user with the Painter role gets the Painter dashboard. A user with both Painter and Body Technician roles gets a hybrid view (the system computes this from active role assignments). The dashboard is computed from RBAC, not chosen from a menu.

### 2. Device-first per role

| Role | Primary device | Why |
|---|---|---|
| Production Manager | Desktop (24" or larger) | Many cases, multi-pane, needs density |
| Painter | Mobile phone | In the booth, gloves, wet hands |
| Body Technician | Mobile phone | At the car, gloves, dirty hands |
| Estimator | Desktop + mobile tablet | DBS on desktop, walkaround on tablet |
| Workshop Owner | Desktop primary, mobile secondary | Office work + occasional floor checks |
| Executive | Desktop primary | Strategic view, large screens, comparisons |

Every dashboard works on every device. But the primary device is what the design optimizes for. Mobile dashboards minimize chrome and maximize touch targets. Desktop dashboards maximize density.

### 3. Real-time where it matters

| What updates in real-time (via Supabase Realtime) |
|---|
| Production board (state transitions, new cases, transfers) |
| Yard map (vehicle placements) |
| Notifications |
| The currently-active task on Painter / Body Technician views |
| Bottleneck indicators |
| Forecast changes that cross commitment thresholds |

What does NOT update in real-time:
- KPI snapshots (refresh nightly, displayed timestamp)
- Historical trends
- Financial summaries (lag is fine, often preferred)

### 4. Every dashboard answers a small set of specific questions

A dashboard exists to answer questions. Each role's dashboard is built around the questions that role asks most often. If a widget doesn't help answer one of those questions, it's removed.

### 5. Drill-down, never sprawl

The dashboard surface stays focused. Everything is one click away — case detail, segment detail, employee detail, financial detail — but none of it is on the dashboard itself.

### 6. Visual hierarchy: red/yellow/green is the universal language

Every numeric or status indicator in the system uses the same three-color convention. Workshop owners can scan any dashboard and immediately know what needs attention.

### 7. Performance is part of the UX

Dashboards load in under 1 second on production hardware. Slow dashboards become unused dashboards. We pre-compute, cache aggressively, and stream incrementally.

### 8. Permissions hide widgets entirely, never just disable them

If a user can't see the financial widget, the widget isn't present on their screen — not greyed out. Reduces clutter, reduces confusion, reduces curiosity-driven permission escalation requests.

---

## Production Manager dashboard

### Persona

**Mette**, 42, production manager at a 12-employee workshop. Manages 25-35 active cases. Walks the floor 3-4 times a day. Spends most of her time at a desktop in an office overlooking the workshop, with a 27" monitor.

### Questions she asks every day

1. What needs my attention right now?
2. Are we on track to deliver this week's commitments?
3. Where are the bottlenecks?
4. Is the team busy or idle?
5. What new work can we accept?
6. What supplements need approval?
7. Is anything stuck?

### Layout (desktop, 27", three columns)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ Workshop dashboard — Carlsen Bilskade, Oslo            ⚙ Settings  🔔 12 new │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│ ┌─── COLUMN 1: WHAT NEEDS ATTENTION ──────┐ ┌─── COLUMN 2: PRODUCTION BOARD ──┐
│ │                                          │ │                                 │
│ │ 🔴 Critical (3)                          │ │ Today | Tomorrow | This week    │
│ │  • Case 4711 — paint booth blocked       │ │                                 │
│ │  • Case 4682 — promise date crossed      │ │  Body repair        ████░░ 6/8  │
│ │  • Case 4720 — total loss pending        │ │  Paint preparation  ███░░░ 3/6  │
│ │                                          │ │  Paint application  █████░ 4/5  │
│ │ 🟡 Warning (8)                           │ │  Paint cure         ██░░░░ 2/6  │
│ │  • 4 cases awaiting parts (avg 3 days)   │ │  Assembly           ████░░ 4/8  │
│ │  • 2 supplements awaiting approval       │ │  QC                 █░░░░░ 1/4  │
│ │  • Paint booth booked solid through Fri  │ │  Awaiting parts     ███████ 7   │
│ │  • 2 supplements awaiting approval       │ │  Awaiting approval  ██ 2        │
│ │                                          │ │                                 │
│ │ 🟢 OK to proceed (24 cases on track)     │ │  ┌─── Deliveries ───┐           │
│ │                                          │ │  │ Today      3     │           │
│ └──────────────────────────────────────────┘ │  │ Tomorrow   4     │           │
│                                              │  │ This week  17    │           │
│ ┌─── CAPACITY ── 7-day forecast ──────────┐ │  │ At risk    2  🔴 │           │
│ │                                          │ │  └──────────────────┘           │
│ │  Mon  Tue  Wed  Thu  Fri  Sat  Sun       │ └─────────────────────────────────┘
│ │  ░░░  ▓▓▓  ███  ███  ███  ░░░  ░░░ Body  │
│ │  ▓▓▓  ███  ███  ███  ███  ░░░  ░░░ Paint │ ┌─── COLUMN 3: ACTIONS ──────────┐
│ │  ▓▓▓  ▓▓▓  ▓▓▓  ███  ███  ░░░  ░░░ Mech  │ │                                 │
│ │  ░░░  ▓▓▓  ▓▓▓  ▓▓▓  ▓▓▓  ░░░  ░░░ QC    │ │ ⚡ Quick actions                │
│ │                                          │ │  [+ New case]                   │
│ │  Paint booth: 92% utilized this week     │ │  [+ Receive vehicle]            │
│ │  Frame bench: 67%                        │ │  [+ Plan case]                  │
│ │  Calibration rig: 45%                    │ │  [→ Transfer case]              │
│ │                                          │ │  [! Approve supplement]         │
│ │  [Simulate new case acceptance]          │ │  [📋 Today's plan]              │
│ │                                          │ │                                 │
│ └──────────────────────────────────────────┘ │ 📊 Live numbers                 │
│                                              │  Active cases:        32        │
│ ┌─── YARD ────────────────────────────────┐ │  In progress now:     18        │
│ │                                          │ │  Available techs:     7/9       │
│ │  [yard map showing cars at workshop,     │ │  Booth status:        OCCUPIED  │
│ │   color-coded by state]                  │ │   ↳ cure ends 14:30             │
│ │                                          │ │  Frame bench:         FREE      │
│ │  Outdoor lot: 12/20 spots                │ │  Calibration:         OCCUPIED  │
│ │  Indoor bays: 6/8 spots                  │ │                                 │
│ │  Paint hall: 4/4 spots ⚠ FULL            │ │ Today's revenue:    187,400 NOK │
│ │                                          │ │ Week to date:     1,240,300 NOK │
│ └──────────────────────────────────────────┘ │                                 │
│                                              │ Open POs:                  47    │
│ ┌─── EMPLOYEE STATUS ─────────────────────┐ │ Awaiting reconcile:        8     │
│ │                                          │ │ Awaiting customer pay:     3     │
│ │  Body technicians (4 active / 5 total)   │ │                                 │
│ │   • Lars — Case 4711, body repair        │ └─────────────────────────────────┘
│ │   • Anders — Case 4690, disassembly      │
│ │   • Per — Case 4722, supplement assess.  │
│ │   • Ola — vacation                       │
│ │                                          │
│ │  Painters (1 active / 2 total)           │
│ │   • Erik — Case 4711, paint app          │
│ │   • Sigrid — Case 4682, prep             │
│ │                                          │
│ │  Mechanics, calibration, QC (...)        │
│ │                                          │
│ └──────────────────────────────────────────┘
└─────────────────────────────────────────────────────────────────────────────┘
```

### What she sees (every widget)

| Widget | Source | Update frequency |
|---|---|---|
| **Attention triage** (red/yellow/green case lists) | BottleneckDetection + DeliveryForecast | Realtime |
| **Production board** | Open WorkSegments by state | Realtime |
| **Deliveries summary** | Cases by promised date | On forecast change |
| **Capacity forecast (7-day grid)** | CapacityForecast | Every 5 min |
| **Resource utilization (paint booth, frame bench, calibration)** | Equipment assignments | Realtime |
| **Yard map** | VehiclePlacement | Realtime |
| **Employee status** | ClockSession + active ResourceAssignment | Realtime |
| **Quick action buttons** | Permission-filtered | Static |
| **Live numbers (cases, available techs, booth status)** | Aggregated queries | Realtime |
| **Financial summary (revenue today / WTD)** | InvoiceBasis + AccountingExport | Every 15 min |
| **Open POs, awaiting reconcile, awaiting customer pay** | Parts + Finance modules | Every 5 min |

### Actions she can perform

| Action | Permission | Workflow |
|---|---|---|
| Open any case | `case:view` | → case detail |
| Receive new vehicle (intake) | `case:edit` | → intake wizard |
| Plan / replan a case | `production:plan` | → planning calendar |
| Initiate a case transfer | `case:transfer` | → transfer modal |
| Assign or reassign work segments | `production:plan` | → planning UI |
| Approve a supplement | `estimate:lock` | → supplement review |
| Transition any case state | `production:transition` | → state machine UI |
| Resolve a bottleneck indicator manually | `production:plan` | → indicator detail |
| Simulate "accept this new case" | `production:plan` | → simulation modal |
| Clock another technician in/out | `time:other` | → time UI |
| Correct a time entry | `time:correct` | → time correction |
| Override an overbooked planning slot | `production:plan` | → confirm with reason |
| Open the planning calendar | `production:plan` | → calendar view |
| View employee performance | `case:view` + workforce read | → employee detail |

### Drill-downs

- Click a case → case detail page
- Click a technician → employee detail (today's plan, time, history)
- Click a bottleneck indicator → indicator detail with recommended actions
- Click a yard spot → vehicle / case detail
- Click capacity bar → day-detail with resource breakdown

### Real-time channels subscribed

```
workshop:<id>:production
workshop:<id>:yard
workshop:<id>:notifications
workshop:<id>:capacity-deltas
user:<production_manager_id>
```

---

## Painter dashboard

### Persona

**Erik**, 38, painter. Spends his day in or near the paint booth. Wears coveralls and a respirator most of the day. Often has gloves on. Phone is his primary device — Android, in a pocket. Screen sometimes wet. Sometimes uses a wall-mounted tablet near the booth.

### Questions he asks every day

1. What am I painting next?
2. What color is it (paint code)?
3. Is the prep done?
4. Is the booth free when I need it?
5. How long until the current cure finishes?
6. Did I clock in on the right task?

### Layout (mobile, primary)

```
┌──────────────────────────────────┐
│ ☰  Erik — Painter         🔔 3  │
├──────────────────────────────────┤
│                                  │
│ ┌──────────────────────────────┐ │
│ │  NOW                         │ │
│ │  Case 4711 — Audi A4 silver  │ │
│ │  Paint application           │ │
│ │  Clocked in: 11:42 (47 min)  │ │
│ │                              │ │
│ │  [⏸ PAUSE]    [✓ COMPLETE]  │ │
│ │                              │ │
│ │  📷 Add photo                 │ │
│ │  ⚠️ Flag issue                │ │
│ └──────────────────────────────┘ │
│                                  │
│ ┌──────────────────────────────┐ │
│ │  PAINT INFO — Case 4711      │ │
│ │  Color code: LX7W            │ │
│ │  Brand: Audi                 │ │
│ │  Type: 2-coat clear          │ │
│ │  Panels: Rear quarter R,     │ │
│ │          Bumper rear,        │ │
│ │          Door rear R         │ │
│ │  📷 Reference photos (4)     │ │
│ │  📋 Estimate detail          │ │
│ └──────────────────────────────┘ │
│                                  │
│ ┌──────────────────────────────┐ │
│ │  CURE TIMER                  │ │
│ │  Case 4682 in booth 1        │ │
│ │  Cure ends: 14:30 (in 1h 8m) │ │
│ │  [Set notification]           │ │
│ └──────────────────────────────┘ │
│                                  │
│ ┌──────────────────────────────┐ │
│ │  NEXT UP                     │ │
│ │  Case 4690 — Toyota black    │ │
│ │  Paint prep — ready          │ │
│ │  Booth: tomorrow 09:00       │ │
│ │  [View detail]                │ │
│ └──────────────────────────────┘ │
│                                  │
│ ┌──────────────────────────────┐ │
│ │  TODAY'S QUEUE (4)           │ │
│ │  ✓ 4682 prep                 │ │
│ │  → 4711 paint (current)      │ │
│ │  ◯ 4690 prep                 │ │
│ │  ◯ 4711 polish               │ │
│ └──────────────────────────────┘ │
└──────────────────────────────────┘
```

### What he sees (every widget)

| Widget | Source | Update frequency |
|---|---|---|
| **NOW** — current task | Active TimeEntry / ResourceAssignment | Realtime |
| **Paint info** | EstimatePaintLine + case data + linked Documents (reference photos) | On task switch |
| **Cure timer** | Active paint_cure segments where Erik or his booth is involved | Live countdown |
| **Next up** | Next ready segment in his queue | On queue change |
| **Today's queue** | Production queue for Erik (his role) | Realtime |
| **Notifications** | Notification module | Realtime |

### Actions he can perform

| Action | Permission | UX |
|---|---|---|
| Clock in to a segment | `time:self` | Big button on segment card |
| Clock out / pause / complete | `time:self` | Big buttons on NOW card |
| Upload photo | `quality:edit` | Camera button (one tap) |
| Flag quality issue (mid-job) | `quality:edit` | Issue button → form |
| Flag "this needs body work first" | `production:transition` | Status change → back to body |
| Set cure-end notification | `time:self` | Tap timer |
| Log material consumption | `quality:edit` | Optional — short form |
| View estimate detail | `case:view` | Tap → detail screen |
| Switch active task (forced flow) | `time:self` | Must clock out first |

### Glove-friendly considerations

- All buttons ≥ 56px tall
- Primary actions always at thumb-reachable bottom of screen
- High-contrast color choices (works in dirty/wet conditions)
- No drag-and-drop required for primary flows
- Voice notes available on photo upload (helpful when hands are full)
- Big haptic feedback on important actions (clock in/out, complete)

### Real-time channels subscribed

```
user:<erik_id>:queue
user:<erik_id>:notifications
workshop:<id>:booth-status (because Erik shares booth scheduling concerns)
```

---

## Body technician dashboard

### Persona

**Lars**, 31, body technician. Works in a repair bay. Hands often dirty. Body filler, paint dust, sometimes solvent on gloves. Uses phone constantly throughout the day. Some workshops give him a tablet on a magnetic mount near his bay.

### Questions he asks every day

1. What am I working on next?
2. What are the parts that should be on this car?
3. Are they here?
4. What did the estimator say about this damage?
5. Did I miss anything that needs a supplement?
6. Did I clock in correctly?

### Layout (mobile, primary) — similar shape to Painter but different content

```
┌──────────────────────────────────┐
│ ☰  Lars — Body tech       🔔 1  │
├──────────────────────────────────┤
│                                  │
│ ┌──────────────────────────────┐ │
│ │  NOW                         │ │
│ │  Case 4690 — Toyota black    │ │
│ │  Disassembly                 │ │
│ │  Clocked in: 08:15 (2h 38m)  │ │
│ │                              │ │
│ │  [⏸ PAUSE]   [✓ COMPLETE]   │ │
│ │  [⚠ SUPPLEMENT NEEDED]       │ │
│ │                              │ │
│ │  📷 Add photo                 │ │
│ │  📝 Add note                  │ │
│ └──────────────────────────────┘ │
│                                  │
│ ┌──────────────────────────────┐ │
│ │  WORK FOR THIS CASE          │ │
│ │  Operation list:             │ │
│ │   • Remove rear bumper       │ │
│ │   • Strip damaged trim       │ │
│ │   • Drill spot welds R side  │ │
│ │   • Cut/replace quarter R    │ │
│ │   • Initial filler           │ │
│ │  📋 Full estimate            │ │
│ └──────────────────────────────┘ │
│                                  │
│ ┌──────────────────────────────┐ │
│ │  PARTS STATUS                │ │
│ │  ✓ Rear quarter R — received │ │
│ │  ✓ Trim clips — received     │ │
│ │  ⏳ Body filler — in stock    │ │
│ │  ❌ Bumper bracket — ordered │ │
│ │     ETA tomorrow              │ │
│ │  [Order more / request]      │ │
│ └──────────────────────────────┘ │
│                                  │
│ ┌──────────────────────────────┐ │
│ │  REFERENCE                   │ │
│ │  📷 Before photos (6)        │ │
│ │  📝 Estimator's note         │ │
│ │  📋 Insurance assessment     │ │
│ └──────────────────────────────┘ │
│                                  │
│ ┌──────────────────────────────┐ │
│ │  NEXT IN MY QUEUE (3)        │ │
│ │  → 4690 disassembly (now)    │ │
│ │  ◯ 4711 assembly              │ │
│ │  ◯ 4722 body repair           │ │
│ └──────────────────────────────┘ │
└──────────────────────────────────┘
```

### What he sees

| Widget | Source | Update frequency |
|---|---|---|
| **NOW** — current task | Active TimeEntry / ResourceAssignment | Realtime |
| **Work for this case** | Open WorkSegment + EstimateOperations for it | On task switch |
| **Parts status** | PartRequirements + PartReceipts + PartLifecycleEvents for case | Realtime |
| **Reference** (before photos, estimator notes, insurance docs) | Linked Documents | On task switch |
| **My queue** | Production queue for Lars | Realtime |

### Actions he can perform

| Action | Permission | UX |
|---|---|---|
| Clock in to a segment | `time:self` | Big button |
| Pause / complete / clock out | `time:self` | Big buttons |
| **Flag supplement needed** | `production:transition` | Prominent button (very common action) |
| Upload photo | `quality:edit` | Camera button |
| Add text note | `quality:edit` | Note button |
| Request a part | `parts:order` (if permitted) or notify estimator otherwise | Tap part status → request form |
| View estimate | `case:view` | Tap → detail |
| View original damage photos | `case:view` | Tap → gallery |
| Mark a task within the segment complete | `time:self` | Checkbox in operation list |

### The "Flag supplement needed" flow (high-importance, common)

Lars taps the button. Modal opens:

```
┌──────────────────────────────────┐
│ Supplement needed                │
│                                  │
│ Briefly describe what you found: │
│ [____________________________]   │
│                                  │
│ 📷 Take photo(s) of finding      │
│   [+ photo]                      │
│                                  │
│ Severity                         │
│ ○ Small — under 1h work          │
│ ● Medium — 1-4h work             │
│ ○ Large — more than 4h           │
│                                  │
│ Notify:                          │
│ ☑ Estimator                      │
│ ☐ Production manager             │
│ ☐ Customer                       │
│                                  │
│ [Cancel]    [Submit supplement]  │
└──────────────────────────────────┘
```

On submit:
- WorkSegment status → 'paused' with `blocked_reason='supplement_needed'`
- HoldRecord created
- Production state may transition to 'Awaiting approval'
- Estimator notified
- Lars's queue shows the next ready task

---

## Estimator dashboard

### Persona

**Pia**, 45, estimator. Office-based but walks to vehicles for assessments. 8-12 estimates per day. Mix of intake estimates and supplements. Primary device is desktop with two monitors (one for DBS, one for VerkstedOS). Tablet for walk-around.

### Questions she asks every day

1. What estimates do I need to do today?
2. What supplements are pending insurance?
3. Have I heard back on yesterday's submissions?
4. What customer responses am I waiting for?
5. Is anyone arriving today for assessment?
6. What needs my urgent attention?

### Layout (desktop, two columns)

```
┌─────────────────────────────────────────────────────────────────────┐
│ Estimator — Pia Olsen                                  🔔 8 new     │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│ ┌─── TODAY ───────────────────────┐ ┌─── PENDING ────────────────┐ │
│ │                                  │ │                            │ │
│ │ 📅 Arrivals today (4)            │ │ ⏳ Awaiting insurance (6)  │ │
│ │  09:00 4731 Jensen — Toyota     │ │  • 4682 Fremtind — 3 days  │ │
│ │  10:30 4732 Hansen — Volkswagen │ │  • 4711 Gjensidige — 1 day │ │
│ │  13:00 4733 AS Møller — Volvo   │ │  • 4690 If — 4 days ⚠       │ │
│ │  14:30 4734 Larsen — Audi       │ │  • 4720 Fremtind — supplem.│ │
│ │                                  │ │  • 4699 Tryg — supplem.    │ │
│ │ 📋 Estimates to complete (3)     │ │  • 4702 Codan — initial    │ │
│ │  • 4690 — disassembly supplement│ │                            │ │
│ │  • 4720 — initial assessment    │ │ ⏳ Awaiting customer (3)   │ │
│ │  • 4711 — final review          │ │  • 4665 — 2 days           │ │
│ │                                  │ │  • 4694 — 1 day            │ │
│ │ ⚠ Urgent (1)                     │ │  • 4708 — 4 hours          │ │
│ │  • 4665 — customer awaiting     │ │                            │ │
│ │    pickup, estimate not locked  │ │ 📨 Replies overnight (2)   │ │
│ │                                  │ │  • Fremtind approved 4651  │ │
│ │                                  │ │  • If counter-offer 4659   │ │
│ └──────────────────────────────────┘ └────────────────────────────┘ │
│                                                                     │
│ ┌─── ACTIVE CASES (estimator scope) ─────────────────────────────┐ │
│ │                                                                  │ │
│ │ Search: [___________________]   Filter: All / Mine / Today      │ │
│ │                                                                  │ │
│ │ # | Reg     | Cust       | State           | Estimator | Action │ │
│ │ 4731 AB1234   Jensen      Received          —           [Take]  │ │
│ │ 4711 CC4567   Hansen Ind. Approved          Pia         [Open]  │ │
│ │ 4690 BB2222   Toyota Imp. Aw. approval ⚠    Pia         [Open]  │ │
│ │ 4682 DD8888   Bolt AS     In paint          Pia         [Open]  │ │
│ │ 4665 GG3333   Larsen      Ready for deliv.  Pia         [Open]  │ │
│ │ ... (paginated)                                                 │ │
│ └──────────────────────────────────────────────────────────────────┘ │
│                                                                     │
│ ┌─── QUICK ACTIONS ────────────────────────────────────────────────┐ │
│ │                                                                  │ │
│ │ [📥 Import DBS]   [+ New case]   [+ Supplement to existing]      │ │
│ │ [📞 Customer lookup (1881)]      [🚗 Vehicle lookup (Vegvesen)] │ │
│ │ [📨 Send to insurer batch]       [📋 Today's report]             │ │
│ │                                                                  │ │
│ └──────────────────────────────────────────────────────────────────┘ │
│                                                                     │
│ ┌─── MY KPI THIS MONTH ────────────────────────────────────────────┐ │
│ │  Estimates completed:        47                                  │ │
│ │  Avg. cycle time:           1.8 days                             │ │
│ │  Supplements created:        12                                  │ │
│ │  Supplement approval rate:   91%                                 │ │
│ │  Estimate variance:         +6% (actual vs estimated)            │ │
│ └──────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────┘
```

### What she sees

| Widget | Source | Update frequency |
|---|---|---|
| **Arrivals today** | Cases with `expected_arrival_at` today | Realtime |
| **Estimates to complete** | Cases assigned to her with status 'Received' or supplement pending | Realtime |
| **Urgent** | Cases with delivery_at_risk or customer-awaiting | Realtime |
| **Awaiting insurance** | Open HoldRecords kind='approval_insurance' | Realtime |
| **Awaiting customer** | Open HoldRecords kind='approval_customer' | Realtime |
| **Replies overnight** | Inbound integration events from insurer adapters | Realtime |
| **Active cases (scoped)** | All cases she's assigned to or has touched | On case change |
| **My KPI this month** | Estimator-specific KPIs from canonical calculations | Daily |

### Actions she can perform

| Action | Permission | Workflow |
|---|---|---|
| Import DBS estimate | `estimate:edit` | → DBS import wizard |
| Create new case | `case:edit` | → intake wizard |
| Create supplement | `estimate:edit` | → supplement wizard (new EstimateImport version) |
| Lock estimate | `estimate:lock` | → review and lock confirmation |
| Allocate lines to funding sources | `estimate:edit` | → allocation UI |
| Send estimate to insurer | `estimate:lock` | → DBS submit + audit |
| Customer lookup (1881) | `case:view` | → lookup with caching |
| Vehicle lookup (Vegvesen) | `case:view` | → lookup with caching |
| Take ownership of a case (assign to self) | `case:edit` | → reassignment |
| Send customer SMS/email | (communication permission) | → templated communication |
| Approve or decline insurer counter-offer | `estimate:lock` | → counter-offer review |
| Mark estimate as final | `estimate:lock` | → workflow transition |

### Drill-downs

- Click any case → case detail with estimating context highlighted
- Click an "Awaiting insurance" entry → claim communication thread
- Click a KPI → KPI detail with breakdown by claim type, insurer, day

### Real-time channels subscribed

```
user:<pia_id>
workshop:<id>:estimates
workshop:<id>:notifications
```

---

## Workshop Owner dashboard

### Persona

**Bjørn**, 56, owns a 12-employee workshop. Spends his day mixing operational decisions, customer relationships, and admin. Wants the dashboard to tell him everything that matters in 30 seconds. Comfortable with technology but doesn't want clutter. Uses desktop in office, phone for quick checks.

### Questions he asks every day

1. Are we making money this week?
2. Is the team busy?
3. Are customers happy?
4. Anything broken or stuck?
5. Are we on track to deliver promises?
6. Any new opportunities or risks?

### Layout (desktop, single-screen overview + drill-downs)

```
┌─────────────────────────────────────────────────────────────────────┐
│ Carlsen Bilskade — Bjørn Carlsen, Owner               🔔 5 new      │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│ ┌─── HEALTH AT A GLANCE ──────────────────────────────────────────┐ │
│ │                                                                  │ │
│ │   🟢 Production       🟡 Capacity        🟢 Quality              │ │
│ │   32 active cases     Paint: 92%         Rework rate: 3.2%      │ │
│ │   24 on track          Body: 78%          (target <5%)           │ │
│ │   6 yellow             Mech: 56%                                 │ │
│ │   2 red 🔴             QC: ok            🟢 Customer             │ │
│ │                                            NPS: 8.4              │ │
│ │   🟢 Financial         🟢 Compliance      Avg cycle: 11.2d       │ │
│ │   Margin MTD: 18%      Audit clean        (target 12d)           │ │
│ │   Target: 17%          Last QC: today                            │ │
│ │                                                                  │ │
│ └──────────────────────────────────────────────────────────────────┘ │
│                                                                     │
│ ┌─── FINANCIAL THIS WEEK ────────────┐ ┌─── DELIVERIES ─────────┐  │
│ │                                     │ │                        │  │
│ │ Revenue       1,240,300 NOK         │ │ Today           3      │  │
│ │  vs last week:    +8%               │ │ This week      17      │  │
│ │  vs target:        on               │ │ Next week       9      │  │
│ │                                     │ │                        │  │
│ │ Margin              18%             │ │ At risk         2  🔴  │  │
│ │  vs last week:    +1pt              │ │  • 4682  Fremtind      │  │
│ │  vs target:    +1pt over            │ │  • 4720  If            │  │
│ │                                     │ │                        │  │
│ │ Pending invoicing: 187,400 NOK      │ │ [View all]              │  │
│ │ Unreconciled:       42,800 NOK      │ │                        │  │
│ └─────────────────────────────────────┘ └────────────────────────┘  │
│                                                                     │
│ ┌─── TEAM ──────────────────────────────────────────────────────┐ │
│ │                                                                │ │
│ │ Utilization (week to date): ████████░░ 78%                     │ │
│ │ Productivity:               ███████░░░ 71% (target 75%)        │ │
│ │ Efficiency:                 █████████░ 89%                     │ │
│ │                                                                │ │
│ │ Absences today: 1 (Ola, vacation)                              │ │
│ │ Sick this month: 2 days total                                  │ │
│ │                                                                │ │
│ │ [Team detail]                                                  │ │
│ └────────────────────────────────────────────────────────────────┘ │
│                                                                     │
│ ┌─── CASES NEEDING ATTENTION (5) ─────────────────────────────────┐ │
│ │                                                                  │ │
│ │ 🔴 4682 — Bolt AS — promise crossed, paint booth blocked        │ │
│ │ 🔴 4720 — Hansen — supplement awaiting 4 days                   │ │
│ │ 🟡 4690 — Toyota Imp — backorder part, ETA changed              │ │
│ │ 🟡 4711 — Hansen Ind — cure ends today, no QC slot              │ │
│ │ 🟡 4665 — Larsen — customer awaiting pickup, billing pending    │ │
│ │                                                                  │ │
│ │ [View all open cases]                                            │ │
│ └──────────────────────────────────────────────────────────────────┘ │
│                                                                     │
│ ┌─── INSURER MIX (last 30 days) ──────┐ ┌─── INCOMING ──────────┐  │
│ │                                      │ │                       │  │
│ │ Fremtind   ████████░░ 38%            │ │ This week       19    │  │
│ │ If         █████░░░░░ 24%            │ │ Next week        7    │  │
│ │ Gjensidige ████░░░░░░ 19%            │ │ Pipeline      35      │  │
│ │ Tryg       ██░░░░░░░░  9%            │ │                       │  │
│ │ Other      ██░░░░░░░░ 10%            │ │ Avg ticket   34,200 NOK│  │
│ │                                      │ │                       │  │
│ │ [Insurer detail]                     │ └───────────────────────┘  │
│ └──────────────────────────────────────┘                            │
└─────────────────────────────────────────────────────────────────────┘
```

### What he sees

| Widget | Source | Update frequency |
|---|---|---|
| **Health at a glance** (5 traffic-light tiles) | Canonical KPI calculations | Every 5 min |
| **Financial this week** | InvoiceBasis + AccountingExport | Every 15 min |
| **Deliveries** | Cases by promised date with at-risk flag | Realtime |
| **Team metrics** | Workforce calculations (utilization, productivity, efficiency) | Every 30 min |
| **Cases needing attention** | BottleneckDetection + DeliveryForecast | Realtime |
| **Insurer mix** | Aggregated funding source data (last 30 days) | Daily |
| **Incoming** | Cases in pipeline + recent arrivals trend | Daily |

### Actions he can perform

Everything a Production Manager can do, plus:

| Action | Permission | Workflow |
|---|---|---|
| Configure workshop settings | `admin:config` | → admin section |
| Approve large supplements (over threshold) | `estimate:lock` | → review screen |
| View detailed financial reports | `finance:view` | → finance section |
| Adjust labor rates and pricing | `admin:config` | → pricing UI |
| Add/remove employees | `admin:users` | → user management |
| Configure roles | `admin:users` | → role management |
| View audit log | `admin:audit` | → audit search |
| Send customer satisfaction surveys (post-delivery) | (communication permission) | → bulk send |
| Configure notification rules | `admin:config` | → notification rules |
| Set up new suppliers | `admin:config` | → supplier management |
| Configure workflow definition | `admin:config` | → workflow editor |

### Drill-downs

Every tile expands. Bjørn rarely stays on the dashboard for long — he scans, then dives:
- Click Production tile → Production Manager dashboard
- Click Financial tile → Finance section
- Click Team tile → workforce KPI detail
- Click Quality tile → quality dashboard (rework rate breakdown)
- Click Customer tile → customer satisfaction detail (when implemented)

### Real-time channels subscribed

```
workshop:<id>:production
workshop:<id>:notifications
workshop:<id>:financial-summary
user:<bjorn_id>
```

---

## Executive dashboard

### Persona

**Anna**, 47, COO of an 8-workshop chain (Carlsen Group). Doesn't run individual workshops — her workshop owners do. She makes strategic decisions, allocates capital, manages insurer relationships at the group level, hires regional managers. Lives in Excel, board decks, and a desktop with three monitors.

### Questions she asks every day/week

1. How are all workshops performing relative to each other?
2. Where are the chain-wide opportunities and risks?
3. Are we hitting our targets?
4. Where should we invest next (equipment, hiring, expansion)?
5. How are insurer relationships trending?
6. What requires my intervention?

### Layout (desktop, large screen, comparative tables and trends)

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│ Carlsen Group — Executive view, Anna Karlsen     Period: This month ▼  🔔 4    │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│ ┌─── GROUP KPI THIS MONTH ───────────────────────────────────────────────────┐ │
│ │                                                                             │ │
│ │   Revenue          MTD: 8.2M  vs target: 7.8M  ✓        Trend (last 12M):   │ │
│ │                    YTD: 47.1M vs target: 44M   ✓        ╱╲    ╱╲     ╱      │ │
│ │                                                          ╱  ╲  ╱  ╲   ╱       │ │
│ │   Margin           MTD: 16.4% vs target: 17%   ↓        ╱    ╲╱    ╲ ╱        │ │
│ │                    YTD: 17.1% vs target: 17%   ✓                    ╲         │ │
│ │                                                                                │ │
│ │   Throughput       MTD: 312   vs target: 280   ✓        Cases delivered      │ │
│ │   Avg cycle time   MTD: 12.4d vs target: 11d   ↓        per month             │ │
│ │                                                                                │ │
│ │   Rework rate      MTD: 4.1%  vs target: <5%   ✓                              │ │
│ │   Customer NPS     MTD: 7.9   vs target: 8.5   ↓                              │ │
│ │                                                                                │ │
│ └────────────────────────────────────────────────────────────────────────────┘ │
│                                                                                 │
│ ┌─── WORKSHOPS COMPARISON ───────────────────────────────────────────────────┐ │
│ │                                                                             │ │
│ │ Workshop      Cases  Revenue   Margin  Cycle  Rework  Capacity  Health      │ │
│ │ Oslo Sentrum    52   1.4M      19% ✓   11.0d  3.1%   89%       🟢          │ │
│ │ Oslo Skøyen     38   1.1M      18% ✓   12.1d  3.8%   78%       🟢          │ │
│ │ Bergen          42   1.2M      16% ↓   13.2d  4.4%   85%       🟡          │ │
│ │ Stavanger       31   0.9M      15% ↓   14.0d  5.1% ⚠ 92%       🟡          │ │
│ │ Trondheim       45   1.3M      19% ✓   11.8d  3.2%   88%       🟢          │ │
│ │ Tromsø          28   0.8M      14% ↓   15.1d  6.2% 🔴 76%       🔴          │ │
│ │ Drammen         36   1.0M      17% ✓   12.4d  4.0%   81%       🟢          │ │
│ │ Kristiansand    40   1.5M      17% ✓   11.5d  3.5%   84%       🟢          │ │
│ │                                                                             │ │
│ │ [Detail per workshop]                                                       │ │
│ └─────────────────────────────────────────────────────────────────────────────┘ │
│                                                                                 │
│ ┌─── INSURER PERFORMANCE ──────────────┐ ┌─── CHAIN-WIDE CAPACITY ────────────┐ │
│ │                                       │ │                                    │ │
│ │  Top 5 by revenue (YTD):              │ │  Total available     1,840 hrs/wk  │ │
│ │  Fremtind     18.4M  margin 17%       │ │  Committed           1,560 hrs/wk  │ │
│ │  If           11.2M  margin 15% ↓     │ │  Utilization         85%           │ │
│ │  Gjensidige    9.8M  margin 19% ✓     │ │                                    │ │
│ │  Tryg          4.1M  margin 18%       │ │  Bottleneck this week:             │ │
│ │  Fremtind eff  2.5M  margin 16%       │ │  Paint booth Bergen (97%)          │ │
│ │                                       │ │  Body Tromsø (94%)                 │ │
│ │  Settlement time (avg):               │ │                                    │ │
│ │  Fremtind     8 days                  │ │  Underutilized:                    │ │
│ │  If          14 days ⚠                │ │  Stavanger paint (67%)             │ │
│ │  Gjensidige   6 days                  │ │  Drammen mech (62%)                │ │
│ │                                       │ │                                    │ │
│ │  [Insurer detail]                     │ │  [Cross-workshop sharing report]  │ │
│ └───────────────────────────────────────┘ └────────────────────────────────────┘ │
│                                                                                 │
│ ┌─── ATTENTION (group-level) ────────────────────────────────────────────────┐ │
│ │                                                                             │ │
│ │ 🔴 Tromsø workshop: rework rate trending up 3 months — investigate          │ │
│ │ 🔴 If settlement time degraded — escalate at next account meeting           │ │
│ │ 🟡 Bergen paint booth at 97% — consider second booth or overflow to Drammen │ │
│ │ 🟡 NPS below target — survey response analysis indicates communication gaps │ │
│ │                                                                             │ │
│ └─────────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### What she sees

| Widget | Source | Update frequency |
|---|---|---|
| **Group KPI tiles with sparklines** | Aggregated canonical calculations | Daily |
| **Workshops comparison table** | Per-workshop rollup of canonical KPIs | Daily |
| **Insurer performance** | Funding source aggregations + settlement-time tracking | Daily |
| **Chain-wide capacity** | CapacityForecast aggregated across workshops | Every 15 min |
| **Attention (group-level)** | Trend analysis flagging cross-workshop patterns | Daily |
| **Historical trends** (12-month sparklines on each KPI) | KPI snapshot time-series | Daily |

### Actions she can perform

| Action | Permission | Workflow |
|---|---|---|
| Drill into any workshop's dashboard | Enterprise admin | → workshop owner view |
| Compare any two workshops side-by-side | Enterprise admin | → comparison view |
| Configure organization-wide policies | `admin:config` (org-scoped) | → org admin |
| Set group-wide KPI targets | `admin:config` | → KPI configuration |
| View consolidated financials | `finance:view` (chain-wide) | → group finance |
| Export cross-workshop reports | `finance:export` | → report builder |
| Manage workshop additions/removals | `admin:workshops` (post-MVP permission split) | → workshop management |
| View insurer-level financial breakdown | `finance:view` | → insurer drill-down |
| View cross-workshop case transfer flow | Enterprise admin | → transfer report |
| Configure chain-wide notification rules | `admin:config` | → notification rules |
| Allocate budget per workshop | `admin:config` + finance | → budgeting UI |
| Plan capacity expansion / consolidation | (read-only analytical) | → planning view |

### Drill-downs

- Click any workshop row → workshop owner dashboard for that workshop
- Click any KPI tile → KPI detail with breakdown
- Click any insurer → insurer-specific report
- Click any attention item → drill into the root cause (the workshop, the trend, the case set)

### Real-time elements

The Executive dashboard is mostly daily-refreshed. Realtime is reserved for:
- Critical group-level alerts (a workshop locked by Dev Control Plane, a major system event)
- The Attention widget refreshes hourly

### Real-time channels subscribed

```
organization:<id>:executive-alerts
user:<anna_id>
```

---

## Shared dashboard components

These components are reused across multiple dashboards. They're built once, used everywhere — a Single Source of Truth pattern for UI as well as data.

### Component library

| Component | Used in | Pulls from |
|---|---|---|
| `<CaseCard variant="compact">` | All dashboards | Case + DeliveryForecast |
| `<CaseCard variant="full">` | Case detail pages | Full case aggregate |
| `<BottleneckIndicator>` | Production Manager, Workshop Owner, Executive | BottleneckDetection projection |
| `<CapacityForecastBar>` | Production Manager, Workshop Owner | CapacityForecast |
| `<DeliveryRiskBadge>` | Many | DeliveryForecast |
| `<FundingSourceList>` | Case detail, Workshop Owner, Executive | CaseFundingSource |
| `<KpiTile variant>` | Workshop Owner, Executive | Canonical KPI calculations |
| `<KpiSparkline>` | Executive | KPI snapshot time-series |
| `<ResourceUtilizationGauge>` | Production Manager, Workshop Owner | CapacityForecast |
| `<YardSpotIndicator>` | Production Manager, Workshop Owner | VehiclePlacement |
| `<TaskCard mobile>` | Painter, Body Technician | WorkSegment + active TimeEntry |
| `<PartsStatusList>` | Body Technician, Production Manager | PartRequirement projection |
| `<NotificationBell>` | All dashboards | NotificationDelivery |

### KPI alignment (per Single Source of Truth)

Every KPI shown anywhere uses its registry entry. The same calculation produces the value on:
- Painter dashboard widget
- Production Manager dashboard widget
- Workshop Owner dashboard widget
- Executive dashboard widget
- A printed report
- An API response

Differences are presentation only (sparkline vs number vs percentage). The number itself comes from exactly one canonical calculation.

---

## Permission summary per dashboard

For role auditing and the security review.

| Dashboard | Required permissions (at minimum) | Optional permissions for full features |
|---|---|---|
| Production Manager | `case:view`, `production:view`, `production:plan`, `production:transition`, `time:other` | `time:correct`, `parts:view`, `quality:view` |
| Painter | `case:view`, `production:view`, `time:self`, `quality:edit` | (none additional needed) |
| Body Technician | `case:view`, `production:view`, `time:self`, `quality:edit` | `parts:order` (for parts request) |
| Estimator | `case:view`, `case:edit`, `estimate:view`, `estimate:edit`, `estimate:lock`, `parts:view` | `finance:view` (to see funding source values) |
| Workshop Owner | All Production Manager permissions + `admin:users`, `admin:config`, `admin:audit`, `finance:view`, `finance:invoice`, `finance:export` | (none) |
| Executive | All Workshop Owner permissions, **chain-wide** (org-scoped role assignment, no workshop_id) | (none) |

---

## Three Surfaces of the dashboards module

### User Surface
The six dashboards above. Routes:
- `/dashboard/production` — Production Manager
- `/dashboard/painter` — Painter
- `/dashboard/technician` — Body Technician
- `/dashboard/estimator` — Estimator
- `/dashboard/owner` — Workshop Owner
- `/dashboard/executive` — Executive

User lands on the dashboard their role grants. Role determines auto-routing on login.

### Admin Surface
- `/admin/dashboards/widgets` — enable/disable widgets per role per org (defaults shipped)
- `/admin/dashboards/kpi-targets` — set numeric targets per workshop / per org for traffic-light logic
- `/admin/dashboards/visibility` — control which KPI categories are visible (e.g. small workshop disables NPS until they're ready to capture it)
- `/admin/production-board/terminology` — rename / reorder / hide Production Board columns per org or per workshop (presentation only — underlying workflow engine standardized; doc 13 § 20.6)

Permissions: `admin:config`

### Dev Surface
- `/dev/dashboards/perf` — load-time tracking per dashboard, per user; flag dashboards exceeding 1s p95
- `/dev/dashboards/widget-health` — which projections are stale, which calculations are slow
- `/dev/dashboards/usage` — which widgets are clicked, which are ignored (input for design iteration)
- `/dev/dashboards/render-trace` — for a given user complaining of slow dashboard, see exact query plan and projection refresh state
- `/dev/dashboards/kpi-drift` — automated detection of KPI values diverging between dashboards (Single Source of Truth violation alarm)
- `/dev/impersonation/view-as-role` — render the customer application **as if** the platform operator held a given role (Owner, Production Manager, Estimator, Reception, Office, Technician, Painter, Parts, Customer Portal) inside a given (demo / test) organization. Audited via `platform_audit_events` (`impersonated_started` / `impersonated_ended` + `metadata.role_perspective`). Implementation extends doc 06's impersonation framework; binding spec in doc 13 § 20.8 and doc 12 § 11.

Permissions: `platform:org:view`, `platform:data:repair`, `platform:user:impersonate`

---

## Implementation notes

### Dashboard data fetching strategy

Each dashboard widget is independent. Widgets:
1. Fetch their own data via React Server Components (initial load)
2. Subscribe to relevant Realtime channels for live updates
3. Cache for stable widgets (KPI tiles refresh every 5-15 min, not on every render)
4. Stream incrementally — header loads first, then widgets in priority order

Render budget (production):
- Header + navigation: 200ms
- Top-priority widgets (NOW for technicians, Attention for managers): 500ms
- Secondary widgets: 1.5s
- Total dashboard: < 1s p95 on production hardware, < 2s on workshop-floor 4G

### Caching strategy

| Cache layer | Used for |
|---|---|
| **Database materialized views** | Production board, capacity forecast snapshots, KPI rollups |
| **Service-layer memoization (per request)** | Same data referenced by multiple widgets in one render |
| **HTTP cache headers** | Static or near-static data (workshop config, role definitions) |
| **Browser cache** | Reference data (workflow states, segment catalog) |
| **Optimistic updates** | Action confirmations (clock in/out, mark complete) |

### Mobile-specific optimizations (Painter, Body Technician)

- Service worker caches the shell so the app opens instantly even offline
- Read-only fallback when offline: last-loaded state visible, write actions queued not allowed (per architecture decision)
- Sized images only (480px default; thumb on grid views)
- No drag-and-drop (use modals for state changes)
- Big touch targets (≥ 56px)
- Single-handed reachability (primary actions in bottom third)
- Persistent visible "I am clocked in to Case X" indicator

### Dashboard customization (future, not MVP)

The MVP ships with fixed dashboards. Post-MVP:
- Workshop Owners can add/remove widgets within the available catalog
- Workshops can create custom KPI tiles (using registered calculations)
- Custom layouts per workshop save in `dashboard_configs`

This is deferred deliberately. MVP success requires opinionated defaults, not configuration paralysis.

### Notification integration

Each dashboard's notification bell shows:
- Personal notifications (assigned to me, mentioned)
- Role-relevant notifications (estimator gets insurer responses; technician gets parts arrival for their cases; owner gets at-risk alerts)
- Filterable by category, time, read/unread

Notifications drive dashboard updates but don't dominate the UI. The dashboard remains the primary surface; the notification bell is supporting cast.

### Internationalization

All labels go through i18n from day one. Norwegian primary; English secondary. The dashboards above are presented in English in this doc for readability; production strings will be in Bokmål.

---

## Summary

| Role | Primary device | Update style | Information density | Action density |
|---|---|---|---|---|
| Production Manager | Desktop, 27" | Heavy realtime | High | High |
| Painter | Mobile | Realtime current task | Low | Focused (5-6 actions) |
| Body Technician | Mobile | Realtime current task | Low-Medium | Focused (7-8 actions) |
| Estimator | Desktop + tablet | Realtime on inbox | Medium | High |
| Workshop Owner | Desktop primary | Mixed (realtime for ops, periodic for finance) | High (one screen) | High (drill-down) |
| Executive | Desktop, large | Mostly daily | Medium (comparative) | Strategic (configuration, not operations) |

Each dashboard is designed for the role, not adapted from a generic template. This is the most visible layer of VerkstedOS — the place where the architecture's domain modeling meets the user every day.
