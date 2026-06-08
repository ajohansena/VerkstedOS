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

// --- Parts & Procurement -----------------------------------------------------

export const supplierStatus = pgEnum('supplier_status', ['active', 'inactive']);

export const partRequirementStatus = pgEnum('part_requirement_status', [
  'needed', // flagged, not yet sourced
  'sourcing', // being quoted / decided
  'ordered', // on a purchase order
  'partially_received',
  'received', // arrived, awaiting withdrawal
  'fulfilled', // withdrawn / fitted to the vehicle
  'returned', // sent back, needs re-sourcing or cancelled
  'cancelled',
]);

export const partRequirementSource = pgEnum('part_requirement_source', [
  'estimate', // derived from a DBS estimate part line
  'manual', // a technician flagged a missing part
  'supplement', // added via a supplement
]);

export const partCondition = pgEnum('part_condition', [
  'new',
  'used',
  'aftermarket',
  'reconditioned',
]);

export const purchaseOrderStatus = pgEnum('purchase_order_status', [
  'draft',
  'sent',
  'confirmed',
  'partially_received',
  'received',
  'closed',
  'cancelled',
]);

export const purchaseOrderLineStatus = pgEnum('purchase_order_line_status', [
  'open',
  'partially_received',
  'received',
  'cancelled',
]);

export const partReturnReason = pgEnum('part_return_reason', [
  'wrong_part',
  'damaged',
  'defective',
  'surplus',
  'no_longer_needed',
]);

export const partReturnStatus = pgEnum('part_return_status', [
  'requested',
  'shipped',
  'credited',
  'rejected',
]);

export const inventoryMovementKind = pgEnum('inventory_movement_kind', [
  'receipt', // stock in (from a part receipt)
  'withdrawal', // stock out (to a case)
  'return', // stock back in (unused)
  'adjustment', // manual correction
]);

export const partLifecycleEventKind = pgEnum('part_lifecycle_event_kind', [
  'requirement_created',
  'requirement_updated',
  'ordered',
  'po_sent',
  'received',
  'withdrawn',
  'returned',
  'cancelled',
  'fulfilled',
]);

// --- Documents (cross-cutting, docs/04-document-architecture.md) -------------

export const documentKind = pgEnum('document_kind', [
  'photo',
  'estimate_file',
  'supplier_invoice',
  'credit_note',
  'insurance_document',
  'customer_attachment',
  'email_attachment',
  'internal',
  'generated_invoice',
  'signed_agreement',
  'quality_report',
  'other',
]);

export const documentSource = pgEnum('document_source', [
  'upload',
  'email',
  'dbs_import',
  'api',
  'webhook',
  'generated',
  'scan',
  'system',
]);

export const documentSensitivity = pgEnum('document_sensitivity', [
  'public',
  'internal',
  'confidential',
  'restricted',
]);

export const documentUploaderKind = pgEnum('document_uploader_kind', [
  'user',
  'system',
  'integration',
  'customer_portal',
]);

export const documentLinkEntityType = pgEnum('document_link_entity_type', [
  'case',
  'claim',
  'customer',
  'vehicle',
  'supplier_invoice',
  'purchase_order',
  'communication',
  'work_segment',
  'checklist_run',
  'invoice_basis',
]);

export const documentLinkRole = pgEnum('document_link_role', [
  'primary',
  'attachment',
  'before_photo',
  'during_photo',
  'after_photo',
  'estimate_source',
  'invoice_source',
  'credit_source',
  'signed_copy',
  'generated_output',
  'reference',
]);

export const documentAccessAction = pgEnum('document_access_action', [
  'viewed',
  'downloaded',
  'signed_url_issued',
]);

// --- Quality (docs/03-data-model.md, docs/10-production-domain.md) -----------

export const checklistTemplateKind = pgEnum('checklist_template_kind', [
  'delivery',
  'calibration',
  'paint',
  'general',
]);

export const checklistRunStatus = pgEnum('checklist_run_status', [
  'in_progress',
  'passed',
  'failed',
  'cancelled',
]);

export const checklistResponseResult = pgEnum('checklist_response_result', [
  'pass',
  'fail',
  'na',
]);

export const qualityDeviationSeverity = pgEnum('quality_deviation_severity', [
  'minor',
  'major',
  'critical',
]);

export const qualityDeviationStatus = pgEnum('quality_deviation_status', [
  'open',
  'in_progress',
  'resolved',
  'cancelled',
]);

// --- Communication & Customer Acceptance (docs/03-data-model.md) -------------

export const communicationChannel = pgEnum('communication_channel', [
  'sms',
  'email',
]);

export const communicationThreadStatus = pgEnum('communication_thread_status', [
  'open',
  'closed',
]);

export const communicationDirection = pgEnum('communication_direction', [
  'outbound',
  'inbound',
]);

export const communicationMessageStatus = pgEnum(
  'communication_message_status',
  [
    'queued', // stored, awaiting a configured provider
    'sent',
    'delivered',
    'failed',
    'received', // inbound
  ],
);

export const caseAcceptanceStatus = pgEnum('case_acceptance_status', [
  'pending',
  'accepted',
  'declined',
  'expired',
  'cancelled',
]);

export const caseAcceptanceMethod = pgEnum('case_acceptance_method', [
  'job_card_link', // customer clicked the link and accepted
  'sms_reply', // customer replied OK to the SMS
  'email_reply', // customer replied to the email
  'manual', // staff recorded a verbal/in-person acceptance
]);

// --- Digital signatures (docs/03-data-model.md, quality module) -------------

export const signatureKind = pgEnum('signature_kind', [
  'repair_acceptance', // customer approved a repair start
  'delivery_handover', // customer signed at handover
  'rental_agreement', // signed rental contract
  'quality_signoff', // internal QC sign-off signature
  'other',
]);

export const signatureSignerKind = pgEnum('signature_signer_kind', [
  'customer',
  'staff',
  'system',
]);

// --- Multi-location case operations (docs/03-data-model.md, Sprint 13) -------

export const caseAssignmentRole = pgEnum('case_assignment_role', [
  'body',
  'paint',
  'mechanical',
  'calibration',
  'assembly',
  'qc',
  'storage',
  'other',
]);

export const caseAssignmentStatus = pgEnum('case_assignment_status', [
  'active',
  'completed',
  'cancelled',
]);

export const caseTransferStatus = pgEnum('case_transfer_status', [
  'initiated', // source raised the transfer
  'in_transit', // accepted by target / dispatched
  'arrived', // confirmed at destination
  'cancelled',
]);

export const caseTransferMode = pgEnum('case_transfer_mode', [
  'drive', // driven under own power
  'tow', // tow truck
  'trailer',
  'other',
]);
