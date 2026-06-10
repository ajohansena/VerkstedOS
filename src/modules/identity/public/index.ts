/**
 * Identity & Access — public surface.
 *
 * The ONLY entry point other modules and the app may import from. Never deep-
 * import this module's domain/application/infrastructure (enforced by
 * dependency-cruiser).
 */

export type { RequestContext } from '@/lib/tenancy/context';

export type { Organization, Workshop, User, Membership } from '@/db/types';

export {
  resolveRequestContext,
  type ResolveContextResult,
} from '../application/services/resolve-context';

export {
  listWorkshops,
  listOrganizationsForUser,
  getCurrentOrganization,
  userBelongsToOrg,
  type UserOrganization,
} from '../infrastructure/repositories/identity-read-repository';

export {
  ensureUser,
  findUserById,
  findUserByEmail,
} from '../infrastructure/repositories/user-repository';

// --- RBAC ---

export {
  hasPermission,
  type PermissionScope,
} from '../application/policies/permission-resolver';

export {
  requirePermission,
  PermissionDeniedError,
} from '../application/policies/require-permission';

export {
  createOrganizationWithOwner,
  addMembershipWithRole,
} from '../application/services/organization-onboarding';

export {
  updateOrganizationSettings,
  createWorkshop,
  renameWorkflowState,
  type UpdateOrgSettingsInput,
} from '../application/services/admin-config';

export { seedStandardRoles } from '../application/services/seed-standard-roles';

export {
  assignRole,
  grantPermission,
} from '../application/services/manage-access';

export {
  inviteEmployee,
  setMembershipStatus,
  type InviteEmployeeInput,
  type InviteEmployeeResult,
} from '../application/services/invite-employee';

export {
  listRoles,
  listOrgMembers,
  getEffectivePermissionCodes,
  type RoleListItem,
  type OrgMember,
} from '../infrastructure/repositories/rbac-repository';

export type { Role, RoleAssignment, UserPermissionGrant } from '@/db/types';

export {
  type PermissionCode,
  PERMISSION_CATALOG,
} from '@/lib/permissions/catalog';
