/**
 * Permission catalog — permissions are CODE, not data (CLAUDE.md § 4.3).
 *
 * The catalog is exhaustively enumerated here and never typed as free strings
 * at call sites. The MVP catalog (24 permissions across 8 groups of 3) is the
 * authoritative permission list (docs/05-multi-tenant-and-rbac.md, ADR-018).
 *
 * Permission discipline: expand the catalog by SPLITTING existing permissions,
 * never by layering new categories. Every new permission requires written
 * justification in the PR description.
 */

export type PermissionGroup =
  | 'case'
  | 'estimate'
  | 'production'
  | 'time'
  | 'parts'
  | 'quality'
  | 'finance'
  | 'admin';

export interface PermissionDefinition {
  /** Stable code in `group:action` form, e.g. `case:transfer`. */
  readonly code: string;
  readonly group: PermissionGroup;
  readonly description: string;
}

/**
 * The exhaustive permission catalog. Empty until Sprint 3 (RBAC).
 * Every entry's `code` must match /^[a-z]+:[a-z_]+$/ and be unique
 * (enforced by `pnpm check:permissions`).
 */
export const PERMISSION_CATALOG = [
  // case
  { code: 'case:view', group: 'case', description: 'View cases.' },
  { code: 'case:edit', group: 'case', description: 'Create and edit cases.' },
  {
    code: 'case:transfer',
    group: 'case',
    description: 'Transfer a case to another workshop.',
  },

  // estimate
  { code: 'estimate:view', group: 'estimate', description: 'View estimates.' },
  {
    code: 'estimate:edit',
    group: 'estimate',
    description: 'Import and edit estimates.',
  },
  {
    code: 'estimate:lock',
    group: 'estimate',
    description: 'Lock an estimate version.',
  },

  // production
  {
    code: 'production:view',
    group: 'production',
    description: 'View the production board and orders.',
  },
  {
    code: 'production:plan',
    group: 'production',
    description: 'Plan work segments and resource assignments.',
  },
  {
    code: 'production:transition',
    group: 'production',
    description: 'Transition a case between production states.',
  },

  // time
  {
    code: 'time:self',
    group: 'time',
    description: 'Clock in/out and register own time.',
  },
  {
    code: 'time:other',
    group: 'time',
    description: "Manage other employees' time.",
  },
  {
    code: 'time:correct',
    group: 'time',
    description: 'Make privileged time corrections.',
  },

  // parts
  { code: 'parts:view', group: 'parts', description: 'View parts and orders.' },
  {
    code: 'parts:order',
    group: 'parts',
    description: 'Create purchase orders and receive parts.',
  },
  {
    code: 'parts:reconcile',
    group: 'parts',
    description: 'Reconcile parts against supplier invoices.',
  },

  // quality
  {
    code: 'quality:view',
    group: 'quality',
    description: 'View checklists and deviations.',
  },
  {
    code: 'quality:edit',
    group: 'quality',
    description: 'Complete checklists and record deviations.',
  },
  {
    code: 'quality:signoff',
    group: 'quality',
    description: 'Sign off quality control.',
  },

  // finance
  {
    code: 'finance:view',
    group: 'finance',
    description: 'View financial data.',
  },
  {
    code: 'finance:invoice',
    group: 'finance',
    description: 'Generate invoice basis.',
  },
  {
    code: 'finance:export',
    group: 'finance',
    description: 'Export to the accounting system.',
  },

  // admin
  {
    code: 'admin:users',
    group: 'admin',
    description: 'Invite users and assign roles.',
  },
  {
    code: 'admin:config',
    group: 'admin',
    description: 'Configure the organization.',
  },
  {
    code: 'admin:audit',
    group: 'admin',
    description: 'View the audit log.',
  },
] as const satisfies readonly PermissionDefinition[];

export type PermissionCode = (typeof PERMISSION_CATALOG)[number]['code'];

export const PERMISSION_CODES: readonly string[] = PERMISSION_CATALOG.map(
  (permission) => permission.code,
);

const PERMISSION_CODE_SET: ReadonlySet<string> = new Set(PERMISSION_CODES);

/** Runtime guard: is the given string a known permission code? */
export function isPermissionCode(value: string): value is PermissionCode {
  return PERMISSION_CODE_SET.has(value);
}
