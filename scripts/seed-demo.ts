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
  createCase,
  initiateTransfer,
  type FundingSourceInput,
} from '@/modules/case/public';
import {
  ensureProductionOrder,
  seedDefaultWorkflow,
  transitionState,
} from '@/modules/production/public';
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
}

const EMPLOYEES: readonly EmployeeSeed[] = [
  {
    fullName: 'Anne Berg',
    email: 'anne@johansen.no',
    role: 'admin',
    workshopIndex: 0,
  },
  {
    fullName: 'Petter Hansen',
    email: 'petter@johansen.no',
    role: 'estimator',
    workshopIndex: 0,
  },
  {
    fullName: 'Silje Dahl',
    email: 'silje@johansen.no',
    role: 'estimator',
    workshopIndex: 1,
  },
  {
    fullName: 'Lars Olsen',
    email: 'lars@johansen.no',
    role: 'technician',
    workshopIndex: 0,
  },
  {
    fullName: 'Mette Solberg',
    email: 'mette@johansen.no',
    role: 'technician',
    workshopIndex: 1,
  },
  {
    fullName: 'Kai Eriksen',
    email: 'kai@johansen.no',
    role: 'technician',
    workshopIndex: 2,
  },
  {
    fullName: 'Maria Nilsen',
    email: 'maria@johansen.no',
    role: 'technician',
    workshopIndex: 2,
  },
  {
    fullName: 'Bjørn Halvorsen',
    email: 'bjorn@johansen.no',
    role: 'accounting',
    workshopIndex: 0,
  },
  {
    fullName: 'Trine Aas',
    email: 'trine@johansen.no',
    role: 'viewer',
    workshopIndex: 1,
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

  // --- Idempotency check ----------------------------------------------------
  const admin = getRawClient({ as: 'admin' });
  const existingOrg = await admin
    .select({ id: organizations.id })
    .from(organizations)
    .where(eq(organizations.name, ORG_NAME))
    .limit(1);
  if (existingOrg[0]) {
    console.error(
      `❌  Organization "${ORG_NAME}" already exists (id=${existingOrg[0].id}). ` +
        `Drop the database and re-run (\`pnpm db:migrate && pnpm db:seed-demo\`).`,
    );
    process.exit(1);
  }

  // --- Platform catalog -----------------------------------------------------
  const insurerCount = await seedInsuranceCompanies();
  console.log(`✔ Insurance catalog: ${insurerCount} companies (idempotent)`);

  // Read back insurer ids for funding sources.
  const insurerSql = postgres(adminUrl, { max: 1 });
  const insurers = await insurerSql<
    { id: string; name: string }[]
  >`SELECT id, name FROM insurance_companies WHERE is_active = true ORDER BY name`;
  await insurerSql.end();

  // --- Owner + organization -------------------------------------------------
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
  const orgId = organization.id;
  console.log(`✔ Organization created: ${orgId}`);

  await seedDefaultWorkflow(orgId);
  console.log(`✔ Default production workflow seeded`);

  // --- Workshops ------------------------------------------------------------
  const adminSql = postgres(adminUrl, { max: 2 });
  const workshopIds: string[] = [];
  for (const w of WORKSHOPS) {
    const rows = await adminSql<{ id: string }[]>`
      INSERT INTO workshops (organization_id, name, address)
      VALUES (${orgId}, ${w.name}, ${JSON.stringify({ city: w.city, country: 'NO' })}::jsonb)
      RETURNING id
    `;
    workshopIds.push(rows[0]!.id);
  }
  console.log(`✔ ${workshopIds.length} workshops created`);

  // --- Look up role ids for the org ----------------------------------------
  const roleRows = await admin
    .select({ id: roles.id, key: roles.key })
    .from(roles)
    .where(eq(roles.organizationId, orgId));
  const roleIdByKey = new Map<string, string>();
  for (const r of roleRows) {
    if (r.key) roleIdByKey.set(r.key, r.id);
  }

  // --- Employees ------------------------------------------------------------
  const employeeIds: string[] = [OWNER_USER_ID];
  for (const emp of EMPLOYEES) {
    const userId = randomUUID();
    await ensureUser({ id: userId, email: emp.email, fullName: emp.fullName });
    const roleId = roleIdByKey.get(emp.role);
    if (!roleId) throw new Error(`Missing role ${emp.role}`);
    await addMembershipWithRole({
      organizationId: orgId,
      userId,
      roleId,
      assignedByUserId: OWNER_USER_ID,
      defaultWorkshopId: workshopIds[emp.workshopIndex] ?? null,
    });
    employeeIds.push(userId);
  }
  console.log(`✔ ${employeeIds.length} employees provisioned (incl. owner)`);

  // --- System ctx for the bulk seed work -----------------------------------
  // Owner has all permissions; bulk-create through their context.
  const sysCtx: RequestContext = {
    userId: OWNER_USER_ID,
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

  // --- Checklist templates (seed once at org level) ------------------------
  const templateIdByCode = new Map<string, string>();
  for (const tpl of DEFAULT_CHECKLIST_TEMPLATES) {
    const created = await createChecklistTemplate(sysCtx, {
      code: tpl.code,
      name: tpl.name,
      ...(tpl.kind ? { kind: tpl.kind } : {}),
      items: tpl.items.map((i) => ({ ...i })),
    });
    templateIdByCode.set(tpl.code, created.id);
  }
  console.log(`✔ ${templateIdByCode.size} QC checklist templates seeded`);

  // --- Customers ------------------------------------------------------------
  const customerIds: string[] = [];
  const customerContacts: { email: string; phone: string }[] = [];
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
  }
  console.log(`✔ ${customerIds.length} customers created`);

  // --- Vehicles -------------------------------------------------------------
  const vehicleIds: string[] = [];
  const vehicleOwnerByVehicleIdx: number[] = []; // map vehicle idx → customer idx
  for (let i = 0; i < 75; i++) {
    // Round-robin distribute to customers, but skip some so a few customers
    // have zero vehicles (realistic — walk-ins, pure-payer customers, etc.).
    const ownerIdx = (i * 2 + (i % 3)) % customerIds.length;
    const spec = VEHICLES[i % VEHICLES.length]!;
    const ownership =
      i % 7 === 0 ? 'company_pool' : i % 11 === 0 ? 'leased' : 'private';
    const v = await createVehicle(sysCtx, {
      registrationNumber: regNumber(i),
      make: spec.make,
      model: spec.model,
      year: spec.year,
      colour: pick(COLOURS),
      ownerCustomerId: customerIds[ownerIdx]!,
      ownershipType: ownership,
    });
    vehicleIds.push(v.id);
    vehicleOwnerByVehicleIdx.push(ownerIdx);
  }
  console.log(`✔ ${vehicleIds.length} vehicles created`);

  // --- Cases ---------------------------------------------------------------
  // 25 cases. Distribute stop-states so the production board shows life:
  //   2 received, 2 estimated, 3 approved, 3 awaiting_parts,
  //   3 in_body_repair, 3 in_paint_application, 3 in_quality_control,
  //   3 ready_for_delivery, 3 delivered
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

  for (let i = 0; i < 25; i++) {
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
