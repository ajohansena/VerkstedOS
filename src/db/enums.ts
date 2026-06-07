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
