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
} from '../infrastructure/repositories/user-repository';
