import { getRawClient } from '@/db/client';
import { insuranceCompanies } from '@/db/schemas/platform/insurance-companies';

/**
 * Platform-shared insurance-company catalog (docs/03-data-model.md).
 *
 * The major Norwegian claim-payers. Seeded once and shared by every org; the
 * seed is idempotent (upsert on `code`).
 */
export const INSURANCE_COMPANY_SEED = [
  { code: 'fremtind', name: 'Fremtind Forsikring', orgNumber: '914782007' },
  { code: 'if', name: 'If Skadeforsikring', orgNumber: '981290666' },
  { code: 'gjensidige', name: 'Gjensidige Forsikring', orgNumber: '995568217' },
  { code: 'tryg', name: 'Tryg Forsikring', orgNumber: '993716625' },
  { code: 'codan', name: 'Codan Forsikring', orgNumber: '991502427' },
  { code: 'eika', name: 'Eika Forsikring', orgNumber: '931591723' },
  { code: 'frende', name: 'Frende Skadeforsikring', orgNumber: '991403484' },
  { code: 'storebrand', name: 'Storebrand Forsikring', orgNumber: '930553506' },
  { code: 'knif', name: 'KNIF Trygghet Forsikring', orgNumber: '978679577' },
  { code: 'protector', name: 'Protector Forsikring', orgNumber: '985279721' },
] as const;

/** Idempotently seed the insurance-company catalog. Returns count upserted. */
export async function seedInsuranceCompanies(): Promise<number> {
  const db = getRawClient({ as: 'admin' });
  let count = 0;
  for (const company of INSURANCE_COMPANY_SEED) {
    await db
      .insert(insuranceCompanies)
      .values({
        code: company.code,
        name: company.name,
        orgNumber: company.orgNumber,
        country: 'NO',
      })
      .onConflictDoUpdate({
        target: insuranceCompanies.code,
        set: { name: company.name, orgNumber: company.orgNumber },
      });
    count += 1;
  }
  return count;
}
