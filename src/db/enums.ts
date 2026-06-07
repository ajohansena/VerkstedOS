import { pgEnum } from 'drizzle-orm/pg-core';

/**
 * Centralized PostgreSQL enum declarations (CLAUDE.md § 12, docs/03-data-model.md).
 *
 * All `pgEnum(...)` definitions live here so they have a single source of truth
 * and can be referenced from any schema file.
 */

// --- Identity & Access ------------------------------------------------------

export const organizationStatus = pgEnum('organization_status', [
  'active',
  'suspended',
]);

export const workshopStatus = pgEnum('workshop_status', ['active', 'inactive']);

export const userStatus = pgEnum('user_status', ['active', 'disabled']);

export const membershipStatus = pgEnum('membership_status', [
  'active',
  'invited',
  'suspended',
]);

// --- Customer & Vehicle -----------------------------------------------------

export const customerKind = pgEnum('customer_kind', [
  'individual',
  'company',
  'leasing_company',
  'fleet_operator',
]);

export const identifierKind = pgEnum('identifier_kind', [
  'personal_id_no',
  'org_no_no',
  'foreign_id',
]);

export const ownershipType = pgEnum('ownership_type', [
  'private',
  'leased',
  'company_pool',
  'rental',
  'unknown',
]);

// --- RBAC --------------------------------------------------------------------

export const grantKind = pgEnum('grant_kind', ['grant', 'deny']);

// --- Audit & Events ----------------------------------------------------------

export const actorKind = pgEnum('actor_kind', [
  'user',
  'system',
  'integration',
  'job',
  'platform',
  'platform_impersonation',
]);

export const outboxStatus = pgEnum('outbox_status', [
  'pending',
  'published',
  'failed',
]);

// --- Platform / Developer Control Plane -------------------------------------

export const platformUserStatus = pgEnum('platform_user_status', [
  'active',
  'disabled',
]);

export const platformRole = pgEnum('platform_role', [
  'PlatformOwner',
  'PlatformDeveloper',
  'PlatformSupport',
]);

// --- Customer & Case ---------------------------------------------------------

export const caseStatus = pgEnum('case_status', [
  'intake',
  'active',
  'on_hold',
  'delivered',
  'closed',
  'cancelled',
]);

export const fundingSourceKind = pgEnum('funding_source_kind', [
  'insurance',
  'private_pay',
  'warranty',
  'goodwill',
  'internal_rework',
]);

export const fundingSourceStatus = pgEnum('funding_source_status', [
  'draft',
  'active',
  'invoiced',
  'settled',
  'cancelled',
]);

export const insuranceClaimStatus = pgEnum('insurance_claim_status', [
  'open',
  'approved',
  'rejected',
  'settled',
  'cancelled',
]);

export const casePartyRole = pgEnum('case_party_role', [
  'counterparty',
  'witness',
  'guarantor',
  'third_party_payer',
  'other',
]);
