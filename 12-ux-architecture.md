# 12 — Product Experience & UX Architecture

This document defines how VerkstedOS *feels* to use. It sits above the domain architecture (docs 02-10) and the role information design (doc 11), defining the experiential and navigational layer.

**The one-line vision:** VerkstedOS should feel like Linear for collision repair — fast, case-centric, keyboard-driven on desktop, touch-first on the floor, operational rather than report-heavy. Users don't navigate a system; they work on cases. The software gets out of the way.

---

## Reconciliation with doc 11 (Dashboards)

Doc 11 defined *what information* each of six roles needs. This document defines *how that information is delivered as an experience*.

The resolution:

- The six "dashboards" in doc 11 are **not** six separate destinations a user navigates between.
- They are **role-adaptive renderings of a single Operations Center** (the home surface) plus the **Case Workspace** (where most work happens).
- A Production Manager and a Workshop Owner open the same Operations Center; it renders the content relevant to their role.
- "Dashboard" as a noun is mostly retired in the product. We have **operational views** (the default) and a small, deliberate **Insights** area (analytics you visit on purpose).

Read doc 11 for the per-role information inventory. Read this document for the experience that delivers it.

---

## 1. UX Vision

VerkstedOS is an **operating system for collision repair**, not an ERP. The distinction is experiential, not just architectural.

| Traditional workshop ERP (Cabas, Winassist, legacy) | VerkstedOS |
|---|---|
| Module-centric (Customers module, Orders module...) | Case-centric (you work on cases) |
| Navigate via deep menu trees | Navigate via search + command palette |
| Forms and tables everywhere | Purpose-built views per workflow |
| Information behind many clicks | Information one keystroke away |
| Multiple disconnected dashboards | One Operations Center + Case Workspace |
| Page-hopping to complete a task | Complete tasks inline, in context |
| Static, refresh-to-update | Real-time by default |
| Feature parity across devices | Right workflow for the right device |
| Dense without hierarchy | Clear hierarchy, progressive disclosure |
| Mouse-driven | Keyboard-first (desktop), touch-first (floor) |

The reference products and what we take from each:

- **Linear** — speed, command palette (⌘K), keyboard shortcuts, the issue-as-workspace model, saved views, the feeling that the tool keeps up with your thinking
- **Stripe Dashboard** — object detail pages where everything about an entity lives, the events stream, search-first navigation, clean data density
- **Notion** — everything about an object on one flexible page, inline editing, no "edit mode" friction
- **Supabase Dashboard** — technical density done well, fast table/log navigation, the Dev Control Plane aesthetic
- **Monday.com** — visual boards, color-as-information, status at a glance

What we explicitly reject: the ERP mindset where the user's job is to operate the software. The user's job is to repair cars. The software is invisible infrastructure that makes that faster.

---

## 2. Information Architecture

The system is organized around **objects and operational surfaces**, not modules.

### Primary objects (what users work on)

```
Case                ← the center of gravity; most work happens here
 ├── Vehicle
 ├── Customer(s)
 ├── Funding sources
 ├── Estimate
 ├── Production order + work segments
 ├── Parts
 ├── Documents
 ├── Communications
 └── Timeline (everything that happened)
```

### Operational surfaces (where users look at many objects)

```
Operations Center   ← home; "what needs attention now?"; role-adaptive
Production Board     ← cases as cards in a flow; drag to progress
Cases (list/views)   ← filtered, saved views of cases
Parts                ← parts needing action across cases
Insights             ← deliberate analytics destination (not the home)
```

### Supporting surfaces (configuration, tucked away)

```
Settings             ← org config, workflow editor, roles, integrations
Dev Control Plane    ← /dev; separate, platform-team only
```

### The mental model

A user's day is: **open the Operations Center → it tells you what needs attention → you click into a Case → you do the work inside the Case → you return to the Operations Center.**

For the production manager, the loop runs through the Production Board instead of the Operations Center sometimes. For the technician, it's the mobile queue. But the shape is always the same: *a surface that surfaces work → the work itself (a Case) → back.*

There is no "Customers module" you go into to manage customers. You find a customer via search, or you encounter them inside a case. There is no "Reports module." There is no top-level "Inventory." The objects connect through the Case.

---

## 3. Navigation Architecture

Linear-style. Navigation is something you barely notice because search and command do most of the work.

### The command palette (⌘K / Ctrl+K) — primary navigation and action

Press ⌘K anywhere. The palette opens. You can:

```
⌘K
┌─────────────────────────────────────────────┐
│ 🔍 Search or type a command...               │
├─────────────────────────────────────────────┤
│ RECENT                                       │
│   Case 4711 · Audi A4 · AB12345              │
│   Case 4690 · Toyota · BB22222               │
│                                              │
│ JUMP TO                                      │
│   → Operations Center                        │
│   → Production Board                         │
│   → Parts                                    │
│                                              │
│ ACTIONS                                      │
│   + New case                                 │
│   + Receive vehicle                          │
│   ⏱ Clock in                                 │
│   → Transfer a case                          │
└─────────────────────────────────────────────┘
```

Type a registration plate → it finds the vehicle and its cases. Type a case number → jump straight there. Type "transfer" → start the transfer flow. Type a customer name → find them. The command palette is the single most important navigation primitive. Everything reachable from it.

### Global search (always available)

A persistent search affordance (and ⌘K) that searches across **every entity type** the user has permission to see:

