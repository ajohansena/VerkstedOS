/**
 * Demo Dataset v1 — `pnpm db:seed-demo`
 * ============================================================================
 * Creates a realistic Norwegian collision-repair workshop chain ("Johansen
 * Bilskade") so the application feels alive and supports manual testing. Uses
 * ONLY public module barrels (`@/modules/<context>/public`) — no schema/repo
 * deep imports, no direct DB writes except for workshop rows (no public
 * service exposes workshop creation today, mirroring the integration tests).
 *
 * Idempotent at the org level: aborts if an organization named
 * "Johansen Bilskade" already exists. Re-seed by dropping the database
 * (`pnpm db:migrate` against a fresh DB) and re-running.
 *
 * Includes:
 *   • 1 organization (Johansen Bilskade)
 *   • 3 workshops (Oslo Sentrum, Drammen Lakk, Lillestrøm Karosseri)
 *   • 10 employees across the six standard roles
 *   • 50 customers (mix of individuals + businesses)
 *   • 75 vehicles
 *   • 25 cases distributed across workshops + states
 *   • Photos (metadata-only — Storage adapter is gated)
 *   • QC checklist runs (Leveringssjekk / Kalibrering)
 *   • Signed approvals (manual + via job-card link) + digital signatures
 *   • Communication threads (SMS + email; outbound queued, inbound simulated)
 *   • Transfer history (A → B → A pattern across a handful of cases)
 *
 * Re-prints the seeded UUIDs at the end so they can be used with the
 * Sprint 12 dev-impersonation tool (`/dev/impersonation`).
 * ============================================================================
 */

import { randomUUID } from 'node:crypto';

import { eq } from 'drizzle-orm';
import postgres from 'postgres';

import { getRawClient } from '@/db/client';
import { organizations } from '@/db/schemas/identity/organizations';
import { roles } from '@/db/schemas/identity/roles';
import { seedInsuranceCompanies } from '@/lib/seed/insurance-companies';
import { seedNotificationRules } from '@/lib/seed/notification-rules';
import type { RequestContext } from '@/lib/tenancy/context';

import {
  addMembershipWithRole,
  createOrganizationWithOwner,
  ensureUser,
} from '@/modules/identity/public';
import {
  createCustomer,
  createVehicle,
  type CreateCustomerInput,
} from '@/modules/customer/public';
import {
  assignCaseToWorkshop,
  acceptTransfer,
  confirmArrival,
  createBooking,
  createCase,
  findActiveBookingForCase,
  initiateTransfer,
  type FundingSourceInput,
} from '@/modules/case/public';
import {
  addWorkSegment,
  assignResource,
  completeSegment,
  ensureProductionOrder,
  listWorkSegments,
  markSegmentActive,
  seedDefaultWorkflow,
  transitionState,
} from '@/modules/production/public';
import {
  createEmployee,
  createOfficeTask,
  createResource,
  listEmployees,
  listResources,
  type OfficeTaskKind,
  type OfficeTaskPriority,
} from '@/modules/workforce/public';
import {
  createPurchaseOrder,
  createSupplier,
  flagPartRequirement,
  listPartRequirements,
  listSuppliers,
  receiveParts,
  sendPurchaseOrder,
} from '@/modules/parts/public';
import {
  DEFAULT_CHECKLIST_TEMPLATES,
  appendSignature,
  createChecklistTemplate,
  listTemplateItems,
  respondToItem,
  signOffRun,
  startChecklistRun,
} from '@/modules/quality/public';
import { registerDocument } from '@/modules/documents/public';
import {
  ensureThread,
  recordManualAcceptance,
  requestAcceptance,
  respondViaJobCard,
  sendMessage,
  storeInboundMessage,
} from '@/modules/communication/public';

// ============================================================================
// Configuration
// ============================================================================

const ORG_NAME = 'Johansen Bilskade';
const OWNER_USER_ID = '00000000-0000-0000-0000-00000000d100';
const OWNER_EMAIL = 'olav@johansen-bilskade.no';
const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? 'https://demo.verkstedos.local';

const WORKSHOPS = [
  { name: 'Oslo Sentrum', city: 'Oslo' },
  { name: 'Drammen Lakk', city: 'Drammen' },
  { name: 'Lillestrøm Karosseri', city: 'Lillestrøm' },
] as const;

interface EmployeeSeed {
  fullName: string;
  email: string;
  role: 'admin' | 'estimator' | 'technician' | 'accounting' | 'viewer';
  workshopIndex: number;
  /** Display title used in seed log and admin pages. */
  jobTitle: string;
  /** Skill codes (work-segment catalog) — all 'qualified' by default. */
  skills: readonly string[];
}

// 15 employees + 1 owner. Each workshop has at least one
// verkstedsleder / estimator / body / paint coverage so the planner can
// always find a qualified resource for every segment kind shipped by
// the work-segment catalog.
const EMPLOYEES: readonly EmployeeSeed[] = [
  // --- Workshop 0: Oslo Sentrum (admin HQ) ---------------------------------
  {
    fullName: 'Anne Berg',
    email: 'anne@johansen.no',
    role: 'admin',
    workshopIndex: 0,
    jobTitle: 'Verkstedsleder',
    skills: ['qc'],
  },
  {
    fullName: 'Petter Hansen',
    email: 'petter@johansen.no',
    role: 'estimator',
    workshopIndex: 0,
    jobTitle: 'Estimator',
    skills: ['estimating'],
  },
  {
    fullName: 'Lars Olsen',
    email: 'lars@johansen.no',
    role: 'technician',
    workshopIndex: 0,
    jobTitle: 'Karosseriteknikker',
    skills: ['body', 'frame'],
  },
  {
    fullName: 'Ida Strand',
    email: 'ida@johansen.no',
    role: 'technician',
    workshopIndex: 0,
    jobTitle: 'Lakkerer',
    skills: ['paint'],
  },
  {
    fullName: 'Erik Lund',
    email: 'erik@johansen.no',
    role: 'technician',
    workshopIndex: 0,
    jobTitle: 'Mekaniker',
    skills: ['mechanical', 'electrical'],
  },
  {
    fullName: 'Bjørn Halvorsen',
    email: 'bjorn@johansen.no',
    role: 'accounting',
    workshopIndex: 0,
    jobTitle: 'Regnskap',
    skills: [],
  },

  // --- Workshop 1: Drammen Lakk (paint specialist) -------------------------
  {
    fullName: 'Silje Dahl',
    email: 'silje@johansen.no',
    role: 'estimator',
    workshopIndex: 1,
    jobTitle: 'Estimator',
    skills: ['estimating'],
  },
  {
    fullName: 'Mette Solberg',
    email: 'mette@johansen.no',
    role: 'technician',
    workshopIndex: 1,
    jobTitle: 'Lakkleder',
    skills: ['paint'],
  },
  {
    fullName: 'Hanne Moen',
    email: 'hanne@johansen.no',
    role: 'technician',
    workshopIndex: 1,
    jobTitle: 'Lakkerer',
    skills: ['paint', 'detailing'],
  },
  {
    fullName: 'Magnus Eide',
    email: 'magnus@johansen.no',
    role: 'technician',
    workshopIndex: 1,
    jobTitle: 'Karosseriteknikker',
    skills: ['body'],
  },
  {
    fullName: 'Trine Aas',
    email: 'trine@johansen.no',
    role: 'viewer',
    workshopIndex: 1,
    jobTitle: 'Kundemottak',
    skills: [],
  },

  // --- Workshop 2: Lillestrøm Karosseri (body + calibration) ---------------
  {
    fullName: 'Kai Eriksen',
    email: 'kai@johansen.no',
    role: 'technician',
    workshopIndex: 2,
    jobTitle: 'Karosserileder',
    skills: ['body', 'frame'],
  },
  {
    fullName: 'Maria Nilsen',
    email: 'maria@johansen.no',
    role: 'technician',
    workshopIndex: 2,
    jobTitle: 'Lakkerer',
    skills: ['paint'],
  },
  {
    fullName: 'Henrik Sand',
    email: 'henrik@johansen.no',
    role: 'technician',
    workshopIndex: 2,
    jobTitle: 'Karosseriteknikker',
    skills: ['body'],
  },
  {
    fullName: 'Tor Bakke',
    email: 'tor@johansen.no',
    role: 'technician',
    workshopIndex: 2,
    jobTitle: 'ADAS + KK-tekniker',
    skills: ['qc', 'calibration'],
  },
] as const;

// Equipment + facility resources per workshop. Mirrors the
// `requiredEquipmentKinds` produced by the work-segment catalog so the
// planner always has a qualified resource for every booked segment.
interface CanonicalResourceSeed {
  /** Name shown in the admin UI and planner lanes. */
  name: string;
  kind: 'equipment' | 'facility';
  /** equipment_kind hint stored in `resources.metadata.kind`. */
  equipmentKind: string;
}

