/**
 * Platform / Developer Control Plane — public surface.
 */

export {
  listAllOrganizations,
  inspectOrganization,
  type OrgListItem,
  type OrgInspection,
  type OrgHealth,
} from '../infrastructure/repositories/platform-org-repository';

export {
  inspectUser,
  type UserInspection,
  type UserMembershipInspection,
} from '../infrastructure/repositories/platform-user-repository';

export {
  searchAuditEvents,
  auditTrailFor,
  type AuditSearchFilter,
} from '../infrastructure/repositories/platform-audit-repository';

export {
  inspectSearch,
  type InspectResult,
  type InspectResultKind,
} from '../infrastructure/repositories/platform-inspect-repository';

export {
  listDbsInbox,
  dbsInboxStats,
  type InboxItem,
} from '../infrastructure/repositories/platform-dbs-repository';

export {
  listOutbox,
  outboxCounts,
  listFailedEvents,
  replayOutboxEvent,
  type OutboxRow,
  type FailedEventRow,
} from '../infrastructure/repositories/platform-events-repository';

export {
  listOpenSessions,
  listTimeCorrections,
  type OpenSessionRow,
  type CorrectionRow,
} from '../infrastructure/repositories/platform-workforce-repository';

export {
  listSegmentsForOrg,
  recomputeSegmentActuals,
  type SegmentRow,
  type RecomputeResult,
} from '../infrastructure/repositories/platform-planning-repository';

export {
  listRequirementsForOrg,
  listLifecycleForRequirement,
  rebuildRequirementStatus,
  type PartRequirementRow,
  type LifecycleRow,
  type RebuildResult,
} from '../infrastructure/repositories/platform-parts-repository';

export {
  listDocumentsForOrg,
  type DocumentRow,
} from '../infrastructure/repositories/platform-documents-repository';

export {
  listAcceptancesForOrg,
  listQueuedMessagesForOrg,
  type AcceptanceRow,
  type QueuedMessageRow,
} from '../infrastructure/repositories/platform-communication-repository';

export {
  listFeatureFlags,
  setFeatureFlag,
  isFeatureEnabled,
  type FeatureFlagRow,
} from '../infrastructure/repositories/platform-feature-flag-repository';

export {
  startImpersonation,
  endImpersonation,
  listImpersonationSessions,
  type StartImpersonationInput,
  type ImpersonationRow,
} from '../infrastructure/repositories/platform-impersonation-repository';

export {
  listTransfersForOrg,
  repairStuckTransfer,
  type TransferRow,
} from '../infrastructure/repositories/platform-transfer-repository';

export {
  qcSummaryForOrg,
  type QcRunRow,
  type QcOrgSummary,
} from '../infrastructure/repositories/platform-quality-repository';

export {
  listNotificationsForOrg,
  listDeliveriesForOrg,
  listRulesForOrgPlatform,
  type NotificationRow,
  type DeliveryRow,
  type RuleRow,
} from '../infrastructure/repositories/platform-notifications-repository';

export {
  listPlatformRentalVehicles,
  listPlatformReservations,
  listPlatformAgreements,
  listPlatformReturns,
  listPlatformAbsences,
  type PlatformRentalRow,
  type PlatformReservationRow,
  type PlatformAgreementRow,
  type PlatformReturnRow,
  type PlatformAbsenceRow,
} from '../infrastructure/repositories/platform-rental-repository';

export {
  listPlatformYardLayouts,
  listPlatformYardLocations,
  listPlatformVehiclePlacements,
  listPlatformVehicleMovements,
  type PlatformYardLayoutRow,
  type PlatformYardLocationRow,
  type PlatformVehiclePlacementRow,
  type PlatformVehicleMovementRow,
} from '../infrastructure/repositories/platform-yard-repository';

export {
  requestDangerousOp,
  approveDangerousOp,
  rejectDangerousOp,
  executeDangerousOp,
  cancelDangerousOp,
  listQueue as listDangerousOpsQueue,
  TwoPersonRuleViolationError,
  DangerousOperationNotFoundError,
  DangerousOperationStateError,
  type RequestDangerousOpInput,
} from '../application/services/two-person';

export {
  grantPlatformRole,
  revokePlatformRole,
  PlatformOwnerSingletonViolationError,
  PlatformUserNotFoundError,
  type GrantPlatformRoleInput,
  type RevokePlatformRoleInput,
} from '../application/services/platform-roles';

export {
  provisionOrganization,
  deactivateOrganization,
  reactivateOrganization,
  archiveOrganization,
  unarchiveOrganization,
  type ProvisionOrganizationInput,
  type ProvisionOrganizationResult,
} from '../application/services/org-management';

export {
  type DangerousOperationRow,
  type DangerousOperationKind,
  type DangerousOperationStatus,
} from '../infrastructure/repositories/platform-dangerous-ops-repository';
