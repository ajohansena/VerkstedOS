import { ensureBuckets } from '../src/modules/documents/public';

/**
 * CLI entry for `pnpm storage:setup`. Provisions the four sensitivity-class
 * Storage buckets (docs-public/internal/confidential/restricted) in the
 * configured Supabase project. Idempotent. Requires NEXT_PUBLIC_SUPABASE_URL +
 * SUPABASE_SERVICE_ROLE_KEY.
 */
async function main(): Promise<void> {
  const created = await ensureBuckets();
  if (created.length === 0) {
    console.log('All sensitivity-class buckets already exist.');
  } else {
    console.log(`Created bucket(s): ${created.join(', ')}`);
  }
  process.exit(0);
}

main().catch((err) => {
  console.error('Bucket setup failed:', err);
  process.exit(1);
});
