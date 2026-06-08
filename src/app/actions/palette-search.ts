'use server';

import { getSessionContext } from '@/lib/auth/session';
import { searchCases } from '@/modules/case/public';
import { searchCustomers, searchVehicles } from '@/modules/customer/public';

/**
 * Global command-palette search (doc 12 §3). Returns up to a handful of hits
 * per entity type. Anchored to the active org/tenant context, so RLS makes
 * sure the user only sees what they may.
 */
export interface PaletteSearchResult {
  cases: { id: string; caseNumber: string; subtitle: string | null }[];
  vehicles: { id: string; label: string; subtitle: string | null }[];
  customers: { id: string; label: string; subtitle: string | null }[];
}

export async function searchPaletteAction(
  query: string,
): Promise<PaletteSearchResult> {
  const session = await getSessionContext();
  if (!session) {
    return { cases: [], vehicles: [], customers: [] };
  }
  const trimmed = query.trim();
  if (trimmed.length < 2) {
    return { cases: [], vehicles: [], customers: [] };
  }

  const [cases, vehicles, customers] = await Promise.all([
    searchCases(session.context, trimmed, 6),
    searchVehicles(session.context, trimmed, 6),
    searchCustomers(session.context, trimmed, 6),
  ]);

  return {
    cases: cases.map((c) => ({
      id: c.id,
      caseNumber: c.caseNumber,
      subtitle:
        [c.registrationNumber, c.customerName].filter(Boolean).join(' · ') ||
        c.status,
    })),
    vehicles: vehicles.map((v) => ({
      id: v.id,
      label: v.registrationNumber ?? v.vin ?? '—',
      subtitle:
        [v.make, v.model, v.year].filter((x) => x != null).join(' ') || null,
    })),
    customers: customers.map((c) => ({
      id: c.id,
      label: c.name,
      subtitle: c.primaryPhone ?? c.primaryEmail ?? null,
    })),
  };
}