- Cases (by number, reg, customer, claim)
- Vehicles (reg, VIN)
- Customers (name, phone, org number)
- Estimates, invoices, parts, POs
- (In Dev Control Plane: also users, events, jobs, audit entries — see § 11)

Search results are typed and grouped. Selecting one navigates there. Search is navigation; you rarely "browse" to things.

### Left sidebar (minimal, collapsible)

```
┌──────────────────┐
│ Carlsen Bilskade │  ← org switcher (if multi-org)
│ Oslo Sentrum   ▾ │  ← workshop switcher
├──────────────────┤
│ ◎ Operations     │  ← the home
│ ▦ Production     │  ← the board
│ ≣ Cases          │  ← lists / saved views
│ ⬡ Parts          │  ← parts coordinator surface
│ ◔ Insights       │  ← analytics destination
├──────────────────┤
│ VIEWS            │  ← saved filtered views (Linear-style)
│   My cases       │
│   Awaiting parts │
│   In paint       │
│   At risk        │
├──────────────────┤
│ ⚙ Settings       │
└──────────────────┘
```

The sidebar is intentionally short. Items shown are role-filtered (a technician doesn't see Insights or Parts coordinator surfaces). The sidebar collapses to icons. Saved views are user- and org-defined, like Linear's custom views.

### Context navigation (within a Case)

When you're inside a Case, navigation is contextual — tabs or sections within the case workspace (Overview, Estimate, Production, Parts, Funding, Documents, Communications, History). You don't leave the case to do case work.

### Top bar (thin)

```
┌──────────────────────────────────────────────────────────┐
│ ← back   Case 4711 · Audi A4 · AB12345    🔔  ⌘K  👤 Mette│
└──────────────────────────────────────────────────────────┘
```

Breadcrumb/context on the left, notifications + command palette + user on the right. No menu bar. No ribbon. No tabs-of-modules.

### Keyboard shortcuts (desktop)

Linear-grade. A few examples:
- `⌘K` — command palette
- `C` — create case
- `G` then `O` — go to Operations Center
- `G` then `P` — go to Production Board
- `G` then `C` — go to Cases
- `/` — focus search
- `?` — show shortcut help
- Within a case: `S` — change status, `A` — assign, `N` — add note, `P` — add photo

Shortcuts are discoverable (`?`), never required. Power users fly; new users click.

---

## 4. Operations Center Design

The home. Not a dashboard. It answers one question: **"What requires attention right now?"** — and never "What charts can I look at?"

### Core structure (three zones)

```
┌───────────────────────────────────────────────────────────────────┐
│ Operations Center                          Oslo Sentrum · Tue 09:14│
├───────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ATTENTION ZONE  — what needs action now, prioritized              │
│  ┌─────────────────────────────────────────────────────────────┐  │
│  │ 🔴 Case 4682 — promised today, still in paint cure          │  │
│  │ 🔴 Case 4720 — supplement awaiting insurer 4 days           │  │
│  │ 🟡 7 cases awaiting parts (2 with ETA changes today)        │  │
│  │ 🟡 Paint booth booked solid through Friday                  │  │
│  │ 🟡 Lars overloaded — 3 cases due this week                  │  │
│  └─────────────────────────────────────────────────────────────┘  │
│                                                                     │
│  FLOW ZONE  — the operational picture for this role                │
│  ┌─────────────────────────────────────────────────────────────┐  │
│  │ [role-adaptive: production flow / my queue / intake pipeline]│  │
│  └─────────────────────────────────────────────────────────────┘  │
│                                                                     │
│  PULSE ZONE  — the few live numbers that matter to this role       │
│  ┌──────────┬──────────┬──────────┬──────────┬──────────┐         │
│  │ Active   │ Due today│ At risk  │ Booth    │ Available │         │
│  │   32     │    3     │   2 🔴   │ 92%      │  7/9 tech │         │
│  └──────────┴──────────┴──────────┴──────────┴──────────┘         │
└───────────────────────────────────────────────────────────────────┘
```

### Key behaviors

- **Every attention item is actionable.** Click it → you're taken to the case or the place where you resolve it. Nothing is decorative.
- **Prioritized by urgency**, not by category. The most time-critical thing is at the top. Red before yellow. Promised-today before due-next-week.
- **Real-time.** Items appear and clear as conditions change. A part arriving clears its attention item live.
- **Role-adaptive.** The Flow Zone and the Pulse numbers differ by role (see § 6-10). The structure stays identical so the product feels coherent.
- **No charts here.** Charts live in Insights. The Operations Center is operational, not analytical. The only "numbers" are the handful of live operational counters in the Pulse Zone.
- **Quiet when quiet.** If nothing needs attention, the Attention Zone says so plainly ("All cases on track"). It does not invent things to show.

### What the Operations Center is NOT

- Not a grid of charts
- Not a BI dashboard
- Not a static report
- Not a feed of every event (that's the audit log)
- Not the same for everyone (it adapts to role)

---

## 5. Case Workspace Design

The Case is the center of gravity. Most users spend most of their time here. It must be the best-designed surface in the product. Think Linear issue or Notion page: everything about this case, beautifully organized, with inline actions, real-time.

### Desktop layout

```
┌──────────────────────────────────────────────────────────────────────┐
│ ← Cases   Case 4711 · Audi A4 · AB12345              [Transfer] [⋯]   │
│ 🟢 In paint application · Oslo Sentrum · Paint dept                    │
├────────────────────────────────────────────┬───────────────────────────┤
│                                            │  DELIVERY                  │
│  Overview  Estimate  Production  Parts     │  Fri 13 Jun · 0.72 conf.   │
│  Funding  Documents  Comms  History        │  🟡 medium risk            │
│ ──────────────────────────────────────     │  Blocker: paint cure       │
│                                            │                            │
│  ACTIVITY TIMELINE (Overview)              │  VEHICLE                   │
│                                            │  Audi A4 · silver · 2021   │
│  ● 09:12 Erik clocked in — paint app       │  AB12345 · WAUZZZ...       │
│  ● 08:40 Parts received: bumper bracket    │  Owner: DNB Leasing        │
│  ● 08:15 Status → In paint application     │  User: Ola Hansen          │
│  ● Yesterday Supplement approved (Fremtind)│                            │
│  ● Yesterday Erik completed body repair    │  FUNDING SOURCES           │
│  ● Mon Estimate locked (v2)                │  • Fremtind · claim 789    │
│  ● Mon Case created by Pia                 │    deductible 6,000 → Ola  │
│                                            │  • Ola Hansen · private    │
│  [Add note]  [Add photo]  [Change status]  │                            │
│                                            │  ASSIGNED                  │
│                                            │  Erik (paint)              │
│                                            │  Lars (body, done)         │
│                                            │                            │
│                                            │  QUICK ACTIONS             │
│                                            │  Transfer · Note · Photo   │
│                                            │  Status · Print · Notify   │
└────────────────────────────────────────────┴───────────────────────────┘
```

### The spine: the activity timeline

Every case has a chronological timeline of everything that happened — status changes, notes, photos, parts events, communications, transfers, supplements, clock events. Like a GitHub issue or Linear activity feed. This is the **Overview** and the answer to "what's the story of this case?"

It is generated from the same events that drive the system (doc 02 § Event architecture), so it's always accurate and always complete. The audit trail and the timeline share a source; the timeline is the human-readable projection.

### The tabs (sections within the case)

| Tab | Contents |
|---|---|
| **Overview** | The activity timeline + current status + next actions |
| **Estimate** | The locked estimate, operations, parts, labor, paint — line by line, with funding source per line |
| **Production** | Work segments, their status, who's assigned, the schedule, the forecast detail |
| **Parts** | Part requirements with lifecycle (ordered → received → invoiced), missing parts, returns |
| **Funding** | The funding sources, allocations, deductibles, invoice basis per payer |
| **Documents** | Photos (before/during/after), DBS files, signed agreements, insurance docs |
| **Comms** | SMS and email history with the customer and insurer |
| **History** | The full audit detail (for those with permission) |

The side panel (delivery, vehicle, funding, assigned, quick actions) is **persistent** across tabs. The key facts never leave your sight.

### Inline everything

- Change status: click the status pill → pick the new state (permission-checked)
- Add a note: type at the bottom of the timeline
- Assign: click the assigned area → pick a person
- Upload a photo: drag onto the timeline or click Add photo
- No "edit mode." No modal-per-field. No save-and-reload. Optimistic updates, real-time sync.

### Mobile case view

On a phone, the case collapses to a single scrollable column: header (status, vehicle, delivery) → the primary action for the current context → the timeline → expandable sections. Technicians mostly land directly on the case they're working from their queue (§ 9), not by browsing.

---

## 6. Production Management Experience

The Production Manager's primary surface is the **Production Board** — a modern workflow board, not a report screen. This is the experience that most differentiates VerkstedOS from legacy ERP.

### The Production Board

```
┌────────────────────────────────────────────────────────────────────────┐
│ Production Board · Oslo Sentrum    Group by: Status ▾  Filter ▾  ⌘K     │
├──────────┬──────────┬──────────┬──────────┬──────────┬──────────────────┤
│ AWAITING │ READY    │ BODY     │ PAINT    │ ASSEMBLY │ READY FOR        │
│ PARTS    │ TO START │ REPAIR   │          │ + QC     │ DELIVERY         │
│ (7)      │ (3)      │ (6)      │ (4)      │ (5)      │ (4)              │
├──────────┼──────────┼──────────┼──────────┼──────────┼──────────────────┤
│┌────────┐│┌────────┐│┌────────┐│┌────────┐│┌────────┐│┌────────┐        │
││4690 🟡 │││4731    │││4722    │││4711 🟢 │││4665 🔴 │││4651    │        │
││Toyota  │││Audi    │││VW      │││Audi    │││BMW     │││Volvo   │        │
││ETA Wed │││Lars    │││Anders  │││Erik    │││due now │││✓ ready │        │
│└────────┘│└────────┘│└────────┘│└────────┘│└────────┘│└────────┘        │
│┌────────┐│          │┌────────┐│┌────────┐│          │┌────────┐        │
││4682 🔴 ││          ││4699    │││4690    ││          ││4644    │        │
││Bolt AS │          ││Per     │││cure    ││          ││✓ ready │        │
││promised│          ││        │││→14:30  ││          ││        │        │
│└────────┘│          │└────────┘│└────────┘│          │└────────┘        │
└──────────┴──────────┴──────────┴──────────┴──────────┴──────────────────┘
```

### Behaviors

- **Cards = cases.** Each card shows what a manager needs at a glance: case number, vehicle, assigned tech, risk indicator (🔴🟡🟢), and the one most relevant fact (ETA, due time, cure end).
- **Columns = workflow states** (configurable per org, from the workflow engine). Waiting states (Awaiting parts) are visually distinct from active states.
- **Drag to transition.** Drag a card from "Ready to start" to "Body repair" → the case transitions, the tech is notified, the event fires. Permission-checked; if you can't, the card won't drag.
- **Group by** Status (default), Department, Workshop, Technician, Insurer. Switching grouping re-renders the board instantly.
- **Swimlanes** when grouped (e.g. group by technician → each tech is a swimlane, instantly showing who's overloaded).
- **Filter** by funding source, insurer, risk, due date, parts status. Filters compose. Saved as views.
- **Real-time.** Cards move as states change anywhere in the system. A tech completing a segment on the floor moves the card live.
- **Click a card** → the Case Workspace. Always.

### The manager's other surfaces

- **Operations Center** (Flow Zone = production flow summary + bottlenecks) for the "what needs attention" loop
- **Capacity view** — a forward 14-day grid of resource load (people, paint booth, frame bench), reached from the Operations Center or Production Board, used when planning
- **Planning calendar** — drag-and-drop resource assignment (desktop), for deliberate planning sessions

The manager lives on the Production Board and the Operations Center. They visit Capacity and Planning when they need to plan. They rarely see a "report."

---

## 7. Workshop Owner / Operations Manager Experience

The owner wants **operational insight**, not executive BI. They care whether the workshop is healthy and moving, not about polished charts.

### Their Operations Center

Same structure, owner-tuned content:

- **Attention Zone:** cases at risk, cases stuck, supplements pending approval, anything that threatens delivery or margin
- **Flow Zone:** a compact health read — production moving / stalled, departments balanced / imbalanced, today's deliveries, this week's revenue trajectory
- **Pulse Zone:** active cases, due today, at risk, margin MTD vs target, utilization, rework rate

### Health at a glance (the owner's signature view)

The owner's Operations Center leads with traffic-light health across the dimensions that matter operationally:

```
🟢 Production    🟡 Capacity     🟢 Quality
32 active        Paint 92%       Rework 3.2%
24 on track      Body 78%        (target <5%)
2 red            Mech 56%

🟢 Financial     🟢 Cases moving  🟡 Insurers
Margin 18%       avg cycle 11d    If settling slow
(target 17%)     (target 12d)     (14 days avg)
```

Each tile is operational, not analytical: it tells the owner whether to act, and clicking drills into the cases or the surface where they act. "Margin 18%" isn't a chart to admire — it's a number that's green or red, and red means open the cases dragging it down.

### When the owner wants real analysis

That's **Insights** (§ 12) — a destination they visit deliberately, perhaps weekly, not the home they stare at all day. The home is operational. Insights is where trends, comparisons, and BI-style analysis live for when the question is "how are we trending?" rather than "what do I do now?"

---

## 8. Estimator Experience

Optimized for speed. The estimator processes 8-12 estimates a day; every saved click compounds.

### Their Operations Center

- **Attention Zone:** vehicles arriving today, estimates to complete, insurer responses overnight, customers awaiting a response, anything urgent (customer waiting at the counter)
- **Flow Zone:** the intake pipeline — vehicles in the funnel from arrival → assessment → estimate → locked → in production
- **Pulse Zone:** estimates done today, awaiting insurance, awaiting customer, avg cycle time

### The estimator's core loop (designed for speed)

```
Customer arrives
   → ⌘K → "new case" (or scan/type reg plate)
   → reg plate auto-fills vehicle (Vegvesen) + owner (1881)
   → confirm customer, assign funding source(s)
   → case created — under 90 seconds
   → drag DBS file onto the estimate tab
   → estimate parses, lines appear
   → allocate lines to funding sources (bulk-select + assign)
   → lock estimate
   → case flows into production automatically
```

Every step is keyboard-navigable. The DBS drop is the heaviest interaction; everything around it is fast. No page-hopping — the whole intake-to-locked-estimate flow happens in the Case Workspace.

### Insurance handling

The estimator's pending-insurance items live in their Operations Center Attention Zone and in a saved "Awaiting insurance" view. Supplements are created inside the case (Estimate tab → new version). Insurer responses arrive as notifications and as cleared/changed attention items. The estimator never hunts for "which cases are waiting on insurers" — it's always surfaced.

---

## 9. Technician Experience

Mobile-first. Touch-first. The technician should **never navigate complex menus**. They land on their work and do it.

### The technician's entire app is essentially: the queue + the current task + the case

```
┌──────────────────────────────┐
│ Erik · Painter        🔔 ⌘K  │
├──────────────────────────────┤
│  NOW                         │
│  ┌──────────────────────────┐│
│  │ Case 4711 · Audi A4      ││
│  │ Paint application        ││
│  │ Clocked in 47 min        ││
│  │                          ││
│  │ [⏸ Pause]  [✓ Complete] ││
│  │ 📷 Photo   ⚠ Flag issue  ││
│  └──────────────────────────┘│
│                              │
│  NEXT IN MY QUEUE            │
│  ┌──────────────────────────┐│
│  │ 4690 · Toyota · prep     ││
│  │ ready · booth 09:00 tmrw ││
│  └──────────────────────────┘│
│  ┌──────────────────────────┐│
│  │ 4711 · Audi · polish     ││
│  │ after cure               ││
│  └──────────────────────────┘│
└──────────────────────────────┘
```

### Behaviors

- **No menu navigation.** Open the app → see NOW (current task) + queue. That's the home.
- **Tap a queue item** → see the case essentials → clock in. One tap to start working.
- **Big touch targets** (≥56px), primary actions in the thumb zone, glove-and-wet-hands friendly.
- **The case, mobile-shaped.** Tapping into a case shows the technician what they need: what to do, parts status, reference photos, the flag-supplement button. Not the full desktop case workspace — the technician-relevant slice.
- **Flag supplement** is one prominent tap → photo + note + severity → submitted. The most important non-obvious action a technician takes.
- **Real-time queue.** When the manager re-prioritizes or a part arrives, the queue updates live.

The technician's mental model is never "I'm using software." It's "here's my next car." The command palette exists (⌘K / a search affordance) for the occasional lookup, but the queue does 95% of the work.

---

## 10. Parts Department Experience

The Parts Coordinator works across many cases at once. Their surface is organized by **parts needing action**, not by case. No ERP-style purchasing module complexity.

### The Parts surface

```
┌────────────────────────────────────────────────────────────────┐
│ Parts · Oslo Sentrum                          Filter ▾  ⌘K      │
├────────────────────────────────────────────────────────────────┤
│  NEEDS ACTION                                                   │
│  ┌────────────────────────────────────────────────────────────┐│
│  │ 🔴 Bumper bracket · Case 4690 · backordered, ETA changed   ││
│  │ 🔴 Headlight R · Case 4682 · not yet ordered, case in paint││
│  │ 🟡 3 parts to order · Case 4731 (estimate just locked)     ││
│  │ 🟡 Wrong part received · Case 4699 · initiate return       ││
│  └────────────────────────────────────────────────────────────┘│
│                                                                 │
│  IN FLIGHT                          RECONCILIATION              │
│  ┌──────────────────────┐          ┌──────────────────────────┐│
│  │ Ordered (47)         │          │ Invoices to match (8)    ││
│  │ Shipped (12)         │          │ Credits pending (2)      ││
│  │ Backordered (5) 🟡   │          │ Returns open (3)         ││
│  └──────────────────────┘          └──────────────────────────┘│
└────────────────────────────────────────────────────────────────┘
```

### Behaviors

- **Organized by action needed**, not by purchase order. "What do I need to do about parts right now?" is the question.
- **The part lifecycle is the spine** (doc 03): a part flows ordered → shipped → received → (maybe returned → credited → reordered). The coordinator sees where each part is and what's stuck.
- **Cross-case view.** One supplier invoice spanning four cases is reconciled here without hopping between four cases.
- **Click a part** → it takes you to the part's context (which can be the case Parts tab, or a part-detail panel). 
- **Reconciliation** (matching supplier invoices to received parts across cases) is a focused sub-surface, not buried in an accounting module.

No "Purchase Order Management" screen with twelve tabs. The coordinator sees what needs ordering, what's stuck, and what needs reconciling. The supplier-comparison complexity of generic ERP is deliberately absent (per the domain decision — Norwegian workshops order through fixed supplier agreements).

---

## 11. Dev Control Plane Experience

The platform team's surface. Reference: Stripe Admin, Supabase Dashboard, modern observability platforms. The aesthetic and interaction model differ deliberately from the customer-facing product — this is technical, dense, search-first.

### Global Search First

The defining principle. A single search bar (⌘K, but platform-scoped) searches **across all organizations** and **all entity types**:

```
⌘K (Dev Control Plane)
┌─────────────────────────────────────────────┐
│ 🔍 Search anything across all orgs...        │
├─────────────────────────────────────────────┤
│ Type:                                        │
│   AB12345        → vehicle + its cases       │
│   4711           → case 4711                 │
│   ola@...        → user                       │
│   claim 789      → insurance claim           │
│   inv-2026-...   → invoice                   │
│   evt_...        → event                      │
│   job_...        → Inngest job               │
│   org name       → organization              │
│   a UUID         → direct entity lookup      │
└─────────────────────────────────────────────┘
```

Everything is reachable by search: case, vehicle, customer, user, invoice, event, job, audit entry, organization. The platform engineer never navigates a tree — they search, land on an entity, and traverse its relationships.

### Entity detail pages (Stripe-style)

Every entity has a detail page where **everything about it lives** and every related object is a link:

```
┌──────────────────────────────────────────────────────────────┐
│ Case 4711 · org: Carlsen Bilskade · Oslo Sentrum             │
├──────────────────────────────────────────────────────────────┤
│ Raw record  │  Relationships  │  Timeline  │  Events  │ Audit │
├──────────────────────────────────────────────────────────────┤
│  { full JSON-inspectable record }                             │
│                                                               │
│  RELATIONSHIPS                  EVENTS (recent)               │
│   → vehicle AB12345             evt_a91 case.transferred      │
│   → customer Ola Hansen         evt_a87 production.state...   │
│   → estimate v2                 evt_a83 parts.received        │
│   → 3 funding sources           [view all · replay]           │
│   → 12 work segments                                          │
│   → production order            FAILED EVENTS: none           │
│                                                               │
│  REPAIR ACTIONS                 ACCESS LOG                    │
│   Rebuild forecast              Mette viewed 09:12            │
│   Replay events                 Pia edited 08:40             │
│   Recompute reconciliation      [full access log]            │
└──────────────────────────────────────────────────────────────┘
```

### The events/logs stream

Like Stripe's events view or a log explorer: a filterable, searchable stream of everything happening across the platform — events, jobs, failed events, integration calls, audit entries. Filter by org, type, time, status. Click any event → see its payload, its consumers, replay it.

### Behaviors

- **Search-first, always.** No deep navigation.
- **Everything links to everything.** From a case → its events → an event → its consumers → a failed consumer → the repair tool.
- **Dense and technical.** This is for engineers; data density is a feature, not a problem.
- **Repair tools inline** on the entities they affect (the "Rebuild forecast" button is on the case, not in a separate repair menu).
- **Audited.** Every view of sensitive data and every action is logged (doc 06).
- **Separate aesthetic.** It should *feel* like a different, more technical product than the customer app — because it is. 404 for non-platform users; they never know it exists.

---

## 12. Dashboard Strategy

Challenging the assumption directly: **VerkstedOS has almost no dashboards in the traditional sense.**

### Dashboards that should NOT exist

- ❌ A generic "main dashboard" with a grid of widgets
- ❌ Five separate role dashboards you navigate between (the doc-11 information is delivered through the role-adaptive Operations Center instead)
- ❌ Chart-heavy homepages
- ❌ Vanity-metric displays
- ❌ Any screen whose primary purpose is "look at charts" that you're expected to stare at all day

### What exists instead

| Surface | Type | Purpose | Is it the home? |
|---|---|---|---|
| **Operations Center** | Operational view | "What needs attention now?" | Yes (role-adaptive) |
| **Production Board** | Operational view | Manage flow, drag to progress | Manager's home |
| **Parts** | Operational view | Parts needing action | Coordinator's home |
| **Technician queue** | Operational view | My next work | Technician's home (mobile) |
| **Case Workspace** | Object workspace | Do the actual work | Where time is spent |
| **Insights** | Analytical destination | "How are we trending?" | No — visited deliberately |

### The operational vs analytical distinction

This is the core of the dashboard philosophy:

| Operational view | Analytical dashboard |
|---|---|
| Answers "what do I do now?" | Answers "how are we trending?" |
| Drives immediate action | Drives periodic decisions |
| Real-time | Periodic (daily/weekly) |
| The default surface (home) | A destination you visit on purpose |
| Every element is actionable | Elements are informational |
| Lives at the center of the product | Lives in Insights |

**Operational views are the product's home. Analytical dashboards are a deliberate destination called Insights.** This single distinction prevents VerkstedOS from becoming a dashboard-hopping ERP.

### What Insights contains (the one analytical area)

For owners and executives who genuinely need trend analysis: throughput trends, margin over time, insurer performance comparison, capacity utilization heatmaps, rework trends, workshop comparison (chains). All built on the same canonical calculations (SSoT). You go to Insights when you want to analyze; you don't live there. Every KPI in Insights is the same number shown operationally elsewhere — just rendered as a trend instead of a status.

---

## 13. Mobile Strategy

Not every screen exists on every device. The principle: **build the right workflow for the device the user actually has in that moment.**

### Device matrix

| Workflow | Phone | Tablet | Desktop |
|---|---|---|---|
| Technician: clock in/out, queue, current task | ✅ primary | ✅ | ○ possible |
| Technician: photos, flag supplement, status | ✅ primary | ✅ | ○ |
| Case workspace (full) | ○ slice only | ✅ | ✅ primary |
| Estimating / DBS import | ✗ | ○ walkaround | ✅ primary |
| Production Board | ○ view only | ✅ | ✅ primary |
| Planning calendar (drag-drop) | ✗ | ○ | ✅ primary |
| Parts coordination | ○ quick checks | ✅ | ✅ primary |
| Yard map | ✅ | ✅ primary | ✅ |
| Reconciliation | ✗ | ○ | ✅ primary |
| Operations Center | ○ role slice | ✅ | ✅ |
| Insights / analytics | ✗ | ○ | ✅ primary |
| Settings / admin | ✗ | ○ | ✅ |
| Dev Control Plane | ✗ | ○ | ✅ primary |
| Customer portal | ✅ primary | ✅ | ✅ |

✅ = first-class, designed for this device · ○ = works, not primary · ✗ = deliberately not built

### Mobile (phone) philosophy

- The phone is the **workshop-floor device**: technicians, yard moves, quick photos, quick lookups
- Touch-first, glove-friendly, big targets, thumb-zone actions
- Read-mostly when offline; writes require connectivity (no offline write conflicts on shared production state)
- The technician's phone experience is essentially the queue + the case slice — nothing else needed
- PWA (no native app in MVP); installs to home screen, works like an app

### Tablet philosophy

- The **shared / wall-mounted device**: production board on a wall, yard map near reception, checklists at the QC station, estimator walkaround
- Larger touch targets than desktop, but more density than phone
- Often a shared device (kiosk-style); fast user switching matters

### Desktop philosophy

- The **office device**: where the heavy work happens — estimating, planning, reconciliation, management, analytics, admin, Dev Control Plane
- Keyboard-first, command palette, dense, multi-pane
- The full Case Workspace, the full Production Board, everything

---

## 14. Key Screens Inventory

The complete set of surfaces. Notably short — that's the point.

### Customer-facing application

| Screen | Primary device | Purpose |
|---|---|---|
| Operations Center | Desktop / tablet | Role-adaptive home — what needs attention |
| Production Board | Desktop / tablet | Flow management, drag-to-progress |
| Cases (list + saved views) | Desktop | Filtered lists of cases |
| Case Workspace | Desktop (full) / mobile (slice) | The core work surface |
| Technician Queue | Mobile | My work, current task |
| Parts | Desktop / tablet | Parts needing action, reconciliation |
| Capacity view | Desktop | Forward resource load |
| Planning calendar | Desktop | Drag-drop resource assignment |
| Yard map | Tablet / mobile | Physical vehicle location |
| Insights | Desktop | Deliberate analytics destination |
| Intake / new case | Desktop / tablet | Fast case creation |
| Settings (org, workflow, roles, integrations) | Desktop | Configuration |
| Customer portal | Mobile / any | Customer self-service |

### Dev Control Plane (separate)

| Screen | Purpose |
|---|---|
| Global search | Search anything across all orgs |
| Entity detail pages | Everything about any object + relationships + repair |
| Events / logs stream | Filterable stream of events, jobs, failures, audit |
| Organizations | Org inspection, feature flags, health |
| Repair tools | Rebuild projections, replay events, reprocess |
| Monitoring / health | System, DB, queue, integration health |
| Emergency operations | Lock org, pause jobs, maintenance mode |
| Impersonation | Audited support access |

That's roughly **13 customer-facing screens and 8 Dev Control Plane screens.** Compare to a legacy workshop ERP's hundreds of menu items. The case-centric, search-first model collapses the surface area dramatically.

---

## 15. Wireframe Concepts (textual)

Wireframes for the surfaces not already shown above (Operations Center § 4, Case Workspace § 5, Production Board § 6, Parts § 10, technician queue § 9, Dev Control Plane § 11 are above).

### Cases — list with saved views

```
┌──────────────────────────────────────────────────────────────────┐
│ Cases          View: At risk ▾   + New   Group ▾  Filter ▾   ⌘K   │
├──────────────────────────────────────────────────────────────────┤
│ # ▾   Vehicle      Customer     Status        Due      Risk  Tech │
│ 4682  BMW 320      Bolt AS      In paint cure  today    🔴    Erik │
│ 4720  Audi Q5      Hansen       Awaiting appr. +2d      🔴    —    │
│ 4690  Toyota RAV4  Toyota Imp.  Awaiting parts Wed      🟡    Lars │
│ 4711  Audi A4      Hansen Ind.  In paint app   Fri      🟡    Erik │
│ ...                                                                │
├──────────────────────────────────────────────────────────────────┤
│ 14 cases · saved view "At risk" · updated live                    │
└──────────────────────────────────────────────────────────────────┘
```

Linear-style list. Saved views in the sidebar. Click a row → Case Workspace. Group/filter compose and save.

### Capacity view (production manager)

```
┌──────────────────────────────────────────────────────────────────┐
│ Capacity · Oslo Sentrum · next 14 days          ⌘K               │
├──────────────────────────────────────────────────────────────────┤
│           Mon  Tue  Wed  Thu  Fri  Sat  Sun  Mon  Tue  ...        │
│ Body      ▓▓░  ███  ███  ███  ███  ░░░  ░░░  ▓▓░  ███             │
│ Paint     ███  ███  ███⚠ ███⚠ ███⚠ ░░░  ░░░  ███  ███            │
│ Mech      ▓▓░  ▓▓░  ███  ███  ▓▓░  ░░░  ░░░  ▓▓░  ▓▓░             │
│ Calib     ░░░  ▓▓░  ▓▓░  ░░░  ▓▓░  ░░░  ░░░  ▓▓░  ░░░             │
│                                                                    │
│ Paint booth 97% Wed-Fri ⚠  ·  Frame bench 64%  ·  Calib rig 41%   │
│                                                                    │
│ [Simulate accepting a new case →]                                  │
└──────────────────────────────────────────────────────────────────┘
```

### Insights (analytical destination)

```
┌──────────────────────────────────────────────────────────────────┐
│ Insights · Oslo Sentrum    Period: Last 90 days ▾    Export  ⌘K   │
├──────────────────────────────────────────────────────────────────┤
│  Throughput trend          Margin trend           Cycle time      │
│   ╱╲    ╱╲                  ────╲___╱──            ──╲__╱─         │
│  ╱  ╲  ╱  ╲╱                                                       │
│                                                                    │
│  Insurer performance                  Rework rate trend           │
│   Fremtind  18% margin  8d settle      ──╲___ (improving)         │
│   If        15% margin  14d settle ⚠                              │
│   Gjensidige 19% margin  6d settle                                 │
│                                                                    │
│  (deliberate destination — not the home; same KPIs as operational │
│   surfaces, rendered as trends)                                    │
└──────────────────────────────────────────────────────────────────┘
```

### Intake / new case (estimator, fast)

```
┌──────────────────────────────────────────────┐
│ New case                              esc ✕  │
├──────────────────────────────────────────────┤
│ Registration plate                            │
│ [AB12345          ] 🔍                        │
│  ↳ Audi A4 · 2021 · silver (Vegvesen)         │
│  ↳ Owner: DNB Leasing · User: Ola Hansen      │
│                                               │
│ Customer (auto-filled, editable)              │
│ [Ola Hansen · 1881 ✓]                         │
│                                               │
│ Funding source                                │
│ ⦿ Insurance  ○ Private  ○ Mixed               │
│ Insurer: [Fremtind ▾]  Claim: [________]      │
│ Deductible: [6000] → payer: [Ola Hansen]      │
│ [+ Add another funding source]                │
│                                               │
│              [Cancel]   [Create case ⏎]       │
└──────────────────────────────────────────────┘
```

Keyboard-completable end to end. The whole thing is one focused surface, not a multi-page wizard.

---

## 16. Design Principles

The durable rules that guide every UX decision.

1. **Case-centric, not module-centric.** The Case is the object users work on. Everything connects through it. There is no "module" the user operates.

2. **Operational by default, analytical on purpose.** The home answers "what do I do now?" Charts and trends live in Insights, visited deliberately — never the default surface.

3. **Search and command over navigation.** ⌘K and global search are the primary way to move and act. Deep menu trees do not exist.

4. **Speed is a feature.** Optimistic updates, instant transitions, no save-and-reload, no page-hopping. The tool keeps up with the user's thinking.

5. **Progressive disclosure.** Simple by default; depth on demand. A new user sees what they need; a power user reveals more.

6. **Status is always visible.** Every object's state is clear and color-coded (🔴🟡🟢). The same color language everywhere.

7. **Actions where you need them.** Contextual, inline. Change status on the status pill, not in a distant menu. No hunting for the action.

8. **Real-time by default.** The product reflects reality as it changes. Cards move, attention items clear, queues update — live, without refresh.

9. **The right device for the right workflow.** Phone for the floor, desktop for the office, tablet shared. Not every screen on every device.

10. **Keyboard-first on desktop, touch-first on the floor.** Both done excellently, neither compromised for the other.

11. **Opinionated defaults.** The system makes smart choices (smart prioritization, sensible saved views, auto-routing by role). The user overrides when needed, but rarely needs to.

12. **Quiet when quiet.** When nothing needs attention, the product says so. It doesn't manufacture noise or vanity metrics to fill space.

---

## 17. UX Anti-Patterns to Avoid

The explicit "do not build this" list. If a design drifts toward any of these, stop.

1. ❌ **ERP-style module navigation** — "go to the Customers module, then the Orders submodule." No. Objects connect through the Case; you reach them via search.

2. ❌ **Deep menu trees** — nested menus three levels deep. Navigation is ⌘K and a short sidebar.

3. ❌ **Multiple disconnected dashboards** — Dashboard 1 through 5 that you tab between. One role-adaptive Operations Center.

4. ❌ **Page-hopping to complete one task** — bouncing through five screens to process one case. Work happens inside the Case Workspace.

5. ❌ **Information behind many clicks** — burying the delivery date or parts status three clicks deep. Key facts are always visible (persistent side panel).

6. ❌ **Chart-heavy homepages** — opening the app to a wall of graphs. The home is operational; charts are in Insights.

7. ❌ **Modal hell** — a modal that opens a modal that opens a modal. Inline editing and focused single-surface flows instead.

8. ❌ **Multi-page forms** — a wizard with eight pages to create one thing. The intake is one focused surface.

9. ❌ **Requiring navigation to find what needs attention** — making the user hunt for problems. The Operations Center surfaces them.

10. ❌ **Generic dashboards that don't drive action** — metrics you look at but can't act on. Every operational element is clickable to the work.

11. ❌ **Forcing desktop screens onto mobile** — cramming the full case workspace onto a phone. Build the device-appropriate slice.

12. ❌ **Notification overload** — alerting on everything until users ignore everything. Notifications are prioritized, role-filtered, and conservative by default.

13. ❌ **Edit-mode friction** — separate view and edit modes, save buttons everywhere. Inline, optimistic, real-time.

14. ❌ **Feature parity as a goal** — building every feature on every device because "consistency." The right workflow for the device beats uniformity.

15. ❌ **Making the user operate the software** — the user's job is to repair cars. Any UX that makes operating VerkstedOS feel like a job has failed.

---

## Relationship to other documents

- **Doc 11 (Dashboards)** — the per-role information inventory; this document defines the experience that delivers it. The six "dashboards" become role-adaptive renderings of the Operations Center plus the Case Workspace.
- **Doc 10 (Production Domain)** — the production model this UX surfaces (Production Board, capacity, forecast, multi-location).
- **Doc 05 (RBAC)** — role determines which Operations Center rendering, which sidebar items, which actions appear.
- **Doc 06 (Dev Control Plane)** — the Dev Control Plane UX in § 11 here realizes the capabilities specified there.
- **Doc 02 (System Architecture)** — the Case timeline (the spine of the Case Workspace) is a projection of the event stream.

## Implementation note

This is a UX architecture, not a visual design spec. It defines structure, behavior, and philosophy. Visual design (exact spacing, color values, typography, component styling) is produced during implementation using shadcn/ui and the design tokens, governed by the frontend-design conventions. The wireframes here are structural, not pixel-accurate.

Per the governance rules (CLAUDE.md): every UI feature still defines its Three Surfaces, follows the Database First Rule (the data model precedes the screen), uses canonical calculations (SSoT), and avoids cleverness. This UX architecture tells you *what the experience should be*; the governance tells you *how to build it correctly*.
