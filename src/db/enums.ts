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

// --- Estimating & Integration ------------------------------------------------

/** Estimate import version lifecycle (ADR-004 — immutable when locked). */
export const estimateImportStatus = pgEnum('estimate_import_status', [
  'draft',
  'active',
  'locked',
  'superseded',
]);

export const estimateImportKind = pgEnum('estimate_import_kind', [
  'original',
  'supplement',
  're_estimate',
]);

export const estimateSource = pgEnum('estimate_source', [
  'dbs',
  'manual',
  'api',
]);

/** Estimate line categories (body labor, paint labor, paint material, parts). */
export const estimateLineCategory = pgEnum('estimate_line_category', [
  'body_labor',
  'panel_beating',
  'rust_protection',
  'paint_labor',
  'paint_material',
  'part',
  'external_work',
  'other',
]);

export const integrationInboxStatus = pgEnum('integration_inbox_status', [
  'received',
  'processing',
  'processed',
  'failed',
]);

// --- Production --------------------------------------------------------------

/**
 * Workflow state category — drives behavior, NOT the source of truth
 * (docs/10-production-domain.md, Sprint 8 guardrail). `active` = work running;
 * `waiting` = paused by external dependency; `terminal` = closed.
 */
export const workflowStateCategory = pgEnum('workflow_state_category', [
  'active',
  'waiting',
  'terminal',
]);

export const workflowTransitionTrigger = pgEnum('workflow_transition_trigger', [
  'manual',
  'automatic',
  'event_driven',
]);

export const productionHoldKind = pgEnum('production_hold_kind', [
  'parts',
  'approval_insurance',
  'approval_customer',
  'transport',
  'subcontractor',
  'documentation',
  'equipment_offline',
  'paint_cure',
  'other',
]);

// --- Workforce ---------------------------------------------------------------

export const employeeStatus = pgEnum('employee_status', ['active', 'inactive']);

export const resourceKind = pgEnum('resource_kind', [
  'person',
  'equipment',
  'facility',
]);

export const resourceStatus = pgEnum('resource_status', [
  'active',
  'inactive',
  'maintenance',
]);

export const skillProficiency = pgEnum('skill_proficiency', [
  'apprentice',
  'qualified',
  'expert',
]);

/** Time-entry kind. `original` rows are event-tier; `correction` rows full-tier. */
export const timeEntryKind = pgEnum('time_entry_kind', [
  'work',
  'break',
  'correction',
]);

export const clockSessionStatus = pgEnum('clock_session_status', [
  'open',
  'closed',
]);

// --- Production planning (work segments) -------------------------------------

export const workSegmentStatus = pgEnum('work_segment_status', [
  'not_started',
  'queued',
  'in_progress',
  'paused',
  'blocked',
  'completed',
  'cancelled',
]);

export const taskStatus = pgEnum('task_status', [
  'not_started',
  'in_progress',
  'completed',
  'cancelled',
]);

export const segmentDependencyKind = pgEnum('segment_dependency_kind', [
  'must_complete_before',
  'must_start_before',
  'soft_preferred',
]);

export const resourceAssignmentRole = pgEnum('resource_assignment_role', [
  'primary',
  'assist',
  'observer',
]);

export const resourceAssignmentStatus = pgEnum('resource_assignment_status', [
  'planned',
  'confirmed',
  'in_progress',
  'completed',
  'cancelled',
]);
