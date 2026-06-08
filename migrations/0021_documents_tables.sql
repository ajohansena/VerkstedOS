CREATE TYPE "public"."document_access_action" AS ENUM('viewed', 'downloaded', 'signed_url_issued');--> statement-breakpoint
CREATE TYPE "public"."document_kind" AS ENUM('photo', 'estimate_file', 'supplier_invoice', 'credit_note', 'insurance_document', 'customer_attachment', 'email_attachment', 'internal', 'generated_invoice', 'signed_agreement', 'quality_report', 'other');--> statement-breakpoint
CREATE TYPE "public"."document_link_entity_type" AS ENUM('case', 'claim', 'customer', 'vehicle', 'supplier_invoice', 'purchase_order', 'communication', 'work_segment', 'checklist_run', 'invoice_basis');--> statement-breakpoint
CREATE TYPE "public"."document_link_role" AS ENUM('primary', 'attachment', 'before_photo', 'during_photo', 'after_photo', 'estimate_source', 'invoice_source', 'credit_source', 'signed_copy', 'generated_output', 'reference');--> statement-breakpoint
CREATE TYPE "public"."document_sensitivity" AS ENUM('public', 'internal', 'confidential', 'restricted');--> statement-breakpoint
CREATE TYPE "public"."document_source" AS ENUM('upload', 'email', 'dbs_import', 'api', 'webhook', 'generated', 'scan', 'system');--> statement-breakpoint
CREATE TYPE "public"."document_uploader_kind" AS ENUM('user', 'system', 'integration', 'customer_portal');--> statement-breakpoint
CREATE TABLE "document_access_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"document_id" uuid NOT NULL,
	"action" "document_access_action" NOT NULL,
	"actor_user_id" uuid,
	"detail" text,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "document_links" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"document_id" uuid NOT NULL,
	"linked_entity_type" "document_link_entity_type" NOT NULL,
	"linked_entity_id" uuid NOT NULL,
	"role" "document_link_role" DEFAULT 'attachment' NOT NULL,
	"linked_by_user_id" uuid,
	"linked_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" uuid,
	"updated_by" uuid
);
--> statement-breakpoint
CREATE TABLE "documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"kind" "document_kind" NOT NULL,
	"source" "document_source" DEFAULT 'upload' NOT NULL,
	"sensitivity" "document_sensitivity" DEFAULT 'internal' NOT NULL,
	"storage_bucket" varchar(64) NOT NULL,
	"storage_path" text NOT NULL,
	"original_filename" text,
	"content_type" varchar(128),
	"byte_size" integer,
	"checksum_sha256" varchar(64),
	"variants" jsonb,
	"version_number" integer DEFAULT 1 NOT NULL,
	"supersedes_id" uuid,
	"is_current_version" boolean DEFAULT true NOT NULL,
	"uploaded_by_user_id" uuid,
	"uploaded_by_kind" "document_uploader_kind" DEFAULT 'user' NOT NULL,
	"uploaded_at" timestamp with time zone DEFAULT now() NOT NULL,
	"is_signed" boolean DEFAULT false NOT NULL,
	"signature_chain_id" uuid,
	"is_processed" boolean DEFAULT false NOT NULL,
	"retention_until" timestamp with time zone,
	"metadata" jsonb,
	"deleted_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" uuid,
	"updated_by" uuid
);
--> statement-breakpoint
ALTER TABLE "document_access_events" ADD CONSTRAINT "document_access_events_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_access_events" ADD CONSTRAINT "document_access_events_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_links" ADD CONSTRAINT "document_links_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_links" ADD CONSTRAINT "document_links_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "document_access_events_doc_idx" ON "document_access_events" USING btree ("organization_id","document_id","occurred_at");--> statement-breakpoint
CREATE INDEX "document_links_entity_idx" ON "document_links" USING btree ("organization_id","linked_entity_type","linked_entity_id");--> statement-breakpoint
CREATE INDEX "document_links_document_idx" ON "document_links" USING btree ("organization_id","document_id");--> statement-breakpoint
CREATE INDEX "documents_org_kind_idx" ON "documents" USING btree ("organization_id","kind","is_current_version");