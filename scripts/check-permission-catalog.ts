/**
 * Permission catalog drift check (CI gate).
 *
 * Validates that every permission code is well-formed (`group:action`) and
 * unique, and that the catalog stays within the approved MVP envelope
 * (≤ 24 permissions — CLAUDE.md § 4.3 permission discipline).
 *
 * Run via `pnpm check:permissions`.
 */
import { PERMISSION_CATALOG } from '../src/lib/permissions/catalog';

const CODE_PATTERN = /^[a-z]+:[a-z_]+$/;
const MAX_MVP_PERMISSIONS = 24;

const errors: string[] = [];
const seen = new Set<string>();

for (const permission of PERMISSION_CATALOG) {
  if (!CODE_PATTERN.test(permission.code)) {
    errors.push(
      `Invalid permission code: "${permission.code}" (expected group:action).`,
    );
  }
  if (seen.has(permission.code)) {
    errors.push(`Duplicate permission code: "${permission.code}".`);
  }
  seen.add(permission.code);
}

if (PERMISSION_CATALOG.length > MAX_MVP_PERMISSIONS) {
  errors.push(
    `Permission catalog has ${PERMISSION_CATALOG.length} entries, exceeding the ` +
      `MVP envelope of ${MAX_MVP_PERMISSIONS}. Split existing permissions rather ` +
      'than layering new ones (CLAUDE.md § 4.3); justify in the PR.',
  );
}

if (errors.length > 0) {
  console.error('Permission catalog check FAILED:');
  for (const error of errors) console.error(`  - ${error}`);
  process.exit(1);
}

console.log(
  `Permission catalog check passed (${PERMISSION_CATALOG.length} permissions).`,
);
