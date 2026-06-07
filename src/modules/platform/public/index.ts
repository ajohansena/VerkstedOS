/**
 * Platform / Developer Control Plane — public surface.
 */

export {
  listAllOrganizations,
  type OrgListItem,
} from '../infrastructure/repositories/platform-org-repository';

export {
  inspectUser,
  type UserInspection,
  type UserMembershipInspection,
} from '../infrastructure/repositories/platform-user-repository';