const CANONICAL_RESOURCES_PER_WORKSHOP: readonly CanonicalResourceSeed[] = [
  {
    name: 'Lakkboks 1',
    kind: 'facility',
    equipmentKind: 'paint_booth',
  },
  {
    name: 'Lakkforberedelse',
    kind: 'facility',
    equipmentKind: 'prep_bay',
  },
  {
    name: 'Løftebukk A',
    kind: 'equipment',
    equipmentKind: 'lift',
  },
  {
    name: 'Løftebukk B',
    kind: 'equipment',
    equipmentKind: 'lift',
  },
  {
    name: 'Rammebenk',
    kind: 'equipment',
    equipmentKind: 'frame_bench',
  },
  {
    name: 'ADAS-rigg',
    kind: 'equipment',
    equipmentKind: 'adas_rig',
  },
  {
    name: 'Hjulstillingsrigg',
    kind: 'equipment',
    equipmentKind: 'alignment_rig',
  },
] as const;

// Norwegian name pools (small, deterministic).
const FIRST_NAMES = [
  'Ola',
  'Kari',
  'Anne',
  'Per',
  'Lars',
  'Mette',
  'Bjørn',
  'Trine',
  'Erik',
  'Hanne',
  'Geir',
  'Ingrid',
  'Tor',
  'Marit',
  'Knut',
  'Liv',
  'Arne',
  'Berit',
  'Jan',
  'Astrid',
  'Sigrid',
  'Magnus',
  'Helene',
  'Tom',
  'Eva',
  'Henrik',
  'Maria',
  'Petter',
  'Solveig',
  'Kristian',
  'Anita',
  'Olav',
  'Ragnhild',
  'Stein',
  'Vibeke',
  'Roar',
  'Mona',
  'Jens',
  'Linda',
  'Frode',
  'Inger',
  'Espen',
  'Kjersti',
  'Morten',
  'Heidi',
  'Andreas',
  'Camilla',
  'Daniel',
  'Else',
  'Silje',
];
const LAST_NAMES = [
  'Hansen',
  'Johansen',
  'Olsen',
  'Larsen',
  'Andersen',
  'Nilsen',
  'Pedersen',
  'Kristiansen',
  'Jensen',
  'Karlsen',
  'Eriksen',
  'Berg',
  'Lund',
  'Solberg',
  'Halvorsen',
  'Bakke',
  'Strand',
  'Næss',
  'Aas',
  'Dahl',
  'Eide',
  'Holm',
  'Moen',
  'Sand',
  'Sætre',
];
const BUSINESSES = [
  'Oslo Frakt AS',
  'Drammen Taxi AS',
  'Nordic Logistikk AS',
  'Bil & Bil AS',
  'Maxi Auto AS',
  'Bedrift Bil AS',
  'Akershus Kjøretøy AS',
  'Viken Transport AS',
  'Volvo Sentrum AS',
  'Lillestrøm Auto AS',
  'Solberg Eiendom AS',
  'Hansen & Sønner AS',
  'Bytransport AS',
  'Speditør Nord AS',
  'Express Auto AS',
];
const VEHICLES = [
  { make: 'Toyota', model: 'Auris', year: 2019 },
  { make: 'Toyota', model: 'RAV4', year: 2021 },
  { make: 'Volvo', model: 'V60', year: 2020 },
  { make: 'Volvo', model: 'XC60', year: 2022 },
  { make: 'Volvo', model: 'XC90', year: 2023 },
  { make: 'Tesla', model: 'Model 3', year: 2021 },
  { make: 'Tesla', model: 'Model Y', year: 2023 },
  { make: 'VW', model: 'Golf', year: 2018 },
  { make: 'VW', model: 'Passat', year: 2020 },
  { make: 'VW', model: 'ID.4', year: 2022 },
  { make: 'BMW', model: '320i', year: 2019 },
  { make: 'BMW', model: 'X3', year: 2021 },
  { make: 'Audi', model: 'A4', year: 2020 },
  { make: 'Audi', model: 'Q5', year: 2022 },
  { make: 'Skoda', model: 'Octavia', year: 2019 },
  { make: 'Mercedes', model: 'C220', year: 2021 },
  { make: 'Hyundai', model: 'Tucson', year: 2022 },
  { make: 'Kia', model: 'Sportage', year: 2020 },
  { make: 'Mazda', model: 'CX-5', year: 2021 },
  { make: 'Ford', model: 'Focus', year: 2018 },
];
const COLOURS = ['Sort', 'Hvit', 'Sølv', 'Grå', 'Blå', 'Rød', 'Mørk grønn'];
const REG_PREFIXES = [
  'BR',
  'DN',
  'EH',
  'EK',
  'EL',
  'EP',
  'FT',
  'HJ',
  'JK',
  'LR',
];

const INCIDENTS = [
  'Frontalkollisjon i lavt tempo',
  'Parkeringsskade bak',
  'Hjorteviltulykke',
  'Sideskade venstre',
  'Hagl- og lakkskade',
  'Steinsprang i frontruten',
  'Påkjørt bakfra på rødt lys',
  'Lett kollisjon i rundkjøring',
  'Skrapelakk fra parkeringshus',
  'Døravslag i parkering',
];

// The state path used to advance cases. Each "level" lets us pick a stopping
// point so the dataset shows the full lifecycle.
const STATE_PATH = [
  'received',
  'estimated',
  'approved',
  'awaiting_parts',
  'ready_for_disassembly',
  'in_disassembly',
  'in_body_repair',
  'in_paint_preparation',
  'in_paint_application',
  'in_paint_cure',
  'in_assembly',
  'in_quality_control',
  'ready_for_delivery',
  'delivered',
] as const;

// ============================================================================
// Deterministic helpers (so the dataset shape is stable run-to-run)
// ============================================================================

/** Tiny seeded PRNG (Mulberry32) so the same DB shape comes out every time. */
function makeRng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = makeRng(20260608);
const pick = <T>(arr: readonly T[]): T => arr[Math.floor(rand() * arr.length)]!;

function regNumber(i: number): string {
  const prefix = REG_PREFIXES[i % REG_PREFIXES.length]!;
  return `${prefix} ${(10000 + i * 137).toString().slice(-5)}`;
}

function phoneNumber(i: number): string {
  // Norwegian mobile: 4 or 9 prefix + 7 digits.
  const base = 40000000 + i * 31337;
  return `+47 ${base.toString().slice(0, 8)}`;
}

function emailFromName(name: string, i: number): string {
  const slug = name
    .toLowerCase()
    .replace(/æ/g, 'ae')
    .replace(/ø/g, 'o')
    .replace(/å/g, 'a')
    .replace(/[^a-z0-9]/g, '.');
  return `${slug}.${i}@example.no`;
}

// ============================================================================
// Main
// ============================================================================

