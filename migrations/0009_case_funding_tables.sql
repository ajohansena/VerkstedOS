CREATE TYPE "public"."case_party_role" AS ENUM('counterparty', 'witness', 'guarantor', 'third_party_payer', 'other');--> statement-breakpoint
CREATE TYPE "public"."case_status" AS ENUM('intake', 'active', 'on_hold', 'delivered', 'closed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."funding_source_kind" AS ENUM('insurance', 'private_pay', 'warranty', 'goodwill', 'internal_rework');--> statement-breakpoint
CREATE TYPE "public"."funding_source_status" AS ENUM('draft', 'active', 'invoiced', 'settled', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."insurance_claim_status" AS ENUM('open', 'approved', 'rejected', 'settled', 'cancelled');--> statement-breakpoint
CREATE TABLE "case_funding_sources" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"case_id" uuid NOT NULL,
	"sequence_no" integer DEFAULT 1 NOT NULL,
	"kind" "funding_source_kind" NOT NULL,
	"label" text NOT NULL,
	"insurance_claim_id" uuid,
	"payer_customer_id" uuid,
	"payer_insurance_id" uuid,
	"deductible_amount" numeric(14, 2),
	"deductible_payer_customer_id" uuid,
	"coverage_cap_amount" numeric(14, 2),
	"currency" varchar(3) DEFAULT 'NOK' NOT NULL,
	"status" "funding_source_status" DEFAULT 'draft' NOT NULL,
	"references_case_id" uuid,
	"rework_reason" text,
	"rework_owner_workshop_id" uuid,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" uuid,
	"updated_by" uuid
);
--> statement-breakpoint
CREATE TABLE "case_notes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"case_id" uuid NOT NULL,
	"body" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" uuid,
	"updated_by" uuid
);
--> statement-breakpoint
CREATE TABLE "case_parties" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"case_id" uuid NOT NULL,
	"role" "case_party_role" NOT NULL,
	"customer_id" uuid,
	"name" text,
	"contact_info" text,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" uuid,
	"updated_by" uuid
);
--> statement-breakpoint
CREATE TABLE "cases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"case_number" varchar(32) NOT NULL,
	"vehicle_id" uuid,
	"primary_customer_id" uuid,
	"incident_tag" text,
	"current_workshop_id" uuid,
	"status" "case_status" DEFAULT 'intake' NOT NULL,
	"opened_at" timestamp with time zone DEFAULT now() NOT NULL,
	"delivered_at" timestamp with time zone,
	"closed_at" timestamp with time zone,
	"parent_case_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" uuid,
	"updated_by" uuid
);
--> statement-breakpoint
CREATE TABLE "insurance_claims" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"claim_number" varchar(64),
	"insurance_company_id" uuid,
	"status" "insurance_claim_status" DEFAULT 'open' NOT NULL,
	"coverage_amount" numeric(14, 2),
	"currency" varchar(3) DEFAULT 'NOK' NOT NULL,
	"notes" text,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" uuid,
	"updated_by" uuid
);
--> statement-breakpoint
ALTER TABLE "case_funding_sources" ADD CONSTRAINT "case_funding_sources_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "case_funding_sources" ADD CONSTRAINT "case_funding_sources_case_id_cases_id_fk" FOREIGN KEY ("case_id") REFERENCES "public"."cases"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "case_funding_sources" ADD CONSTRAINT "case_funding_sources_insurance_claim_id_insurance_claims_id_fk" FOREIGN KEY ("insurance_claim_id") REFERENCES "public"."insurance_claims"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "case_funding_sources" ADD CONSTRAINT "case_funding_sources_payer_customer_id_customers_id_fk" FOREIGN KEY ("payer_customer_id") REFERENCES "public"."customers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "case_funding_sources" ADD CONSTRAINT "case_funding_sources_payer_insurance_id_insurance_companies_id_fk" FOREIGN KEY ("payer_insurance_id") REFERENCES "public"."insurance_companies"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "case_funding_sources" ADD CONSTRAINT "case_funding_sources_deductible_payer_customer_id_customers_id_fk" FOREIGN KEY ("deductible_payer_customer_id") REFERENCES "public"."customers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "case_funding_sources" ADD CONSTRAINT "case_funding_sources_references_case_id_cases_id_fk" FOREIGN KEY ("references_case_id") REFERENCES "public"."cases"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "case_funding_sources" ADD CONSTRAINT "case_funding_sources_rework_owner_workshop_id_workshops_id_fk" FOREIGN KEY ("rework_owner_workshop_id") REFERENCES "public"."workshops"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "case_notes" ADD CONSTRAINT "case_notes_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "case_notes" ADD CONSTRAINT "case_notes_case_id_cases_id_fk" FOREIGN KEY ("case_id") REFERENCES "public"."cases"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "case_parties" ADD CONSTRAINT "case_parties_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "case_parties" ADD CONSTRAINT "case_parties_case_id_cases_id_fk" FOREIGN KEY ("case_id") REFERENCES "public"."cases"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "case_parties" ADD CONSTRAINT "case_parties_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cases" ADD CONSTRAINT "cases_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cases" ADD CONSTRAINT "cases_vehicle_id_vehicles_id_fk" FOREIGN KEY ("vehicle_id") REFERENCES "public"."vehicles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cases" ADD CONSTRAINT "cases_primary_customer_id_customers_id_fk" FOREIGN KEY ("primary_customer_id") REFERENCES "public"."customers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cases" ADD CONSTRAINT "cases_current_workshop_id_workshops_id_fk" FOREIGN KEY ("current_workshop_id") REFERENCES "public"."workshops"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "insurance_claims" ADD CONSTRAINT "insurance_claims_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "insurance_claims" ADD CONSTRAINT "insurance_claims_insurance_company_id_insurance_companies_id_fk" FOREIGN KEY ("insurance_company_id") REFERENCES "public"."insurance_companies"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "case_funding_sources_case_idx" ON "case_funding_sources" USING btree ("organization_id","case_id");--> statement-breakpoint
CREATE INDEX "case_notes_case_idx" ON "case_notes" USING btree ("organization_id","case_id");--> statement-breakpoint
CREATE INDEX "case_parties_case_idx" ON "case_parties" USING btree ("organization_id","case_id");--> statement-breakpoint
CREATE UNIQUE INDEX "cases_org_number_uq" ON "cases" USING btree ("organization_id","case_number");--> statement-breakpoint
CREATE INDEX "cases_org_status_idx" ON "cases" USING btree ("organization_id","status");--> statement-breakpoint
CREATE INDEX "cases_vehicle_idx" ON "cases" USING btree ("vehicle_id");--> statement-breakpoint
CREATE INDEX "cases_customer_idx" ON "cases" USING btree ("primary_customer_id");--> statement-breakpoint
CREATE INDEX "insurance_claims_org_idx" ON "insurance_claims" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "insurance_claims_claim_number_idx" ON "insurance_claims" USING btree ("organization_id","claim_number");