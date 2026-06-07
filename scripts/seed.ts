import postgres from 'postgres';

import { seedInsuranceCompanies } from '../src/lib/seed/insurance-companies';

/**
 * CLI entry for `pnpm db:seed`. Seeds the platform-shared catalogs against
 * DATABASE_URL. Idempotent.
 */
async function main(): Promise<void> {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error('DATABASE_URL is not set.');
    process.exit(1);
  }

  // The seed connects with the same DATABASE_URL; the insurance catalog has no
  // org context (platform-shared), so it uses the admin escape hatch internally.
  const probe = postgres(url, { max: 1 });
  try {
    await probe`select 1`;
  } finally {
    await probe.end();
  }

  const count = await seedInsuranceCompanies();
  console.log(`Seeded ${count} insurance companies.`);
  process.exit(0);
}

void main();
