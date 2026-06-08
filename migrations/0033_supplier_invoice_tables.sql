CREATE TYPE "public"."supplier_credit_note_reason" AS ENUM('return', 'price_correction', 'overbilling', 'damaged', 'other');--> statement-breakpoint
CREATE TYPE "public"."supplier_invoice_status" AS ENUM('draft', 'booked', 'matched', 'credited');--> statement-breakpoint
CREATE TABLE "supplier_credit_note_lines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"supplier_credit_note_id" uuid NOT NULL,
	"supplier_invoice_line_id" uuid,
	"case_id" uuid,
	"funding_source_id" uuid,
	"description" text,
	"quantity" numeric(12, 3) DEFAULT '1' NOT NULL,
	"unit_price_net" numeric(14, 2) DEFAULT '0' NOT NULL,
	"line_net" numeric(14, 2) DEFAULT '0' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" uuid,
	"updated_by" uuid
);
--> statement-breakpoint
CREATE TABLE "supplier_credit_notes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"supplier_invoice_id" uuid NOT NULL,
	"credit_note_number" varchar(64) NOT NULL,
	"credit_note_date" timestamp with time zone NOT NULL,
	"reason" "supplier_credit_note_reason" DEFAULT 'other' NOT NULL,
	"currency" varchar(3) DEFAULT 'NOK' NOT NULL,
	"total_gross" numeric(14, 2) DEFAULT '0' NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" uuid,
	"updated_by" uuid
);
--> statement-breakpoint
CREATE TABLE "supplier_invoice_lines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"supplier_invoice_id" uuid NOT NULL,
	"case_id" uuid,
	"funding_source_id" uuid,
	"purchase_order_line_id" uuid,
	"part_requirement_id" uuid,
	"description" text,
	"quantity" numeric(12, 3) DEFAULT '1' NOT NULL,
	"unit_price_net" numeric(14, 2) DEFAULT '0' NOT NULL,
	"line_net" numeric(14, 2) DEFAULT '0' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" uuid,
	"updated_by" uuid
);
--> statement-breakpoint
CREATE TABLE "supplier_invoices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"supplier_id" uuid NOT NULL,
	"invoice_number" varchar(64) NOT NULL,
	"invoice_date" timestamp with time zone NOT NULL,
	"due_date" timestamp with time zone,
	"currency" varchar(3) DEFAULT 'NOK' NOT NULL,
	"total_gross" numeric(14, 2) DEFAULT '0' NOT NULL,
	"status" "supplier_invoice_status" DEFAULT 'draft' NOT NULL,
	"booked_at" timestamp with time zone,
	"booked_by_user_id" uuid,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" uuid,
	"updated_by" uuid
);
--> statement-breakpoint
ALTER TABLE "supplier_credit_note_lines" ADD CONSTRAINT "supplier_credit_note_lines_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_credit_note_lines" ADD CONSTRAINT "supplier_credit_note_lines_supplier_credit_note_id_supplier_credit_notes_id_fk" FOREIGN KEY ("supplier_credit_note_id") REFERENCES "public"."supplier_credit_notes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_credit_note_lines" ADD CONSTRAINT "supplier_credit_note_lines_supplier_invoice_line_id_supplier_invoice_lines_id_fk" FOREIGN KEY ("supplier_invoice_line_id") REFERENCES "public"."supplier_invoice_lines"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_credit_note_lines" ADD CONSTRAINT "supplier_credit_note_lines_case_id_cases_id_fk" FOREIGN KEY ("case_id") REFERENCES "public"."cases"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_credit_note_lines" ADD CONSTRAINT "supplier_credit_note_lines_funding_source_id_case_funding_sources_id_fk" FOREIGN KEY ("funding_source_id") REFERENCES "public"."case_funding_sources"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_credit_notes" ADD CONSTRAINT "supplier_credit_notes_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_credit_notes" ADD CONSTRAINT "supplier_credit_notes_supplier_invoice_id_supplier_invoices_id_fk" FOREIGN KEY ("supplier_invoice_id") REFERENCES "public"."supplier_invoices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_invoice_lines" ADD CONSTRAINT "supplier_invoice_lines_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_invoice_lines" ADD CONSTRAINT "supplier_invoice_lines_supplier_invoice_id_supplier_invoices_id_fk" FOREIGN KEY ("supplier_invoice_id") REFERENCES "public"."supplier_invoices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_invoice_lines" ADD CONSTRAINT "supplier_invoice_lines_case_id_cases_id_fk" FOREIGN KEY ("case_id") REFERENCES "public"."cases"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_invoice_lines" ADD CONSTRAINT "supplier_invoice_lines_funding_source_id_case_funding_sources_id_fk" FOREIGN KEY ("funding_source_id") REFERENCES "public"."case_funding_sources"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_invoice_lines" ADD CONSTRAINT "supplier_invoice_lines_purchase_order_line_id_purchase_order_lines_id_fk" FOREIGN KEY ("purchase_order_line_id") REFERENCES "public"."purchase_order_lines"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_invoice_lines" ADD CONSTRAINT "supplier_invoice_lines_part_requirement_id_part_requirements_id_fk" FOREIGN KEY ("part_requirement_id") REFERENCES "public"."part_requirements"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_invoices" ADD CONSTRAINT "supplier_invoices_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_invoices" ADD CONSTRAINT "supplier_invoices_supplier_id_suppliers_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "supplier_credit_note_lines_note_idx" ON "supplier_credit_note_lines" USING btree ("organization_id","supplier_credit_note_id");--> statement-breakpoint
CREATE INDEX "supplier_credit_notes_invoice_idx" ON "supplier_credit_notes" USING btree ("organization_id","supplier_invoice_id");--> statement-breakpoint
CREATE INDEX "supplier_invoice_lines_invoice_idx" ON "supplier_invoice_lines" USING btree ("organization_id","supplier_invoice_id");--> statement-breakpoint
CREATE INDEX "supplier_invoice_lines_case_idx" ON "supplier_invoice_lines" USING btree ("organization_id","case_id");--> statement-breakpoint
CREATE UNIQUE INDEX "supplier_invoices_org_supplier_number_uq" ON "supplier_invoices" USING btree ("organization_id","supplier_id","invoice_number");--> statement-breakpoint
CREATE INDEX "supplier_invoices_org_status_idx" ON "supplier_invoices" USING btree ("organization_id","status");