import { eq, ilike, or } from 'drizzle-orm';

import { getRawClient } from '@/db/client';
import { customers } from '@/db/schemas/customer/customers';
import { vehicles } from '@/db/schemas/customer/vehicles';
import { organizations } from '@/db/schemas/identity/organizations';
import { users } from '@/db/schemas/identity/users';

/**
 * Universal entity search (Dev surface, `/dev/inspect`). Cross-org by nature →
 * service-role connection. Searches the entities that exist at this point in the
 * build (vehicles, customers, orgs, users); cases/claims/invoices join as those
 * modules ship.
 */
export type InspectResultKind =
  | 'vehicle'
  | 'customer'
  | 'organization'
  | 'user';

export interface InspectResult {
  readonly kind: InspectResultKind;
  readonly id: string;
  readonly label: string;
  readonly sublabel: string;
  readonly organizationId: string | null;
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function inspectSearch(query: string): Promise<InspectResult[]> {
  const q = query.trim();
  if (!q) return [];

  const db = getRawClient({ as: 'platform-inspector' });
  const like = `%${q}%`;
  const results: InspectResult[] = [];

  // Vehicles by reg or VIN.
  const vRows = await db
    .select()
    .from(vehicles)
    .where(
      or(ilike(vehicles.registrationNumber, like), ilike(vehicles.vin, like)),
    )
    .limit(20);
  for (const v of vRows) {
    results.push({
      kind: 'vehicle',
      id: v.id,
      label: v.registrationNumber ?? v.vin ?? v.id,
      sublabel: [v.make, v.model].filter(Boolean).join(' ') || 'vehicle',
      organizationId: v.organizationId,
    });
  }

  // Customers by name, phone, or identifier.
  const cRows = await db
    .select()
    .from(customers)
    .where(
      or(
        ilike(customers.name, like),
        ilike(customers.primaryPhone, like),
        ilike(customers.identifier, like),
      ),
    )
    .limit(20);
  for (const c of cRows) {
    results.push({
      kind: 'customer',
      id: c.id,
      label: c.name,
      sublabel: c.kind,
      organizationId: c.organizationId,
    });
  }

  // Organizations by name or org number.
  const oRows = await db
    .select()
    .from(organizations)
    .where(
      or(ilike(organizations.name, like), ilike(organizations.orgNumber, like)),
    )
    .limit(20);
  for (const o of oRows) {
    results.push({
      kind: 'organization',
      id: o.id,
      label: o.name,
      sublabel: o.orgNumber ?? 'organization',
      organizationId: o.id,
    });
  }

  // Users by email.
  const uRows = await db
    .select()
    .from(users)
    .where(ilike(users.email, like))
    .limit(20);
  for (const u of uRows) {
    results.push({
      kind: 'user',
      id: u.id,
      label: u.email,
      sublabel: u.fullName ?? 'user',
      organizationId: null,
    });
  }

  // Direct UUID lookup across the same tables.
  if (UUID_RE.test(q)) {
    const direct = await db
      .select()
      .from(organizations)
      .where(eq(organizations.id, q))
      .limit(1);
    for (const o of direct) {
      results.push({
        kind: 'organization',
        id: o.id,
        label: o.name,
        sublabel: 'by id',
        organizationId: o.id,
      });
    }
  }

  return results;
}
