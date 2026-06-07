/**
 * Permission catalog — permissions are CODE, not data (CLAUDE.md § 4.3).
 *
 * The catalog is exhaustively enumerated here and never typed as free strings
 * at call sites. The MVP catalog (~24 permissions across 8 groups) is seeded in
 * Sprint 3 (RBAC). Sprint 1 ships the typed structure + the drift-check
 * mechanism only; the catalog is intentionally empty.
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
export const PERMISSION_CATALOG: readonly PermissionDefinition[] = [];

export const PERMISSION_CODES: readonly string[] = PERMISSION_CATALOG.map(
  (permission) => permission.code,
);
