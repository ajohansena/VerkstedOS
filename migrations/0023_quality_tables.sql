CREATE TYPE "public"."checklist_response_result" AS ENUM('pass', 'fail', 'na');--> statement-breakpoint
CREATE TYPE "public"."checklist_run_status" AS ENUM('in_progress', 'passed', 'failed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."checklist_template_kind" AS ENUM('delivery', 'calibration', 'paint', 'general');--> statement-breakpoint
CREATE TYPE "public"."quality_deviation_severity" AS ENUM('minor', 'major', 'critical');--> statement-breakpoint
CREATE TYPE "public"."quality_deviation_status" AS ENUM('open', 'in_progress', 'resolved', 'cancelled');--> statement-breakpoint
CREATE TABLE "checklist_responses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"checklist_run_id" uuid NOT NULL,
	"template_item_id" uuid NOT NULL,
	"result" "checklist_response_result" NOT NULL,
	"comment" text,
	"photo_document_id" uuid,
	"responded_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" uuid,
	"updated_by" uuid
);
--> statement-breakpoint
CREATE TABLE "checklist_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"case_id" uuid NOT NULL,
	"template_id" uuid NOT NULL,
	"workshop_id" uuid,
	"work_segment_id" uuid,
	"status" "checklist_run_status" DEFAULT 'in_progress' NOT NULL,
	"started_by_user_id" uuid,
	"signed_off_by_user_id" uuid,
	"signed_off_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" uuid,
	"updated_by" uuid
);
--> statement-breakpoint
CREATE TABLE "checklist_template_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"template_id" uuid NOT NULL,
	"label" text NOT NULL,
	"sequence_no" integer DEFAULT 0 NOT NULL,
	"is_required" boolean DEFAULT true NOT NULL,
	"requires_comment_on_fail" boolean DEFAULT true NOT NULL,
	"requires_photo_on_fail" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" uuid,
	"updated_by" uuid
);
--> statement-breakpoint
CREATE TABLE "checklist_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"workshop_id" uuid,
	"code" varchar(64) NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"kind" "checklist_template_kind" DEFAULT 'general' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"version_number" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" uuid,
	"updated_by" uuid
);
--> statement-breakpoint
CREATE TABLE "quality_deviations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"case_id" uuid NOT NULL,
	"workshop_id" uuid,
	"checklist_run_id" uuid,
	"title" text NOT NULL,
	"description" text,
	"severity" "quality_deviation_severity" DEFAULT 'minor' NOT NULL,
	"status" "quality_deviation_status" DEFAULT 'open' NOT NULL,
	"rework_funding_source_id" uuid,
	"raised_by_user_id" uuid,
	"resolved_by_user_id" uuid,
	"resolved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" uuid,
	"updated_by" uuid
);
--> statement-breakpoint
ALTER TABLE "checklist_responses" ADD CONSTRAINT "checklist_responses_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "checklist_responses" ADD CONSTRAINT "checklist_responses_checklist_run_id_checklist_runs_id_fk" FOREIGN KEY ("checklist_run_id") REFERENCES "public"."checklist_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "checklist_responses" ADD CONSTRAINT "checklist_responses_template_item_id_checklist_template_items_id_fk" FOREIGN KEY ("template_item_id") REFERENCES "public"."checklist_template_items"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "checklist_responses" ADD CONSTRAINT "checklist_responses_photo_document_id_documents_id_fk" FOREIGN KEY ("photo_document_id") REFERENCES "public"."documents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "checklist_runs" ADD CONSTRAINT "checklist_runs_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "checklist_runs" ADD CONSTRAINT "checklist_runs_case_id_cases_id_fk" FOREIGN KEY ("case_id") REFERENCES "public"."cases"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "checklist_runs" ADD CONSTRAINT "checklist_runs_template_id_checklist_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."checklist_templates"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "checklist_runs" ADD CONSTRAINT "checklist_runs_workshop_id_workshops_id_fk" FOREIGN KEY ("workshop_id") REFERENCES "public"."workshops"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "checklist_runs" ADD CONSTRAINT "checklist_runs_work_segment_id_work_segments_id_fk" FOREIGN KEY ("work_segment_id") REFERENCES "public"."work_segments"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "checklist_template_items" ADD CONSTRAINT "checklist_template_items_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "checklist_template_items" ADD CONSTRAINT "checklist_template_items_template_id_checklist_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."checklist_templates"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "checklist_templates" ADD CONSTRAINT "checklist_templates_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "checklist_templates" ADD CONSTRAINT "checklist_templates_workshop_id_workshops_id_fk" FOREIGN KEY ("workshop_id") REFERENCES "public"."workshops"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quality_deviations" ADD CONSTRAINT "quality_deviations_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quality_deviations" ADD CONSTRAINT "quality_deviations_case_id_cases_id_fk" FOREIGN KEY ("case_id") REFERENCES "public"."cases"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quality_deviations" ADD CONSTRAINT "quality_deviations_workshop_id_workshops_id_fk" FOREIGN KEY ("workshop_id") REFERENCES "public"."workshops"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quality_deviations" ADD CONSTRAINT "quality_deviations_checklist_run_id_checklist_runs_id_fk" FOREIGN KEY ("checklist_run_id") REFERENCES "public"."checklist_runs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quality_deviations" ADD CONSTRAINT "quality_deviations_rework_funding_source_id_case_funding_sources_id_fk" FOREIGN KEY ("rework_funding_source_id") REFERENCES "public"."case_funding_sources"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "checklist_responses_run_item_uq" ON "checklist_responses" USING btree ("organization_id","checklist_run_id","template_item_id");--> statement-breakpoint
CREATE INDEX "checklist_runs_case_idx" ON "checklist_runs" USING btree ("organization_id","case_id","status");--> statement-breakpoint
CREATE INDEX "checklist_template_items_template_idx" ON "checklist_template_items" USING btree ("organization_id","template_id");--> statement-breakpoint
CREATE UNIQUE INDEX "checklist_templates_org_workshop_code_uq" ON "checklist_templates" USING btree ("organization_id","workshop_id","code");--> statement-breakpoint
CREATE INDEX "checklist_templates_org_idx" ON "checklist_templates" USING btree ("organization_id","is_active");--> statement-breakpoint
CREATE INDEX "quality_deviations_case_idx" ON "quality_deviations" USING btree ("organization_id","case_id","status");