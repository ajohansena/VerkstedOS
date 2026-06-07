import {
  PERMISSION_CATALOG,
  type PermissionCode,
} from '@/lib/permissions/catalog';

/**
 * The six standard MVP roles (docs/05-multi-tenant-and-rbac.md, ADR-018).
 *
 * Roles are DATA — these are the seeded defaults an org can edit, duplicate, or
 * replace. The permission BUNDLES below are the system defaults applied on org
 * creation. `isSystem` roles are seeded for every org and cannot be deleted
 * (only customized by adjusting their `role_permissions`).
 */

export type StandardRoleKey =
  | 'owner'
  | 'admin'
  | 'estimator'
  | 'technician'
  | 'accounting'
  | 'viewer';

export interface StandardRoleDefinition {
  readonly key: StandardRoleKey;
  readonly name: string;
  readonly description: string;
  readonly permissions: readonly PermissionCode[];
}

const ALL_PERMISSIONS: readonly PermissionCode[] = PERMISSION_CATALOG.map(
  (permission) => permission.code,
);

const VIEW_ONLY: readonly PermissionCode[] = PERMISSION_CATALOG.filter(
  (permission) => permission.code.endsWith(':view'),
).map((permission) => permission.code);

export const STANDARD_ROLES: readonly StandardRoleDefinition[] = [
  {
    key: 'owner',
    name: 'Owner',
    description: 'Full access, including audit and user management.',
    permissions: ALL_PERMISSIONS,
  },
  {
    key: 'admin',
    name: 'Admin',
    description: 'Full operational access; org configuration.',
    permissions: ALL_PERMISSIONS.filter((code) => code !== 'admin:audit'),
  },
  {
    key: 'estimator',
    name: 'Estimator',
    description: 'Cases, estimates, parts ordering, financial visibility.',
    permissions: [
      'case:view',
      'case:edit',
      'estimate:view',
      'estimate:edit',
      'estimate:lock',
      'parts:view',
      'parts:order',
      'quality:view',
      'finance:view',
    ],
  },
  {
    key: 'technician',
    name: 'Technician',
    description: 'Production work, own time, quality input.',
    permissions: [
      'case:view',
      'production:view',
      'production:transition',
      'time:self',
      'parts:view',
      'quality:view',
      'quality:edit',
    ],
  },
  {
    key: 'accounting',
    name: 'Accounting',
    description: 'Financial control and parts reconciliation.',
    permissions: [
      'case:view',
      'finance:view',
      'finance:invoice',
      'finance:export',
      'parts:view',
      'parts:reconcile',
    ],
  },
  {
    key: 'viewer',
    name: 'Viewer',
    description: 'Read-only across the platform.',
    permissions: VIEW_ONLY,
  },
];
