CREATE TYPE "public"."accounting_export_status" AS ENUM('pending', 'sent', 'failed', 'acknowledged');--> statement-breakpoint
CREATE TYPE "public"."accounting_target" AS ENUM('tripletex');--> statement-breakpoint
CREATE TYPE "public"."invoice_basis_kind" AS ENUM('standard', 'deductible', 'internal');--> statement-breakpoint
CREATE TYPE "public"."invoice_basis_line_kind" AS ENUM('body_labor', 'paint_labor', 'paint_material', 'parts', 'external_work', 'deductible', 'other');--> statement-breakpoint
CREATE TYPE "public"."invoice_basis_status" AS ENUM('draft', 'approved', 'exported', 'settled', 'cancelled');--> statement-breakpoint
CREATE TABLE "accounting_export_lines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"accounting_export_id" uuid NOT NULL,
	"invoice_basis_id" uuid NOT NULL,
	"currency" varchar(3) DEFAULT 'NOK' NOT NULL,
	"net_amount" numeric(14, 2) DEFAULT '0' NOT NULL,
	"vat_amount" numeric(14, 2) DEFAULT '0' NOT NULL,
	"gross_amount" numeric(14, 2) DEFAULT '0' NOT NULL,
	"external_line_ref" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" uuid,
	"updated_by" uuid
);
--> statement-breakpoint
CREATE TABLE "accounting_exports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"target" "accounting_target" DEFAULT 'tripletex' NOT NULL,
	"status" "accounting_export_status" DEFAULT 'pending' NOT NULL,
	"requested_by_user_id" uuid,
	"requested_at" timestamp with time zone DEFAULT now() NOT NULL,
	"sent_at" timestamp with time zone,
	"acknowledged_at" timestamp with time zone,
	"external_ref" text,
	"error_message" text,
	"attempt_count" integer DEFAULT 0 NOT NULL,
	"payload_hash" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" uuid,
	"updated_by" uuid
);
--> statement-breakpoint
CREATE TABLE "invoice_basis" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"case_id" uuid NOT NULL,
	"funding_source_id" uuid NOT NULL,
	"deductible_of_funding_source_id" uuid,
	"basis_number" varchar(32) NOT NULL,
	"kind" "invoice_basis_kind" DEFAULT 'standard' NOT NULL,
	"payer_type" varchar(32) NOT NULL,
	"payer_customer_id" uuid,
	"payer_insurance_id" uuid,
	"currency" varchar(3) DEFAULT 'NOK' NOT NULL,
	"net_amount" numeric(14, 2) DEFAULT '0' NOT NULL,
	"vat_amount" numeric(14, 2) DEFAULT '0' NOT NULL,
	"gross_amount" numeric(14, 2) DEFAULT '0' NOT NULL,
	"status" "invoice_basis_status" DEFAULT 'draft' NOT NULL,
	"approved_at" timestamp with time zone,
	"approved_by_user_id" uuid,
	"exported_at" timestamp with time zone,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" uuid,
	"updated_by" uuid
);
--> statement-breakpoint
CREATE TABLE "invoice_basis_lines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"invoice_basis_id" uuid NOT NULL,
	"case_id" uuid NOT NULL,
	"funding_source_id" uuid,
	"line_kind" "invoice_basis_line_kind" DEFAULT 'other' NOT NULL,
	"description" text NOT NULL,
	"quantity" numeric(12, 3) DEFAULT '1' NOT NULL,
	"unit_price_net" numeric(14, 2) DEFAULT '0' NOT NULL,
	"vat_rate" numeric(5, 2) DEFAULT '25' NOT NULL,
	"line_net" numeric(14, 2) DEFAULT '0' NOT NULL,
	"line_vat" numeric(14, 2) DEFAULT '0' NOT NULL,
	"line_gross" numeric(14, 2) DEFAULT '0' NOT NULL,
	"source_ref" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" uuid,
	"updated_by" uuid
);
--> statement-breakpoint
ALTER TABLE "accounting_export_lines" ADD CONSTRAINT "accounting_export_lines_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "accounting_export_lines" ADD CONSTRAINT "accounting_export_lines_accounting_export_id_accounting_exports_id_fk" FOREIGN KEY ("accounting_export_id") REFERENCES "public"."accounting_exports"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "accounting_export_lines" ADD CONSTRAINT "accounting_export_lines_invoice_basis_id_invoice_basis_id_fk" FOREIGN KEY ("invoice_basis_id") REFERENCES "public"."invoice_basis"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "accounting_exports" ADD CONSTRAINT "accounting_exports_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_basis" ADD CONSTRAINT "invoice_basis_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_basis" ADD CONSTRAINT "invoice_basis_case_id_cases_id_fk" FOREIGN KEY ("case_id") REFERENCES "public"."cases"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_basis" ADD CONSTRAINT "invoice_basis_funding_source_id_case_funding_sources_id_fk" FOREIGN KEY ("funding_source_id") REFERENCES "public"."case_funding_sources"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_basis" ADD CONSTRAINT "invoice_basis_deductible_of_funding_source_id_case_funding_sources_id_fk" FOREIGN KEY ("deductible_of_funding_source_id") REFERENCES "public"."case_funding_sources"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_basis" ADD CONSTRAINT "invoice_basis_payer_customer_id_customers_id_fk" FOREIGN KEY ("payer_customer_id") REFERENCES "public"."customers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_basis" ADD CONSTRAINT "invoice_basis_payer_insurance_id_insurance_companies_id_fk" FOREIGN KEY ("payer_insurance_id") REFERENCES "public"."insurance_companies"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_basis_lines" ADD CONSTRAINT "invoice_basis_lines_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_basis_lines" ADD CONSTRAINT "invoice_basis_lines_invoice_basis_id_invoice_basis_id_fk" FOREIGN KEY ("invoice_basis_id") REFERENCES "public"."invoice_basis"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_basis_lines" ADD CONSTRAINT "invoice_basis_lines_case_id_cases_id_fk" FOREIGN KEY ("case_id") REFERENCES "public"."cases"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_basis_lines" ADD CONSTRAINT "invoice_basis_lines_funding_source_id_case_funding_sources_id_fk" FOREIGN KEY ("funding_source_id") REFERENCES "public"."case_funding_sources"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "accounting_export_lines_export_idx" ON "accounting_export_lines" USING btree ("organization_id","accounting_export_id");--> statement-breakpoint
CREATE INDEX "accounting_exports_status_idx" ON "accounting_exports" USING btree ("organization_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "invoice_basis_org_number_uq" ON "invoice_basis" USING btree ("organization_id","basis_number");--> statement-breakpoint
CREATE INDEX "invoice_basis_case_idx" ON "invoice_basis" USING btree ("organization_id","case_id");--> statement-breakpoint
CREATE INDEX "invoice_basis_status_idx" ON "invoice_basis" USING btree ("organization_id","status");--> statement-breakpoint
CREATE INDEX "invoice_basis_lines_basis_idx" ON "invoice_basis_lines" USING btree ("organization_id","invoice_basis_id");--> statement-breakpoint
CREATE INDEX "invoice_basis_lines_case_idx" ON "invoice_basis_lines" USING btree ("organization_id","case_id");