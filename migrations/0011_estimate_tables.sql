CREATE TYPE "public"."estimate_import_kind" AS ENUM('original', 'supplement', 're_estimate');--> statement-breakpoint
CREATE TYPE "public"."estimate_import_status" AS ENUM('draft', 'active', 'locked', 'superseded');--> statement-breakpoint
CREATE TYPE "public"."estimate_line_category" AS ENUM('body_labor', 'panel_beating', 'rust_protection', 'paint_labor', 'paint_material', 'part', 'external_work', 'other');--> statement-breakpoint
CREATE TYPE "public"."estimate_source" AS ENUM('dbs', 'manual', 'api');--> statement-breakpoint
CREATE TYPE "public"."integration_inbox_status" AS ENUM('received', 'processing', 'processed', 'failed');--> statement-breakpoint
CREATE TABLE "estimate_documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"estimate_import_id" uuid NOT NULL,
	"estimate_number" varchar(64),
	"work_order_number" varchar(64),
	"insurer_name" text,
	"owner_name" text,
	"damage_type" varchar(64),
	"object_group" text,
	"vehicle_description" text,
	"vin" varchar(32),
	"registration_number" varchar(16),
	"mileage_km" integer,
	"colour_code" varchar(64),
	"normal_repair_days" integer,
	"dates" jsonb,
	"workshop_ref" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" uuid,
	"updated_by" uuid
);
--> statement-breakpoint
CREATE TABLE "estimate_imports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"case_id" uuid NOT NULL,
	"source" "estimate_source" DEFAULT 'dbs' NOT NULL,
	"kind" "estimate_import_kind" DEFAULT 'original' NOT NULL,
	"status" "estimate_import_status" DEFAULT 'draft' NOT NULL,
	"version_number" integer DEFAULT 1 NOT NULL,
	"supersedes_id" uuid,
	"oppdrags_id" text,
	"skadenr" text,
	"locked_at" timestamp with time zone,
	"locked_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" uuid,
	"updated_by" uuid
);
--> statement-breakpoint
CREATE TABLE "estimate_labor_lines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"estimate_import_id" uuid NOT NULL,
	"position" text,
	"operation_code" varchar(32),
	"description" text NOT NULL,
	"time_periods" integer DEFAULT 0 NOT NULL,
	"sequence_no" integer DEFAULT 0 NOT NULL,
	"funding_source_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" uuid,
	"updated_by" uuid
);
--> statement-breakpoint
CREATE TABLE "estimate_operations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"estimate_import_id" uuid NOT NULL,
	"category" "estimate_line_category" DEFAULT 'body_labor' NOT NULL,
	"description" text NOT NULL,
	"action" varchar(64),
	"side" varchar(2),
	"time_periods" integer DEFAULT 0 NOT NULL,
	"labor_rate" numeric(14, 2),
	"currency" varchar(3) DEFAULT 'NOK' NOT NULL,
	"sequence_no" integer DEFAULT 0 NOT NULL,
	"funding_source_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" uuid,
	"updated_by" uuid
);
--> statement-breakpoint
CREATE TABLE "estimate_paint_lines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"estimate_import_id" uuid NOT NULL,
	"description" text NOT NULL,
	"is_material" integer DEFAULT 0 NOT NULL,
	"time_periods" integer DEFAULT 0 NOT NULL,
	"labor_rate" numeric(14, 2),
	"amount" numeric(14, 2),
	"currency" varchar(3) DEFAULT 'NOK' NOT NULL,
	"sequence_no" integer DEFAULT 0 NOT NULL,
	"funding_source_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" uuid,
	"updated_by" uuid
);
--> statement-breakpoint
CREATE TABLE "estimate_parts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"estimate_import_id" uuid NOT NULL,
	"part_number" varchar(64),
	"description" text NOT NULL,
	"list_price" numeric(14, 2),
	"discount_factor" varchar(32),
	"amount" numeric(14, 2),
	"currency" varchar(3) DEFAULT 'NOK' NOT NULL,
	"funding_source_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" uuid,
	"updated_by" uuid
);
--> statement-breakpoint
CREATE TABLE "estimate_totals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"estimate_import_id" uuid NOT NULL,
	"body_labor_periods" integer DEFAULT 0 NOT NULL,
	"body_labor_amount" numeric(14, 2),
	"panel_beating_periods" integer DEFAULT 0 NOT NULL,
	"rust_protection_periods" integer DEFAULT 0 NOT NULL,
	"paint_labor_periods" integer DEFAULT 0 NOT NULL,
	"paint_labor_amount" numeric(14, 2),
	"paint_material_amount" numeric(14, 2),
	"parts_amount" numeric(14, 2),
	"external_work_amount" numeric(14, 2),
	"sum_ex_vat" numeric(14, 2),
	"vat_rate" numeric(5, 2),
	"vat_amount" numeric(14, 2),
	"total_amount" numeric(14, 2),
	"fixed_price_agreement" numeric(14, 2),
	"currency" varchar(3) DEFAULT 'NOK' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" uuid,
	"updated_by" uuid
);
--> statement-breakpoint
CREATE TABLE "integration_inbox" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid,
	"source" text NOT NULL,
	"message_type" text,
	"external_ref" text,
	"status" "integration_inbox_status" DEFAULT 'received' NOT NULL,
	"payload" jsonb NOT NULL,
	"parse_error" text,
	"produced_import_id" uuid,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	"processed_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "estimate_documents" ADD CONSTRAINT "estimate_documents_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "estimate_documents" ADD CONSTRAINT "estimate_documents_estimate_import_id_estimate_imports_id_fk" FOREIGN KEY ("estimate_import_id") REFERENCES "public"."estimate_imports"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "estimate_imports" ADD CONSTRAINT "estimate_imports_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "estimate_imports" ADD CONSTRAINT "estimate_imports_case_id_cases_id_fk" FOREIGN KEY ("case_id") REFERENCES "public"."cases"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "estimate_labor_lines" ADD CONSTRAINT "estimate_labor_lines_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "estimate_labor_lines" ADD CONSTRAINT "estimate_labor_lines_estimate_import_id_estimate_imports_id_fk" FOREIGN KEY ("estimate_import_id") REFERENCES "public"."estimate_imports"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "estimate_labor_lines" ADD CONSTRAINT "estimate_labor_lines_funding_source_id_case_funding_sources_id_fk" FOREIGN KEY ("funding_source_id") REFERENCES "public"."case_funding_sources"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "estimate_operations" ADD CONSTRAINT "estimate_operations_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "estimate_operations" ADD CONSTRAINT "estimate_operations_estimate_import_id_estimate_imports_id_fk" FOREIGN KEY ("estimate_import_id") REFERENCES "public"."estimate_imports"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "estimate_operations" ADD CONSTRAINT "estimate_operations_funding_source_id_case_funding_sources_id_fk" FOREIGN KEY ("funding_source_id") REFERENCES "public"."case_funding_sources"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "estimate_paint_lines" ADD CONSTRAINT "estimate_paint_lines_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "estimate_paint_lines" ADD CONSTRAINT "estimate_paint_lines_estimate_import_id_estimate_imports_id_fk" FOREIGN KEY ("estimate_import_id") REFERENCES "public"."estimate_imports"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "estimate_paint_lines" ADD CONSTRAINT "estimate_paint_lines_funding_source_id_case_funding_sources_id_fk" FOREIGN KEY ("funding_source_id") REFERENCES "public"."case_funding_sources"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "estimate_parts" ADD CONSTRAINT "estimate_parts_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "estimate_parts" ADD CONSTRAINT "estimate_parts_estimate_import_id_estimate_imports_id_fk" FOREIGN KEY ("estimate_import_id") REFERENCES "public"."estimate_imports"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "estimate_parts" ADD CONSTRAINT "estimate_parts_funding_source_id_case_funding_sources_id_fk" FOREIGN KEY ("funding_source_id") REFERENCES "public"."case_funding_sources"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "estimate_totals" ADD CONSTRAINT "estimate_totals_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "estimate_totals" ADD CONSTRAINT "estimate_totals_estimate_import_id_estimate_imports_id_fk" FOREIGN KEY ("estimate_import_id") REFERENCES "public"."estimate_imports"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "integration_inbox" ADD CONSTRAINT "integration_inbox_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "estimate_imports_case_idx" ON "estimate_imports" USING btree ("organization_id","case_id");--> statement-breakpoint
CREATE INDEX "estimate_imports_oppdrags_idx" ON "estimate_imports" USING btree ("oppdrags_id");--> statement-breakpoint
CREATE INDEX "estimate_labor_lines_import_idx" ON "estimate_labor_lines" USING btree ("organization_id","estimate_import_id");--> statement-breakpoint
CREATE INDEX "estimate_operations_import_idx" ON "estimate_operations" USING btree ("organization_id","estimate_import_id");--> statement-breakpoint
CREATE INDEX "estimate_paint_lines_import_idx" ON "estimate_paint_lines" USING btree ("organization_id","estimate_import_id");--> statement-breakpoint
CREATE INDEX "estimate_parts_import_idx" ON "estimate_parts" USING btree ("organization_id","estimate_import_id");--> statement-breakpoint
CREATE INDEX "integration_inbox_status_idx" ON "integration_inbox" USING btree ("status");--> statement-breakpoint
CREATE INDEX "integration_inbox_external_ref_idx" ON "integration_inbox" USING btree ("external_ref");