async function main(): Promise<void> {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error('DATABASE_URL is not set.');
    process.exit(1);
  }
  const adminUrl = process.env.DATABASE_URL_ADMIN ?? url;

  console.log(`\n🛠️  Seeding demo dataset → "${ORG_NAME}"\n`);

  // --- Resume or create organization (entity-level idempotency) ------------
  // Every step below is safe to re-run: each entity creation checks existence
  // by a natural key (name, email, reg-no, code) before inserting. Re-running
  // after a crash picks up where it left off without producing duplicates.
  const admin = getRawClient({ as: 'admin' });
  const adminSql = postgres(adminUrl, { max: 2 });
  const existingOrg = await admin
    .select({ id: organizations.id })
    .from(organizations)
    .where(eq(organizations.name, ORG_NAME))
    .limit(1);

  let orgId: string;
  if (existingOrg[0]) {
    orgId = existingOrg[0].id;
    console.log(`↻ Resuming existing organization: ${orgId}`);
  } else {
    await ensureUser({
      id: OWNER_USER_ID,
      email: OWNER_EMAIL,
      fullName: 'Olav Johansen',
    });
    const { organization } = await createOrganizationWithOwner({
      name: ORG_NAME,
      ownerUserId: OWNER_USER_ID,
      orgNumber: '913 000 001',
    });
    orgId = organization.id;
    console.log(`✔ Organization created: ${orgId}`);
  }

  // --- Platform catalog (idempotent at source) -----------------------------
  const insurerCount = await seedInsuranceCompanies();
  console.log(`✔ Insurance catalog: ${insurerCount} companies (idempotent)`);

  const insurerSql = postgres(adminUrl, { max: 1 });
  const insurers = await insurerSql<
    { id: string; name: string }[]
  >`SELECT id, name FROM insurance_companies WHERE is_active = true ORDER BY name`;
  await insurerSql.end();

  await seedDefaultWorkflow(orgId); // idempotent
  console.log(`✔ Default production workflow ready`);

  const ruleCount = await seedNotificationRules(orgId); // idempotent
  console.log(`✔ Notification rules ready (${ruleCount})`);

  // --- Workshops (idempotent by (org, name)) -------------------------------
  const workshopIds: string[] = [];
  let workshopsCreated = 0;
  for (const w of WORKSHOPS) {
    const existing = await adminSql<{ id: string }[]>`
      SELECT id FROM workshops
      WHERE organization_id = ${orgId} AND name = ${w.name}
      LIMIT 1
    `;
    if (existing[0]) {
      workshopIds.push(existing[0].id);
      continue;
    }
    const rows = await adminSql<{ id: string }[]>`
      INSERT INTO workshops (organization_id, name, address)
      VALUES (${orgId}, ${w.name}, ${JSON.stringify({ city: w.city, country: 'NO' })}::jsonb)
      RETURNING id
    `;
    workshopIds.push(rows[0]!.id);
    workshopsCreated++;
  }
  console.log(
    `✔ Workshops ready (${workshopIds.length} total, ${workshopsCreated} new)`,
  );

  // --- Look up role ids for the org ----------------------------------------
  const roleRows = await admin
    .select({ id: roles.id, key: roles.key })
    .from(roles)
    .where(eq(roles.organizationId, orgId));
  const roleIdByKey = new Map<string, string>();
  for (const r of roleRows) {
    if (r.key) roleIdByKey.set(r.key, r.id);
  }

  // --- Employees (idempotent: lookup user by email; skip if membership exists) ---
  // Resolve owner id: if a user already exists with OWNER_EMAIL, reuse its id
  // rather than the hardcoded OWNER_USER_ID (which only applies on first run).
  const ownerLookup = await adminSql<{ id: string }[]>`
    SELECT id FROM users WHERE email = ${OWNER_EMAIL} LIMIT 1
  `;
  const resolvedOwnerId = ownerLookup[0]?.id ?? OWNER_USER_ID;
  if (!ownerLookup[0]) {
    await ensureUser({
      id: OWNER_USER_ID,
      email: OWNER_EMAIL,
      fullName: 'Olav Johansen',
    });
  }

  // System ctx for the bulk seed work. Owner has all permissions, so
  // every downstream service call goes through their context.
  // Constructed BEFORE the employees loop because `createEmployee` (called
  // from inside the loop) is a workforce service that requires a context.
  const sysCtx: RequestContext = {
    userId: resolvedOwnerId,
    organizationId: orgId,
    workshopId: workshopIds[0]!,
    accessibleWorkshopIds: [...workshopIds],
    correlationId: randomUUID(),
  };
  const ctxAt = (workshopId: string): RequestContext => ({
    ...sysCtx,
    workshopId,
    correlationId: randomUUID(),
  });

  // Pre-load existing employees so we can detect "already created" by
  // (email | fullName) and skip the createEmployee call. The workforce
  // module is the SSoT — we no longer bypass it (Sprint 22 Phase E).
  const existingEmployees = await listEmployees(sysCtx);
  const employeeByEmail = new Map<string, string>(); // email → employees.id
  const employeeByName = new Map<string, string>();
  for (const e of existingEmployees) {
    if (e.email) employeeByEmail.set(e.email.toLowerCase(), e.id);
    employeeByName.set(e.fullName, e.id);
  }

  const employeeIds: string[] = [resolvedOwnerId]; // for downstream user-id needs
  const employeeIdByEmail = new Map<string, string>(); // workforce.employees.id
  let employeesCreated = 0;
  let membershipsCreated = 0;
  for (const emp of EMPLOYEES) {
    // 1. User (auth). Reuse by email if present.
    const userLookup = await adminSql<{ id: string }[]>`
      SELECT id FROM users WHERE email = ${emp.email} LIMIT 1
    `;
    let userId: string;
    if (userLookup[0]) {
      userId = userLookup[0].id;
    } else {
      userId = randomUUID();
      await ensureUser({
        id: userId,
        email: emp.email,
        fullName: emp.fullName,
      });
    }
    employeeIds.push(userId);

    // 2. Membership + role. Skip if active membership already in this org.
    const memLookup = await adminSql<{ id: string }[]>`
      SELECT id FROM memberships
      WHERE organization_id = ${orgId} AND user_id = ${userId}
        AND deleted_at IS NULL
      LIMIT 1
    `;
    if (!memLookup[0]) {
      const roleId = roleIdByKey.get(emp.role);
      if (!roleId) throw new Error(`Missing role ${emp.role}`);
      await addMembershipWithRole({
        organizationId: orgId,
        userId,
        roleId,
        assignedByUserId: resolvedOwnerId,
        defaultWorkshopId: workshopIds[emp.workshopIndex] ?? null,
      });
      membershipsCreated++;
    }

    // 3. Employee + person Resource (canonical workforce path).
    // `createEmployee` auto-creates a `person` Resource in the same
    // transaction (Sprint 22 Phase B). Idempotent: skip if already present
    // by email or name.
    const existingId =
      employeeByEmail.get(emp.email.toLowerCase()) ??
      employeeByName.get(emp.fullName);
    if (existingId) {
      employeeIdByEmail.set(emp.email, existingId);
      continue;
    }
    const created = await createEmployee(
      ctxAt(workshopIds[emp.workshopIndex]!),
      {
        fullName: emp.fullName,
        email: emp.email,
        workshopId: workshopIds[emp.workshopIndex] ?? null,
        skills: emp.skills.map((skillCode) => ({
          skillCode,
          proficiency: 'qualified' as const,
        })),
      },
    );
    employeeIdByEmail.set(emp.email, created.id);
    employeesCreated++;
  }
  console.log(
    `✔ Employees ready (${employeeIds.length} users incl. owner, ` +
      `${membershipsCreated} memberships, ${employeesCreated} new employees ` +
      `with auto-created person Resources)`,
  );

  // --- Canonical workshop resources (equipment + facility) -----------------
  // Per-workshop fleet of facilities and equipment so the planner can
  // resolve `requiredEquipmentKinds` on every booked segment from the
  // standard work-segment catalog. People resources came in via
  // createEmployee above (Phase B auto-create).
  const existingResources = await listResources(sysCtx);
  const resourceKeyByName = new Map<string, string>(); // `${workshopId}|${name}` → id
  for (const r of existingResources) {
    resourceKeyByName.set(`${r.workshopId ?? ''}|${r.name}`, r.id);
  }
  let canonicalResourcesCreated = 0;
  const equipmentByWorkshop = new Map<string, Map<string, string>>(); // workshopId → kind → resourceId
  for (const workshopId of workshopIds) {
    const bucket = new Map<string, string>();
    for (const spec of CANONICAL_RESOURCES_PER_WORKSHOP) {
      const key = `${workshopId}|${spec.name}`;
      const existing = resourceKeyByName.get(key);
      if (existing) {
        bucket.set(`${spec.equipmentKind}:${spec.name}`, existing);
        continue;
      }
      const created = await createResource(ctxAt(workshopId), {
        kind: spec.kind,
        name: spec.name,
        workshopId,
        metadata: { kind: spec.equipmentKind, demoSeed: true },
      });
      bucket.set(`${spec.equipmentKind}:${spec.name}`, created.id);
      canonicalResourcesCreated++;
    }
    equipmentByWorkshop.set(workshopId, bucket);
  }
  console.log(
    `✔ Canonical workshop resources ready (${canonicalResourcesCreated} new ` +
      `equipment/facility resources across ${workshopIds.length} workshops)`,
  );

  // Pre-load all person Resources so segment-assignment can find the
  // right qualified technician per workshop. Reload after createEmployee
  // calls above so the bucket includes both pre-existing and freshly
  // auto-created person resources.
  const allResources = await listResources(sysCtx);
  const personResourceByEmployeeId = new Map<string, string>();
  for (const r of allResources) {
    if (r.kind === 'person' && r.employeeId) {
      personResourceByEmployeeId.set(r.employeeId, r.id);
    }
  }
  // Fast lookup: workshopId → array of person-resource ids
  const personResourcesByWorkshop = new Map<string, string[]>();
  for (const r of allResources) {
    if (r.kind !== 'person' || !r.workshopId) continue;
    const arr = personResourcesByWorkshop.get(r.workshopId) ?? [];
    arr.push(r.id);
    personResourcesByWorkshop.set(r.workshopId, arr);
  }

  // --- Checklist templates (idempotent by (org, code)) ---------------------
  const templateIdByCode = new Map<string, string>();
  let templatesCreated = 0;
  for (const tpl of DEFAULT_CHECKLIST_TEMPLATES) {
    const existing = await adminSql<{ id: string }[]>`
      SELECT id FROM checklist_templates
      WHERE organization_id = ${orgId} AND code = ${tpl.code}
      LIMIT 1
    `;
    if (existing[0]) {
      templateIdByCode.set(tpl.code, existing[0].id);
      continue;
    }
    const created = await createChecklistTemplate(sysCtx, {
      code: tpl.code,
      name: tpl.name,
      ...(tpl.kind ? { kind: tpl.kind } : {}),
      items: tpl.items.map((i) => ({ ...i })),
    });
    templateIdByCode.set(tpl.code, created.id);
    templatesCreated++;
  }
  console.log(
    `✔ QC checklist templates ready (${templateIdByCode.size} total, ${templatesCreated} new)`,
  );

  // --- Customers (idempotent by (org, name)) -------------------------------
  // Pre-load existing customers so we can match deterministic seed positions
  // back to their already-created IDs. We index by name because the script
  // generates a stable name per seed index (via PRNG + name pools).
  const existingCustomerRows = await adminSql<
    { id: string; name: string; primary_email: string | null }[]
  >`SELECT id, name, primary_email FROM customers WHERE organization_id = ${orgId}`;
  const existingCustomerByName = new Map<string, string>();
  for (const c of existingCustomerRows)
    existingCustomerByName.set(c.name, c.id);

  const customerIds: string[] = [];
  const customerContacts: { email: string; phone: string }[] = [];
  let customersCreated = 0;
  for (let i = 0; i < 50; i++) {
    const isBusiness = i % 5 === 0; // 10 of 50 are businesses
    const name = isBusiness
      ? BUSINESSES[i % BUSINESSES.length]!
      : `${pick(FIRST_NAMES)} ${pick(LAST_NAMES)}`;
    // Vary contactability so we exercise both SMS and email fallback paths:
    //   - 70% have both phone + email
    //   - 20% have only phone
    //   - 10% have only email (acceptance MUST fall back to email)
    const r = rand();
    const phone = r < 0.9 ? phoneNumber(i) : '';
    const email = r >= 0.2 ? emailFromName(name, i) : '';

    const existingId = existingCustomerByName.get(name);
    if (existingId) {
      customerIds.push(existingId);
      customerContacts.push({ email, phone });
      continue;
    }
    const input: CreateCustomerInput = {
      kind: isBusiness ? 'company' : 'individual',
      name,
      ...(phone ? { primaryPhone: phone } : {}),
      ...(email ? { primaryEmail: email } : {}),
      // Identifier omitted on purpose — generating valid Norwegian
      // org-no/personnummer checksums for fake data is out of scope.
    };
    const created = await createCustomer(sysCtx, input);
    customerIds.push(created.id);
    customerContacts.push({ email, phone });
    customersCreated++;
  }
  console.log(
    `✔ Customers ready (${customerIds.length} total, ${customersCreated} new)`,
  );

  // --- Vehicles (idempotent by (org, registration_number)) -----------------
  const existingVehicleRows = await adminSql<
    { id: string; registration_number: string }[]
  >`SELECT id, registration_number FROM vehicles WHERE organization_id = ${orgId}`;
  const existingVehicleByReg = new Map<string, string>();
  for (const v of existingVehicleRows)
    existingVehicleByReg.set(v.registration_number, v.id);

  const vehicleIds: string[] = [];
  const vehicleOwnerByVehicleIdx: number[] = []; // map vehicle idx → customer idx
  let vehiclesCreated = 0;
  for (let i = 0; i < 75; i++) {
    // Round-robin distribute to customers, but skip some so a few customers
    // have zero vehicles (realistic — walk-ins, pure-payer customers, etc.).
    const ownerIdx = (i * 2 + (i % 3)) % customerIds.length;
    const reg = regNumber(i);
    const existingId = existingVehicleByReg.get(reg);
    if (existingId) {
      vehicleIds.push(existingId);
      vehicleOwnerByVehicleIdx.push(ownerIdx);
      continue;
    }
    const spec = VEHICLES[i % VEHICLES.length]!;
    const ownership =
      i % 7 === 0 ? 'company_pool' : i % 11 === 0 ? 'leased' : 'private';
    const v = await createVehicle(sysCtx, {
      registrationNumber: reg,
      make: spec.make,
      model: spec.model,
      year: spec.year,
      colour: pick(COLOURS),
      ownerCustomerId: customerIds[ownerIdx]!,
      ownershipType: ownership,
    });
    vehicleIds.push(v.id);
    vehicleOwnerByVehicleIdx.push(ownerIdx);
    vehiclesCreated++;
  }
  console.log(
    `✔ Vehicles ready (${vehicleIds.length} total, ${vehiclesCreated} new)`,
  );

  // --- Cases ---------------------------------------------------------------
  // 30 cases. Distribute stop-states so the production board shows life
  // AND the Sprint 22 Phase D planner Booked-lane shows pure-booked cases:
  //   2 received (booked-only, no segments — Booked lane),
  //   2 estimated, 3 approved, 3 awaiting_parts,
  //   3 in_body_repair, 3 in_paint_application, 3 in_quality_control,
  //   3 ready_for_delivery, 3 delivered,
  //   5 received (additional pure-booked cases with future arrival dates)
  const STOP_STATES: readonly (typeof STATE_PATH)[number][] = [
    'received',
    'received',
    'estimated',
    'estimated',
    'approved',
    'approved',
    'approved',
    'awaiting_parts',
    'awaiting_parts',
    'awaiting_parts',
    'in_body_repair',
    'in_body_repair',
    'in_body_repair',
    'in_paint_application',
    'in_paint_application',
    'in_paint_application',
    'in_quality_control',
    'in_quality_control',
    'in_quality_control',
    'ready_for_delivery',
    'ready_for_delivery',
    'ready_for_delivery',
    'delivered',
    'delivered',
    'delivered',
    // Pure-booked cases for the Booked lane (no production work yet).
    'received',
    'received',
    'received',
    'received',
    'received',
  ];

  interface SeededCase {
    id: string;
    workshopId: string;
    stopState: (typeof STATE_PATH)[number];
    customerId: string;
    customerHasPhone: boolean;
    customerHasEmail: boolean;
  }
  const cases: SeededCase[] = [];

  // Pre-load existing cases for this org. If 30 exist, we resume by mapping
  // them to seed slots (so downstream blocks like photos / QC / signatures can
  // run idempotently against them). If 0 exist, we create all 30. Partial
  // case state (1..29) is not supported — re-running picks up from a clean
  // case block only.
  const existingCaseRows = await adminSql<
    {
      id: string;
      vehicle_id: string;
      primary_customer_id: string;
      current_workshop_id: string;
    }[]
  >`SELECT id, vehicle_id, primary_customer_id, current_workshop_id
     FROM cases WHERE organization_id = ${orgId} ORDER BY created_at`;
  const existingCaseCount = existingCaseRows.length;

  if (existingCaseCount === 30) {
    // Resume: rebuild SeededCase[] from DB, matching deterministic seed order
    // by vehicle_id (same vehicleIdx → same vehicle).
    for (let i = 0; i < 30; i++) {
      // Recompute deterministic indices to discover the expected vehicleIdx
      // for slot i, then find the matching DB row.
      const vehicleIdx = (i * 3) % vehicleIds.length;
      const customerIdx = vehicleOwnerByVehicleIdx[vehicleIdx]!;
      const expectedVehicleId = vehicleIds[vehicleIdx]!;
      const row = existingCaseRows.find(
        (r) => r.vehicle_id === expectedVehicleId,
      );
      if (!row) {
        throw new Error(
          `Resume: expected case for vehicle ${expectedVehicleId} (slot ${i}) not found`,
        );
      }
      cases.push({
        id: row.id,
        workshopId: row.current_workshop_id,
        stopState: STOP_STATES[i]!,
        customerId: customerIds[customerIdx]!,
        customerHasPhone: Boolean(customerContacts[customerIdx]!.phone),
        customerHasEmail: Boolean(customerContacts[customerIdx]!.email),
      });
      // Consume rand() calls that the create path would have made (funding +
      // misc), to keep downstream PRNG aligned with what photos/etc expect.
      rand(); // funding selector
      rand(); // coverage cap noise (sometimes used)
    }
    console.log(`↻ Cases resumed (${cases.length} loaded from DB)`);
  } else if (existingCaseCount !== 0) {
    throw new Error(
      `Cannot resume: found ${existingCaseCount} cases in org (expected 0 or 30). ` +
        `Either delete all cases for this org or restore to full 30.`,
    );
  } else
    for (let i = 0; i < 30; i++) {
      const vehicleIdx = (i * 3) % vehicleIds.length;
      const customerIdx = vehicleOwnerByVehicleIdx[vehicleIdx]!;
      const workshopId = workshopIds[i % workshopIds.length]!;
      const stopState = STOP_STATES[i]!;

      // Funding: 60% insurance with new claim, 30% private_pay, 10% mixed.
      const fundingSources: FundingSourceInput[] = [];
      const fund = rand();
      if (fund < 0.6 && insurers.length > 0) {
        const insurer = pick(insurers);
        fundingSources.push({
          kind: 'insurance',
          label: `Forsikring (${insurer.name})`,
          newClaim: {
            insuranceCompanyId: insurer.id,
            claimNumber: `JBSK-${(2000 + i).toString()}`,
          },
          coverageCapAmount: 75000 + Math.floor(rand() * 50000),
          deductibleAmount: 4000,
          deductiblePayerCustomerId: customerIds[customerIdx]!,
        });
      } else if (fund < 0.9) {
        fundingSources.push({
          kind: 'private_pay',
          label: 'Privatbetalt',
          payerCustomerId: customerIds[customerIdx]!,
        });
      } else if (insurers.length > 0) {
        const insurer = pick(insurers);
        fundingSources.push({
          kind: 'insurance',
          label: `Forsikring (${insurer.name})`,
          newClaim: {
            insuranceCompanyId: insurer.id,
            claimNumber: `JBSK-${(3000 + i).toString()}`,
          },
          deductibleAmount: 6000,
          deductiblePayerCustomerId: customerIds[customerIdx]!,
        });
        fundingSources.push({
          kind: 'private_pay',
          label: 'Egenbetalt tilleggsskade',
          payerCustomerId: customerIds[customerIdx]!,
        });
      }

      const created = await createCase(ctxAt(workshopId), {
        vehicleId: vehicleIds[vehicleIdx]!,
        primaryCustomerId: customerIds[customerIdx]!,
        incidentTag: pick(INCIDENTS),
        currentWorkshopId: workshopId,
        fundingSources,
      });

      // Production order + initial assignment.
      await ensureProductionOrder(ctxAt(workshopId), created.id);
      await assignCaseToWorkshop(ctxAt(workshopId), {
        caseId: created.id,
        workshopId,
        role: i % 2 === 0 ? 'body' : 'paint',
      });

      // Advance through the state path until we hit the stop state.
      for (const code of STATE_PATH) {
        if (code === 'received') continue; // initial state set by ensureProductionOrder
        await transitionState(ctxAt(workshopId), {
          caseId: created.id,
          toStateCode: code,
          reason: `Demo seed: ${code}`,
        });
        if (code === stopState) break;
      }

      cases.push({
        id: created.id,
        workshopId,
        stopState,
        customerId: customerIds[customerIdx]!,
        customerHasPhone: Boolean(customerContacts[customerIdx]!.phone),
        customerHasEmail: Boolean(customerContacts[customerIdx]!.email),
      });
    }
  console.log(
    `✔ ${cases.length} cases created with production state lifecycle`,
  );

  // --- Photos (metadata-only — Storage adapter gated) ----------------------
  let photoCount = 0;
  for (const c of cases) {
    const linkRoles = ['before_photo', 'during_photo', 'after_photo'] as const;
    const wanted = 2 + Math.floor(rand() * 4); // 2..5 photos per case
    for (let p = 0; p < wanted; p++) {
      const role = linkRoles[p % linkRoles.length]!;
      await registerDocument(ctxAt(c.workshopId), {
        kind: 'photo',
        sensitivity: 'internal',
        source: 'upload',
        originalFilename: `${role}_${p + 1}.jpg`,
        contentType: 'image/jpeg',
        byteSize: 250_000 + Math.floor(rand() * 1_500_000),
        linkedEntityType: 'case',
        linkedEntityId: c.id,
        linkRole: role,
        metadata: { demoSeed: true, sequence: p + 1 },
      });
      photoCount++;
    }
  }
  console.log(`✔ ${photoCount} photo documents registered (metadata-only)`);

  // --- QC checklist runs (for cases in_quality_control or beyond) ----------
  const deliveryTemplateId = templateIdByCode.get('delivery')!;
  const calibrationTemplateId = templateIdByCode.get('calibration')!;
  const deliveryItems = await listTemplateItems(sysCtx, deliveryTemplateId);
  const calibrationItems = await listTemplateItems(
    sysCtx,
    calibrationTemplateId,
  );
  let qcRuns = 0;
  for (const c of cases) {
    const isQcOrBeyond = [
      'in_quality_control',
      'ready_for_delivery',
      'delivered',
    ].includes(c.stopState);
    if (!isQcOrBeyond) continue;

    // Always do a delivery checklist.
    const run = await startChecklistRun(ctxAt(c.workshopId), {
      caseId: c.id,
      templateId: deliveryTemplateId,
    });
    for (const item of deliveryItems) {
      await respondToItem(ctxAt(c.workshopId), {
        runId: run.id,
        templateItemId: item.id,
        result: 'pass',
      });
    }
    await signOffRun(ctxAt(c.workshopId), run.id);
    qcRuns++;

    // ~30% also get a calibration checklist.
    if (rand() < 0.3) {
      const cal = await startChecklistRun(ctxAt(c.workshopId), {
        caseId: c.id,
        templateId: calibrationTemplateId,
      });
      for (const item of calibrationItems) {
        await respondToItem(ctxAt(c.workshopId), {
          runId: cal.id,
          templateItemId: item.id,
          result: 'pass',
        });
      }
      await signOffRun(ctxAt(c.workshopId), cal.id);
      qcRuns++;
    }
  }
  console.log(`✔ ${qcRuns} QC checklist runs completed`);

  // --- Acceptances + digital signatures ------------------------------------
  // Every case at 'approved' or beyond has an accepted customer approval.
  // Mix methods: ~50% via job-card link (token flow), ~30% manual, ~20% via
  // SMS reply. Delivered cases also get a delivery_handover signature.
  let acceptanceCount = 0;
  let signatureCount = 0;
  const APPROVED_OR_BEYOND = new Set<string>([
    'approved',
    'awaiting_parts',
    'in_body_repair',
    'in_paint_application',
    'in_quality_control',
    'ready_for_delivery',
    'delivered',
  ]);
  for (const c of cases) {
    if (!APPROVED_OR_BEYOND.has(c.stopState)) continue;

    const method = rand();
    if (method < 0.5 && (c.customerHasPhone || c.customerHasEmail)) {
      // Job-card link flow (preferred channel = SMS, fallback = email).
      const channel = c.customerHasPhone ? 'sms' : 'email';
      const contactValue =
        channel === 'sms'
          ? customerContacts[customerIds.indexOf(c.customerId)]!.phone
          : customerContacts[customerIds.indexOf(c.customerId)]!.email;
      const { acceptance } = await requestAcceptance(ctxAt(c.workshopId), {
        caseId: c.id,
        channel,
        contactValue,
        customerId: c.customerId,
        summary: 'Estimat sendt for godkjenning av reparasjon.',
        siteUrl: SITE_URL,
      });
      await respondViaJobCard(acceptance.token, 'accepted');
    } else if (method < 0.8) {
      await recordManualAcceptance(
        ctxAt(c.workshopId),
        c.id,
        'Bekreftet muntlig over telefon. Kunden ønsker oppstart.',
      );
    } else if (c.customerHasPhone) {
      // SMS reply path: request, then simulate inbound "OK" via internal API.
      const contactValue =
        customerContacts[customerIds.indexOf(c.customerId)]!.phone;
      const { acceptance } = await requestAcceptance(ctxAt(c.workshopId), {
        caseId: c.id,
        channel: 'sms',
        contactValue,
        customerId: c.customerId,
        summary: 'Vennligst svar OK for å godkjenne reparasjonen.',
        siteUrl: SITE_URL,
      });
      // Treat as accepted via the token flow (simulating the inbound handler).
      await respondViaJobCard(acceptance.token, 'accepted');
    } else {
      await recordManualAcceptance(
        ctxAt(c.workshopId),
        c.id,
        'Bekreftet ved oppmøte i resepsjon.',
      );
    }
    acceptanceCount++;

    // Repair acceptance signature (tamper-evident chain).
    await appendSignature(ctxAt(c.workshopId), {
      caseId: c.id,
      kind: 'repair_acceptance',
      signerKind: 'customer',
      signerName: 'Kunde (demo)',
      payload: JSON.stringify({
        caseId: c.id,
        text: 'Jeg godkjenner reparasjonen og estimatet.',
      }),
    });
    signatureCount++;

    if (c.stopState === 'delivered') {
      await appendSignature(ctxAt(c.workshopId), {
        caseId: c.id,
        kind: 'delivery_handover',
        signerKind: 'customer',
        signerName: 'Kunde (demo)',
        payload: JSON.stringify({
          caseId: c.id,
          text: 'Kjøretøy mottatt i ordnet stand.',
        }),
      });
      signatureCount++;
    }
  }
  console.log(
    `✔ ${acceptanceCount} customer acceptances + ${signatureCount} digital signatures`,
  );

  // --- Communication threads (SMS + email; outbound queued, inbound sim'd)--
  let threadCount = 0;
  let messageCount = 0;
  const ACTIVE_FOR_COMMS = new Set<string>([
    'estimated',
    'approved',
    'awaiting_parts',
    'in_body_repair',
    'in_paint_application',
    'in_quality_control',
    'ready_for_delivery',
  ]);
  for (const c of cases) {
    if (!ACTIVE_FOR_COMMS.has(c.stopState)) continue;
    if (!c.customerHasPhone && !c.customerHasEmail) continue;

    const contactIdx = customerIds.indexOf(c.customerId);
    const phone = customerContacts[contactIdx]!.phone;
    const email = customerContacts[contactIdx]!.email;
    const channel: 'sms' | 'email' = phone ? 'sms' : 'email';
    const contact = channel === 'sms' ? phone : email;

    const thread = await ensureThread(ctxAt(c.workshopId), {
      caseId: c.id,
      channel,
      contactValue: contact,
      customerId: c.customerId,
      subject: 'Statusoppdatering',
    });
    threadCount++;

    // Outbound update (queued — no provider).
    await sendMessage(ctxAt(c.workshopId), {
      threadId: thread.id,
      channel,
      contactValue: contact,
      body:
        c.stopState === 'awaiting_parts'
          ? 'Hei! Vi venter på deler. Forventet oppstart neste uke.'
          : c.stopState === 'ready_for_delivery'
            ? 'Hei! Bilen din er klar for henting. Velkommen!'
            : 'Hei! Reparasjonen er i gang. Vi gir beskjed når den nærmer seg ferdig.',
      subject: 'Statusoppdatering fra Johansen Bilskade',
    });
    messageCount++;

    // ~40% get a simulated inbound reply.
    if (rand() < 0.4) {
      await storeInboundMessage({
        organizationId: orgId,
        threadId: thread.id,
        channel,
        body: rand() < 0.5 ? 'Tusen takk for oppdateringen!' : 'OK, ses snart.',
      });
      messageCount++;
    }
  }
  console.log(
    `✔ ${threadCount} communication threads, ${messageCount} messages`,
  );

  // --- Transfer history (A → B → A) ----------------------------------------
  // Pick 4 cases that haven't started body work yet and route them through
  // a second workshop and back. Uses the Sprint 13 multi-location flow.
  const TRANSFERABLE = cases.filter((c) =>
    ['estimated', 'approved'].includes(c.stopState),
  );
  const transferCases = TRANSFERABLE.slice(0, 4);
  let transferEvents = 0;
  for (const c of transferCases) {
    const other = workshopIds.find((id) => id !== c.workshopId)!;
    // A → B
    const t1 = await initiateTransfer(ctxAt(c.workshopId), {
      caseId: c.id,
      toWorkshopId: other,
      transportMode: 'tow',
      reason: 'Til spesialavdeling',
    });
    await acceptTransfer(ctxAt(other), t1.id);
    await confirmArrival(ctxAt(other), t1.id, 'paint');
    transferEvents++;

    // B → A (back)
    const t2 = await initiateTransfer(ctxAt(other), {
      caseId: c.id,
      toWorkshopId: c.workshopId,
      transportMode: 'drive',
      reason: 'Tilbake til hjemmeverksted',
    });
    await acceptTransfer(ctxAt(c.workshopId), t2.id);
    await confirmArrival(ctxAt(c.workshopId), t2.id, 'assembly');
    transferEvents++;
  }
  console.log(
    `✔ ${transferEvents} transfers across ${transferCases.length} cases`,
  );

  // ========================================================================
  // Sprint 22 Phase E — Production planning data
  //
  // Everything below produces a "workshop that has been actively operating
  // for weeks" rather than a freshly-created shell:
  //   1. Work segments + resource assignments (per case, mapped to its
  //      lifecycle stage so the Day / Week / Resource views show real work)
  //   2. Office tasks (mixed kinds, priorities, due dates, assignees)
  //   3. Parts flow (requirements → PO → partial/full receipts)
  //   4. Bookings (pure-booked cases for the Booked lane + booking-on-existing
  //      cases that exercise the Phase D unified-lifecycle PlannerRow)
  // ========================================================================

  // --- Timing helpers ------------------------------------------------------
  // Anchor at "today 08:00 UTC" so re-running the seed always produces data
  // near the current planner window. The dataset uses Mon-Fri this week as
  // the working span, with a few future bookings 2-7 days out.
  const _now = new Date();
  const todayStart = new Date(
    Date.UTC(
      _now.getUTCFullYear(),
      _now.getUTCMonth(),
      _now.getUTCDate(),
      0,
      0,
      0,
      0,
    ),
  );
  /** offsetDays + hour → UTC Date. Hour 8 = "morning" in the demo. */
  function dayAt(offsetDays: number, hour: number, minute = 0): Date {
    const d = new Date(todayStart);
    d.setUTCDate(d.getUTCDate() + offsetDays);
    d.setUTCHours(hour, minute, 0, 0);
    return d;
  }

  // Segment recipes per case stop-state. Each step is a (segmentCode,
  // plannedMinutes) pair; per-case scheduling spreads them across the
  // current planner window relative to the case lifecycle phase.
  interface SegmentRecipe {
    code: string;
    plannedMinutes: number;
    /** Which work pool the planner should draw a person resource from. */
    skill: 'body' | 'paint' | 'qc' | 'mechanical';
    /** Equipment kind, if any, that should also be co-booked. */
    equipmentKind?:
      | 'paint_booth'
      | 'prep_bay'
      | 'lift'
      | 'frame_bench'
      | 'adas_rig';
  }
  const LIGHT_REPAIR_RECIPE: readonly SegmentRecipe[] = [
    {
      code: 'disassembly',
      plannedMinutes: 90,
      skill: 'body',
      equipmentKind: 'lift',
    },
    {
      code: 'body_repair',
      plannedMinutes: 180,
      skill: 'body',
      equipmentKind: 'lift',
    },
    {
      code: 'paint_preparation',
      plannedMinutes: 120,
      skill: 'paint',
      equipmentKind: 'prep_bay',
    },
    {
      code: 'paint_application',
      plannedMinutes: 150,
      skill: 'paint',
      equipmentKind: 'paint_booth',
    },
    {
      code: 'assembly',
      plannedMinutes: 90,
      skill: 'body',
      equipmentKind: 'lift',
    },
    { code: 'quality_control', plannedMinutes: 45, skill: 'qc' },
  ];
  const HEAVY_REPAIR_RECIPE: readonly SegmentRecipe[] = [
    {
      code: 'disassembly',
      plannedMinutes: 120,
      skill: 'body',
      equipmentKind: 'lift',
    },
    {
      code: 'structural_repair',
      plannedMinutes: 240,
      skill: 'body',
      equipmentKind: 'frame_bench',
    },
    {
      code: 'body_repair',
      plannedMinutes: 240,
      skill: 'body',
      equipmentKind: 'lift',
    },
    {
      code: 'paint_preparation',
      plannedMinutes: 180,
      skill: 'paint',
      equipmentKind: 'prep_bay',
    },
    {
      code: 'paint_application',
      plannedMinutes: 240,
      skill: 'paint',
      equipmentKind: 'paint_booth',
    },
    {
      code: 'assembly',
      plannedMinutes: 150,
      skill: 'body',
      equipmentKind: 'lift',
    },
    {
      code: 'calibration_adas',
      plannedMinutes: 90,
      skill: 'qc',
      equipmentKind: 'adas_rig',
    },
    { code: 'quality_control', plannedMinutes: 60, skill: 'qc' },
  ];

  // Which states have what progression. The value is the number of segments
  // (from the start of the recipe) that are 'completed', plus whether the
  // next one is 'in_progress'.
  const STATE_PROGRESS: Record<
    string,
    { completed: number; inProgress: boolean }
  > = {
    approved: { completed: 0, inProgress: false },
    awaiting_parts: { completed: 0, inProgress: false },
    in_body_repair: { completed: 1, inProgress: true },
    in_paint_application: { completed: 3, inProgress: true },
    in_quality_control: { completed: 5, inProgress: true },
    ready_for_delivery: { completed: 6, inProgress: false }, // recipe-length-dependent; clamped below
    delivered: { completed: 6, inProgress: false },
  };

  // Pick a person resource from a workshop's pool deterministically by
  // skill code. The catalog's required-skills aren't enforced here (no
  // public skills lookup), but using a workshop's person resources keeps
  // assignments visible in the Resource View.
  function pickPersonForWorkshop(
    workshopId: string,
    slot: number,
  ): string | null {
    const pool = personResourcesByWorkshop.get(workshopId);
    if (!pool || pool.length === 0) return null;
    return pool[slot % pool.length] ?? null;
  }
  function pickEquipmentForWorkshop(
    workshopId: string,
    equipmentKind: string,
  ): string | null {
    const bucket = equipmentByWorkshop.get(workshopId);
    if (!bucket) return null;
    for (const [key, id] of bucket) {
      if (key.startsWith(`${equipmentKind}:`)) return id;
    }
    return null;
  }

  // --- Section 1: Work segments + resource assignments ---------------------
  // Cases with stopState ∈ { approved, awaiting_parts, in_body_repair,
  // in_paint_application, in_quality_control, ready_for_delivery, delivered }
  // get segments. The 'received' / 'estimated' cases stay empty (no plan yet
  // — they appear via bookings if booked).
  const SEGMENT_STATES = new Set([
    'approved',
    'awaiting_parts',
    'in_body_repair',
    'in_paint_application',
    'in_quality_control',
    'ready_for_delivery',
    'delivered',
  ]);
  let segmentsCreated = 0;
  let assignmentsCreated = 0;
  let casesWithSegments = 0;
  for (let i = 0; i < cases.length; i++) {
    const c = cases[i]!;
    if (!SEGMENT_STATES.has(c.stopState)) continue;

    // Idempotent: skip if any segments already exist on this case.
    const existingSegs = await listWorkSegments(ctxAt(c.workshopId), c.id);
    if (existingSegs.length > 0) continue;

    // ~30% of cases use the heavy recipe; rest are light.
    const recipe = i % 3 === 0 ? HEAVY_REPAIR_RECIPE : LIGHT_REPAIR_RECIPE;
    const progress = STATE_PROGRESS[c.stopState] ?? {
      completed: 0,
      inProgress: false,
    };
    const completedCount = Math.min(progress.completed, recipe.length);

    // Schedule: completed segments in the past (Mon/Tue), in-progress today,
    // not_started future (Thu/Fri/next Mon). Spread per-case by index `i` so
    // assignments don't all collide at the same hour.
    //
    // Working window: 08:00 - 16:00 UTC. Each case slot is offset by 30 min
    // so the planner shows staggered work, not a wall of identical bars.
    const caseOffsetMin = (i % 6) * 30; // 0, 30, 60, 90, 120, 150 minutes

    casesWithSegments++;
    let prevWorkshopAssignmentSlot = i;
    for (let r = 0; r < recipe.length; r++) {
      const step = recipe[r]!;
      const seg = await addWorkSegment(ctxAt(c.workshopId), {
        caseId: c.id,
        segmentCode: step.code,
        plannedMinutes: step.plannedMinutes,
        plannedWorkshopId: c.workshopId,
      });
      segmentsCreated++;

      // Decide schedule + status for this segment.
      let dayOffset: number;
      let hour: number;
      let shouldComplete = false;
      let shouldStart = false;
      if (r < completedCount) {
        // Past completed work — Mon/Tue at staggered slots.
        dayOffset = r < 3 ? -2 : -1;
        hour = 8 + (r % 4); // 08, 09, 10, 11
      } else if (r === completedCount && progress.inProgress) {
        // Today's in-progress segment.
        dayOffset = 0;
        hour = 9;
        shouldStart = true;
      } else if (r === completedCount) {
        // Next-to-plan segment — tomorrow.
        dayOffset = 1;
        hour = 8 + ((r + prevWorkshopAssignmentSlot) % 4);
      } else {
        // Future plan — spread across Thu, Fri, next Mon.
        const futureDays = [1, 2, 5];
        dayOffset = futureDays[(r - completedCount) % 3]!;
        hour = 8 + ((r + prevWorkshopAssignmentSlot) % 4);
      }
      prevWorkshopAssignmentSlot++;
      const plannedStart = dayAt(dayOffset, hour, caseOffsetMin);
      const plannedEnd = new Date(
        plannedStart.getTime() + step.plannedMinutes * 60 * 1000,
      );

      // Pick a person resource at the case's workshop.
      const personId = pickPersonForWorkshop(c.workshopId, i + r);
      if (personId) {
        try {
          await assignResource(ctxAt(c.workshopId), {
            workSegmentId: seg.id,
            resourceId: personId,
            plannedStartAt: plannedStart,
            plannedEndAt: plannedEnd,
            allowConflict: true,
          });
          assignmentsCreated++;
        } catch {
          // ResourceConflictError can occur even with allowConflict=false on
          // re-runs of malformed states; skip gracefully.
        }
      }
      // Co-book equipment when the segment needs a specific facility.
      if (step.equipmentKind) {
        const equipId = pickEquipmentForWorkshop(
          c.workshopId,
          step.equipmentKind,
        );
        if (equipId) {
          try {
            await assignResource(ctxAt(c.workshopId), {
              workSegmentId: seg.id,
              resourceId: equipId,
              plannedStartAt: plannedStart,
              plannedEndAt: plannedEnd,
              role: 'assist',
              allowConflict: true,
            });
            assignmentsCreated++;
          } catch {
            // Same as above — ignore conflicts on the equipment dimension.
          }
        }
      }

      // Advance segment status to match the case state.
      if (shouldStart) {
        await markSegmentActive(ctxAt(c.workshopId), seg.id);
      } else if (r < completedCount) {
        await completeSegment(ctxAt(c.workshopId), seg.id);
        shouldComplete = true; // for typecheck only
      }
      void shouldComplete;
    }
  }
  console.log(
    `✔ ${segmentsCreated} work segments + ${assignmentsCreated} resource ` +
      `assignments across ${casesWithSegments} cases`,
  );

  // --- Section 2: Office tasks ---------------------------------------------
  // Realistic mix of kinds, priorities, due dates, assignees. Tasks are
  // idempotent by (org, title) for safe re-runs.
  const existingOfficeTaskRows = await adminSql<{ title: string }[]>`
    SELECT title FROM office_tasks
    WHERE organization_id = ${orgId} AND deleted_at IS NULL
  `;
  const existingOfficeTitles = new Set(
    existingOfficeTaskRows.map((r) => r.title),
  );

  interface OfficeTaskSeed {
    title: string;
    kind: OfficeTaskKind;
    priority: OfficeTaskPriority;
    /** Pick a case in this stop-state to link to (first match). null = standalone. */
    linkToState: (typeof STATE_PATH)[number] | null;
    /** Days from today. Negative = overdue. */
    dueDaysFromToday: number | null;
    assigneeJobTitle: string | null;
    description?: string;
  }
  const OFFICE_TASK_SEEDS: readonly OfficeTaskSeed[] = [
    {
      title: 'Bestill deler — Mercedes C220 (JBSK-2014)',
      kind: 'order_parts',
      priority: 'high',
      linkToState: 'awaiting_parts',
      dueDaysFromToday: 0,
      assigneeJobTitle: 'Estimator',
      description: 'Frontpanel + venstre forskjerm. Forsikringsdekket.',
    },
    {
      title: 'Følg opp forsinket pakke — Volvo XC60',
      kind: 'order_parts',
      priority: 'urgent',
      linkToState: 'awaiting_parts',
      dueDaysFromToday: -1,
      assigneeJobTitle: 'Estimator',
      description:
        'Leverandør lovet i forrige uke; sjekk status og varsle kunde.',
    },
    {
      title: 'Ring kunden — godkjenning av estimat',
      kind: 'customer_call',
      priority: 'normal',
      linkToState: 'estimated',
      dueDaysFromToday: 0,
      assigneeJobTitle: 'Kundemottak',
      description: 'Kunden har ikke svart på SMS. Ring og bekreft.',
    },
    {
      title: 'Informer forsikringsselskap — supplement nødvendig',
      kind: 'insurer_followup',
      priority: 'high',
      linkToState: 'in_body_repair',
      dueDaysFromToday: 1,
      assigneeJobTitle: 'Estimator',
    },
    {
      title: 'Bestill leiebil — Toyota RAV4',
      kind: 'rental_booking',
      priority: 'normal',
      linkToState: 'approved',
      dueDaysFromToday: 2,
      assigneeJobTitle: 'Kundemottak',
      description: 'Kunde ønsker tilsvarende størrelse. 5 dagers leie.',
    },
    {
      title: 'Forbered faktura — JBSK-2003',
      kind: 'invoice_prep',
      priority: 'low',
      linkToState: 'delivered',
      dueDaysFromToday: 3,
      assigneeJobTitle: 'Regnskap',
    },
    {
      title: 'Forbered faktura — JBSK-2009',
      kind: 'invoice_prep',
      priority: 'normal',
      linkToState: 'delivered',
      dueDaysFromToday: 1,
      assigneeJobTitle: 'Regnskap',
    },
    {
      title: 'Oppfølging etter levering — sjekk kundetilfredshet',
      kind: 'customer_followup',
      priority: 'low',
      linkToState: 'delivered',
      dueDaysFromToday: 5,
      assigneeJobTitle: 'Kundemottak',
    },
    {
      title: 'Bekreft leveringstidspunkt — Volvo V60',
      kind: 'customer_followup',
      priority: 'normal',
      linkToState: 'ready_for_delivery',
      dueDaysFromToday: 0,
      assigneeJobTitle: 'Kundemottak',
    },
    {
      title: 'Dokumenter ADAS-kalibrering for forsikring',
      kind: 'documentation',
      priority: 'normal',
      linkToState: 'in_quality_control',
      dueDaysFromToday: 2,
      assigneeJobTitle: 'ADAS + KK-tekniker',
    },
    {
      title: 'Sjekk verksted-vask leverandørkontrakt',
      kind: 'documentation',
      priority: 'low',
      linkToState: null, // standalone (no case)
      dueDaysFromToday: 7,
      assigneeJobTitle: 'Verkstedsleder',
    },
    {
      title: 'Gjennomgå månedsrapport HMS',
      kind: 'other',
      priority: 'normal',
      linkToState: null,
      dueDaysFromToday: 4,
      assigneeJobTitle: 'Verkstedsleder',
    },
  ];

  let officeTasksCreated = 0;
  for (const ts of OFFICE_TASK_SEEDS) {
    if (existingOfficeTitles.has(ts.title)) continue;
    // Pick a case matching the requested stop-state (first one). null → no caseId.
    const linkedCase =
      ts.linkToState != null
        ? (cases.find((c) => c.stopState === ts.linkToState) ?? null)
        : null;
    const workshopId = linkedCase?.workshopId ?? workshopIds[0]!;
    // Find an assignee resource by job title (via the employee email map +
    // person resource map). Falls back to no assignee if not matched.
    const assigneeEmployeeId = (() => {
      if (!ts.assigneeJobTitle) return null;
      const seed = EMPLOYEES.find((e) => e.jobTitle === ts.assigneeJobTitle);
      if (!seed) return null;
      return employeeIdByEmail.get(seed.email) ?? null;
    })();
    const assigneeResourceId = assigneeEmployeeId
      ? (personResourceByEmployeeId.get(assigneeEmployeeId) ?? null)
      : null;
    await createOfficeTask(ctxAt(workshopId), {
      title: ts.title,
      kind: ts.kind,
      priority: ts.priority,
      workshopId,
      caseId: linkedCase?.id ?? null,
      dueAt:
        ts.dueDaysFromToday != null ? dayAt(ts.dueDaysFromToday, 12) : null,
      assigneeResourceId,
      ...(ts.description ? { description: ts.description } : {}),
    });
    officeTasksCreated++;
  }
  console.log(`✔ ${officeTasksCreated} office tasks created`);

  // --- Section 3: Parts flow -----------------------------------------------
  // For cases in awaiting_parts / in_body_repair: flag requirements, build a
  // cross-case PO per supplier, send it, then partial/full receive.
  const PARTS_CASE_STATES = new Set(['awaiting_parts', 'in_body_repair']);
  const partsCases = cases.filter((c) => PARTS_CASE_STATES.has(c.stopState));

  // Suppliers — idempotent by (org, name).
  const existingSuppliers = await listSuppliers(sysCtx);
  const supplierByName = new Map<string, string>();
  for (const s of existingSuppliers) supplierByName.set(s.name, s.id);
  const supplierSeeds = [
    { name: 'Mekonomen Bildeler AS', orgNumber: '912 000 100' },
    { name: 'Bilglass Norge AS', orgNumber: '912 000 200' },
  ];
  for (const s of supplierSeeds) {
    if (supplierByName.has(s.name)) continue;
    const created = await createSupplier(sysCtx, s);
    supplierByName.set(s.name, created.id);
  }

  // Flag requirements per case (idempotent: skip cases with any existing reqs).
  // Realistic mix: front panel, headlight, fender, bumper, glass.
  const PART_TEMPLATES = [
    { description: 'Frontpanel', unitCostEstimate: '4500.00' },
    { description: 'Forskjerm venstre', unitCostEstimate: '3200.00' },
    { description: 'Frontlykt høyre', unitCostEstimate: '6800.00' },
    { description: 'Støtfanger fram', unitCostEstimate: '5400.00' },
    { description: 'Frontrute', unitCostEstimate: '8900.00' },
  ];
  const newRequirementsForOrdering: {
    requirementId: string;
    caseId: string;
    description: string;
    unitCostEstimate: string;
    supplierName: string;
  }[] = [];
  let partRequirementsCreated = 0;
  for (let idx = 0; idx < partsCases.length; idx++) {
    const c = partsCases[idx]!;
    const existing = await listPartRequirements(ctxAt(c.workshopId), c.id);
    if (existing.length > 0) continue;
    const partCount = 2 + (idx % 3); // 2..4 requirements per case
    for (let p = 0; p < partCount; p++) {
      const tpl = PART_TEMPLATES[(idx + p) % PART_TEMPLATES.length]!;
      const supplierName =
        tpl.description === 'Frontrute'
          ? 'Bilglass Norge AS'
          : 'Mekonomen Bildeler AS';
      const req = await flagPartRequirement(ctxAt(c.workshopId), {
        caseId: c.id,
        description: tpl.description,
        quantity: 1,
        unitCostEstimate: tpl.unitCostEstimate,
        source: 'manual',
      });
      partRequirementsCreated++;
      newRequirementsForOrdering.push({
        requirementId: req.id,
        caseId: c.id,
        description: tpl.description,
        unitCostEstimate: tpl.unitCostEstimate,
        supplierName,
      });
    }
  }

  // Build one PO per supplier covering all the new requirements. Each PO can
  // span multiple cases (the model supports it; TakstKontroll preserves
  // case-level traceability via the per-line caseId).
  const requirementsBySupplier = new Map<
    string,
    typeof newRequirementsForOrdering
  >();
  for (const r of newRequirementsForOrdering) {
    const arr = requirementsBySupplier.get(r.supplierName) ?? [];
    arr.push(r);
    requirementsBySupplier.set(r.supplierName, arr);
  }
  let purchaseOrdersCreated = 0;
  let receivedLines = 0;
  let poSeq = 0;
  for (const [supplierName, reqs] of requirementsBySupplier) {
    if (reqs.length === 0) continue;
    const supplierId = supplierByName.get(supplierName);
    if (!supplierId) continue;
    poSeq++;
    const po = await createPurchaseOrder(sysCtx, {
      supplierId,
      poNumber: `JBSK-PO-${String(2000 + poSeq).padStart(4, '0')}`,
      lines: reqs.map((r) => ({
        partRequirementId: r.requirementId,
        caseId: r.caseId,
        description: r.description,
        quantity: 1,
        unitPrice: r.unitCostEstimate,
      })),
    });
    await sendPurchaseOrder(sysCtx, po.id);
    purchaseOrdersCreated++;

    // Receive a subset. First supplier: fully receive ~60% of lines; second:
    // partial receive (we only have integer quantities in the demo so
    // "partial" is implemented as receiving 1 of 1 for some lines and 0 for
    // others — leaving those at status='ordered'). The reconciliation
    // calculation handles the mixed state correctly.
    const poLineRows = await adminSql<
      { id: string; quantity_ordered: string }[]
    >`
      SELECT id, quantity_ordered FROM purchase_order_lines
      WHERE organization_id = ${orgId} AND purchase_order_id = ${po.id}
      ORDER BY created_at
    `;
    const receiveRatio = poSeq === 1 ? 0.6 : 0.4;
    const receiveLines: {
      purchaseOrderLineId: string;
      quantityReceived: number;
    }[] = [];
    for (let li = 0; li < poLineRows.length; li++) {
      if (li / poLineRows.length < receiveRatio) {
        receiveLines.push({
          purchaseOrderLineId: poLineRows[li]!.id,
          quantityReceived: Number(poLineRows[li]!.quantity_ordered),
        });
      }
    }
    if (receiveLines.length > 0) {
      await receiveParts(sysCtx, {
        purchaseOrderId: po.id,
        lines: receiveLines,
        note: 'Demo seed — første mottak',
      });
      receivedLines += receiveLines.length;
    }
  }
  console.log(
    `✔ ${partRequirementsCreated} part requirements, ${purchaseOrdersCreated} ` +
      `purchase orders, ${receivedLines} lines received (rest stay at 'ordered')`,
  );

  // --- Section 4: Bookings -------------------------------------------------
  // Two flavours:
  //   a) Pure-booked cases (the last 5 slots, stopState='received', no
  //      segments) — these appear in the planner Booked lane with
  //      PlannerLifecycle='booked'.
  //   b) Bookings attached to in-progress cases (a few 'approved' / 'estimated'
  //      ones) — they appear with lifecycle='in_progress' and the booking is
  //      attached as context (Phase D continuous-lifecycle invariant).
  let bookingsCreated = 0;

  // (a) Pure-booked: cases with stopState='received' AND no segments. Slots
  // 25-29 are the dedicated booked-only cases. Spread arrival dates Thu..next
  // Wed so the Day and Week views both show non-empty Booked lanes.
  const pureBookedCases = cases.slice(25); // 5 cases
  for (let bi = 0; bi < pureBookedCases.length; bi++) {
    const c = pureBookedCases[bi]!;
    const existing = await findActiveBookingForCase(ctxAt(c.workshopId), c.id);
    if (existing) continue;
    const arrivalDayOffset = [1, 2, 3, 5, 6][bi % 5]!; // Thu/Fri/Mon/Wed/Thu
    const arrivalHour = 8 + (bi % 4);
    const promisedDayOffset = arrivalDayOffset + 5;
    await createBooking(ctxAt(c.workshopId), {
      caseId: c.id,
      workshopId: c.workshopId,
      expectedArrivalAt: dayAt(arrivalDayOffset, arrivalHour),
      promisedDeliveryAt: dayAt(promisedDayOffset, 15),
      confirmImmediately: bi % 2 === 0, // half tentative, half confirmed
      notes: 'Demo: ufordelt booking — planlegger må allokere ressurser.',
    });
    bookingsCreated++;
  }

  // (b) Context bookings: a few 'estimated' / 'approved' cases also get a
  // future booking (e.g. customer scheduled re-delivery / shop slot).
  const contextBookingCases = cases
    .filter((c) => ['estimated', 'approved'].includes(c.stopState))
    .slice(0, 3);
  for (let bi = 0; bi < contextBookingCases.length; bi++) {
    const c = contextBookingCases[bi]!;
    const existing = await findActiveBookingForCase(ctxAt(c.workshopId), c.id);
    if (existing) continue;
    await createBooking(ctxAt(c.workshopId), {
      caseId: c.id,
      workshopId: c.workshopId,
      expectedArrivalAt: dayAt(2 + bi, 9),
      promisedDeliveryAt: dayAt(7 + bi, 15),
      confirmImmediately: true,
      notes: 'Demo: planlagt slot for igangsatt sak.',
    });
    bookingsCreated++;
  }
  console.log(
    `✔ ${bookingsCreated} bookings created ` +
      `(${pureBookedCases.length} pure-booked + up to ${contextBookingCases.length} context bookings on in-progress cases)`,
  );

  await adminSql.end();

  // --- Summary --------------------------------------------------------------
  console.log(`\n🎉 Demo seed complete.\n`);
  console.log(`Organization : ${ORG_NAME} (${orgId})`);
  console.log(`Owner user   : ${OWNER_USER_ID} <${OWNER_EMAIL}>`);
  console.log(`Workshops    :`);
  WORKSHOPS.forEach((w, i) => console.log(`  - ${w.name} → ${workshopIds[i]}`));
  console.log(
    `\nTip: Use the dev-impersonation tool at /dev/impersonation to ` +
      `assume any seeded user without a Supabase auth session.\n`,
  );
  process.exit(0);
}

main().catch((err) => {
  console.error('\n❌  Demo seed failed:', err);
  process.exit(1);
});
