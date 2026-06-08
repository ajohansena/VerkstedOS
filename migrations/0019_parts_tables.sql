CREATE TYPE "public"."inventory_movement_kind" AS ENUM('receipt', 'withdrawal', 'return', 'adjustment');--> statement-breakpoint
CREATE TYPE "public"."part_condition" AS ENUM('new', 'used', 'aftermarket', 'reconditioned');--> statement-breakpoint
CREATE TYPE "public"."part_lifecycle_event_kind" AS ENUM('requirement_created', 'requirement_updated', 'ordered', 'po_sent', 'received', 'withdrawn', 'returned', 'cancelled', 'fulfilled');--> statement-breakpoint
CREATE TYPE "public"."part_requirement_source" AS ENUM('estimate', 'manual', 'supplement');--> statement-breakpoint
CREATE TYPE "public"."part_requirement_status" AS ENUM('needed', 'sourcing', 'ordered', 'partially_received', 'received', 'fulfilled', 'returned', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."part_return_reason" AS ENUM('wrong_part', 'damaged', 'defective', 'surplus', 'no_longer_needed');--> statement-breakpoint
CREATE TYPE "public"."part_return_status" AS ENUM('requested', 'shipped', 'credited', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."purchase_order_line_status" AS ENUM('open', 'partially_received', 'received', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."purchase_order_status" AS ENUM('draft', 'sent', 'confirmed', 'partially_received', 'received', 'closed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."supplier_status" AS ENUM('active', 'inactive');--> statement-breakpoint
CREATE TABLE "inventory_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"workshop_id" uuid NOT NULL,
	"part_number" varchar(64) NOT NULL,
	"description" text NOT NULL,
	"quantity_on_hand" numeric(12, 3) DEFAULT '0' NOT NULL,
	"unit_cost" numeric(14, 2),
	"currency" varchar(3) DEFAULT 'NOK' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" uuid,
	"updated_by" uuid
);
--> statement-breakpoint
CREATE TABLE "inventory_stock_movements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"inventory_item_id" uuid NOT NULL,
	"kind" "inventory_movement_kind" NOT NULL,
	"quantity_delta" numeric(12, 3) NOT NULL,
	"reference_id" uuid,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" uuid,
	"updated_by" uuid
);
--> statement-breakpoint
CREATE TABLE "inventory_withdrawals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"inventory_item_id" uuid NOT NULL,
	"case_id" uuid NOT NULL,
	"part_requirement_id" uuid,
	"funding_source_id" uuid,
	"quantity" numeric(12, 3) DEFAULT '1' NOT NULL,
	"withdrawn_by_user_id" uuid,
	"withdrawn_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" uuid,
	"updated_by" uuid
);
--> statement-breakpoint
CREATE TABLE "part_lifecycle_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"part_requirement_id" uuid NOT NULL,
	"case_id" uuid NOT NULL,
	"kind" "part_lifecycle_event_kind" NOT NULL,
	"detail" jsonb,
	"actor_user_id" uuid,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "part_receipt_lines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"part_receipt_id" uuid NOT NULL,
	"purchase_order_line_id" uuid NOT NULL,
	"part_requirement_id" uuid,
	"quantity_received" numeric(12, 3) DEFAULT '1' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" uuid,
	"updated_by" uuid
);
--> statement-breakpoint
CREATE TABLE "part_receipts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"purchase_order_id" uuid NOT NULL,
	"received_by_user_id" uuid,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" uuid,
	"updated_by" uuid
);
--> statement-breakpoint
CREATE TABLE "part_requirements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"case_id" uuid NOT NULL,
	"estimate_part_id" uuid,
	"work_segment_id" uuid,
	"source" "part_requirement_source" DEFAULT 'manual' NOT NULL,
	"part_number" varchar(64),
	"description" text NOT NULL,
	"quantity" numeric(12, 3) DEFAULT '1' NOT NULL,
	"condition" "part_condition" DEFAULT 'new' NOT NULL,
	"funding_source_id" uuid,
	"unit_cost_estimate" numeric(14, 2),
	"currency" varchar(3) DEFAULT 'NOK' NOT NULL,
	"status" "part_requirement_status" DEFAULT 'needed' NOT NULL,
	"requested_by_user_id" uuid,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" uuid,
	"updated_by" uuid
);
--> statement-breakpoint
CREATE TABLE "part_return_lines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"part_return_id" uuid NOT NULL,
	"purchase_order_line_id" uuid NOT NULL,
	"part_requirement_id" uuid,
	"quantity_returned" numeric(12, 3) DEFAULT '1' NOT NULL,
	"reason" "part_return_reason" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" uuid,
	"updated_by" uuid
);
--> statement-breakpoint
CREATE TABLE "part_returns" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"supplier_id" uuid NOT NULL,
	"return_number" text,
	"status" "part_return_status" DEFAULT 'requested' NOT NULL,
	"initiated_by_user_id" uuid,
	"shipped_at" timestamp with time zone,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" uuid,
	"updated_by" uuid
);
--> statement-breakpoint
CREATE TABLE "purchase_order_lines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"purchase_order_id" uuid NOT NULL,
	"part_requirement_id" uuid,
	"case_id" uuid,
	"funding_source_id" uuid,
	"part_number" varchar(64),
	"description" text NOT NULL,
	"quantity_ordered" numeric(12, 3) DEFAULT '1' NOT NULL,
	"quantity_received" numeric(12, 3) DEFAULT '0' NOT NULL,
	"unit_price" numeric(14, 2),
	"currency" varchar(3) DEFAULT 'NOK' NOT NULL,
	"status" "purchase_order_line_status" DEFAULT 'open' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" uuid,
	"updated_by" uuid
);
--> statement-breakpoint
CREATE TABLE "purchase_orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"supplier_id" uuid NOT NULL,
	"workshop_id" uuid,
	"po_number" varchar(32) NOT NULL,
	"status" "purchase_order_status" DEFAULT 'draft' NOT NULL,
	"ordered_by_user_id" uuid,
	"sent_at" timestamp with time zone,
	"expected_delivery_at" timestamp with time zone,
	"currency" varchar(3) DEFAULT 'NOK' NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" uuid,
	"updated_by" uuid
);
--> statement-breakpoint
CREATE TABLE "supplier_agreements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"supplier_id" uuid NOT NULL,
	"label" text NOT NULL,
	"discount_factor" numeric(6, 4),
	"lead_time_days" numeric(5, 1),
	"currency" varchar(3) DEFAULT 'NOK' NOT NULL,
	"valid_from" timestamp with time zone,
	"valid_to" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" uuid,
	"updated_by" uuid
);
--> statement-breakpoint
CREATE TABLE "suppliers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"name" text NOT NULL,
	"org_number" varchar(16),
	"contact_email" text,
	"contact_phone" varchar(32),
	"status" "supplier_status" DEFAULT 'active' NOT NULL,
	"default_lead_time_days" numeric(5, 1),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" uuid,
	"updated_by" uuid
);
--> statement-breakpoint
ALTER TABLE "inventory_items" ADD CONSTRAINT "inventory_items_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_items" ADD CONSTRAINT "inventory_items_workshop_id_workshops_id_fk" FOREIGN KEY ("workshop_id") REFERENCES "public"."workshops"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_stock_movements" ADD CONSTRAINT "inventory_stock_movements_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_stock_movements" ADD CONSTRAINT "inventory_stock_movements_inventory_item_id_inventory_items_id_fk" FOREIGN KEY ("inventory_item_id") REFERENCES "public"."inventory_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_withdrawals" ADD CONSTRAINT "inventory_withdrawals_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_withdrawals" ADD CONSTRAINT "inventory_withdrawals_inventory_item_id_inventory_items_id_fk" FOREIGN KEY ("inventory_item_id") REFERENCES "public"."inventory_items"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_withdrawals" ADD CONSTRAINT "inventory_withdrawals_case_id_cases_id_fk" FOREIGN KEY ("case_id") REFERENCES "public"."cases"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_withdrawals" ADD CONSTRAINT "inventory_withdrawals_part_requirement_id_part_requirements_id_fk" FOREIGN KEY ("part_requirement_id") REFERENCES "public"."part_requirements"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_withdrawals" ADD CONSTRAINT "inventory_withdrawals_funding_source_id_case_funding_sources_id_fk" FOREIGN KEY ("funding_source_id") REFERENCES "public"."case_funding_sources"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "part_lifecycle_events" ADD CONSTRAINT "part_lifecycle_events_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "part_lifecycle_events" ADD CONSTRAINT "part_lifecycle_events_part_requirement_id_part_requirements_id_fk" FOREIGN KEY ("part_requirement_id") REFERENCES "public"."part_requirements"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "part_lifecycle_events" ADD CONSTRAINT "part_lifecycle_events_case_id_cases_id_fk" FOREIGN KEY ("case_id") REFERENCES "public"."cases"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "part_receipt_lines" ADD CONSTRAINT "part_receipt_lines_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "part_receipt_lines" ADD CONSTRAINT "part_receipt_lines_part_receipt_id_part_receipts_id_fk" FOREIGN KEY ("part_receipt_id") REFERENCES "public"."part_receipts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "part_receipt_lines" ADD CONSTRAINT "part_receipt_lines_purchase_order_line_id_purchase_order_lines_id_fk" FOREIGN KEY ("purchase_order_line_id") REFERENCES "public"."purchase_order_lines"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "part_receipt_lines" ADD CONSTRAINT "part_receipt_lines_part_requirement_id_part_requirements_id_fk" FOREIGN KEY ("part_requirement_id") REFERENCES "public"."part_requirements"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "part_receipts" ADD CONSTRAINT "part_receipts_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "part_receipts" ADD CONSTRAINT "part_receipts_purchase_order_id_purchase_orders_id_fk" FOREIGN KEY ("purchase_order_id") REFERENCES "public"."purchase_orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "part_requirements" ADD CONSTRAINT "part_requirements_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "part_requirements" ADD CONSTRAINT "part_requirements_case_id_cases_id_fk" FOREIGN KEY ("case_id") REFERENCES "public"."cases"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "part_requirements" ADD CONSTRAINT "part_requirements_estimate_part_id_estimate_parts_id_fk" FOREIGN KEY ("estimate_part_id") REFERENCES "public"."estimate_parts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "part_requirements" ADD CONSTRAINT "part_requirements_work_segment_id_work_segments_id_fk" FOREIGN KEY ("work_segment_id") REFERENCES "public"."work_segments"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "part_requirements" ADD CONSTRAINT "part_requirements_funding_source_id_case_funding_sources_id_fk" FOREIGN KEY ("funding_source_id") REFERENCES "public"."case_funding_sources"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "part_return_lines" ADD CONSTRAINT "part_return_lines_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "part_return_lines" ADD CONSTRAINT "part_return_lines_part_return_id_part_returns_id_fk" FOREIGN KEY ("part_return_id") REFERENCES "public"."part_returns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "part_return_lines" ADD CONSTRAINT "part_return_lines_purchase_order_line_id_purchase_order_lines_id_fk" FOREIGN KEY ("purchase_order_line_id") REFERENCES "public"."purchase_order_lines"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "part_return_lines" ADD CONSTRAINT "part_return_lines_part_requirement_id_part_requirements_id_fk" FOREIGN KEY ("part_requirement_id") REFERENCES "public"."part_requirements"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "part_returns" ADD CONSTRAINT "part_returns_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "part_returns" ADD CONSTRAINT "part_returns_supplier_id_suppliers_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_order_lines" ADD CONSTRAINT "purchase_order_lines_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_order_lines" ADD CONSTRAINT "purchase_order_lines_purchase_order_id_purchase_orders_id_fk" FOREIGN KEY ("purchase_order_id") REFERENCES "public"."purchase_orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_order_lines" ADD CONSTRAINT "purchase_order_lines_part_requirement_id_part_requirements_id_fk" FOREIGN KEY ("part_requirement_id") REFERENCES "public"."part_requirements"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_order_lines" ADD CONSTRAINT "purchase_order_lines_case_id_cases_id_fk" FOREIGN KEY ("case_id") REFERENCES "public"."cases"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_order_lines" ADD CONSTRAINT "purchase_order_lines_funding_source_id_case_funding_sources_id_fk" FOREIGN KEY ("funding_source_id") REFERENCES "public"."case_funding_sources"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_supplier_id_suppliers_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_workshop_id_workshops_id_fk" FOREIGN KEY ("workshop_id") REFERENCES "public"."workshops"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_agreements" ADD CONSTRAINT "supplier_agreements_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_agreements" ADD CONSTRAINT "supplier_agreements_supplier_id_suppliers_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "suppliers" ADD CONSTRAINT "suppliers_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "inventory_items_org_workshop_part_uq" ON "inventory_items" USING btree ("organization_id","workshop_id","part_number");--> statement-breakpoint
CREATE INDEX "inventory_stock_movements_item_idx" ON "inventory_stock_movements" USING btree ("organization_id","inventory_item_id");--> statement-breakpoint
CREATE INDEX "inventory_withdrawals_case_idx" ON "inventory_withdrawals" USING btree ("organization_id","case_id");--> statement-breakpoint
CREATE INDEX "part_lifecycle_events_requirement_idx" ON "part_lifecycle_events" USING btree ("organization_id","part_requirement_id","occurred_at");--> statement-breakpoint
CREATE INDEX "part_receipt_lines_receipt_idx" ON "part_receipt_lines" USING btree ("organization_id","part_receipt_id");--> statement-breakpoint
CREATE INDEX "part_receipts_po_idx" ON "part_receipts" USING btree ("organization_id","purchase_order_id");--> statement-breakpoint
CREATE INDEX "part_requirements_case_idx" ON "part_requirements" USING btree ("organization_id","case_id","status");--> statement-breakpoint
CREATE INDEX "part_return_lines_return_idx" ON "part_return_lines" USING btree ("organization_id","part_return_id");--> statement-breakpoint
CREATE INDEX "part_returns_supplier_idx" ON "part_returns" USING btree ("organization_id","supplier_id","status");--> statement-breakpoint
CREATE INDEX "purchase_order_lines_po_idx" ON "purchase_order_lines" USING btree ("organization_id","purchase_order_id");--> statement-breakpoint
CREATE INDEX "purchase_order_lines_requirement_idx" ON "purchase_order_lines" USING btree ("organization_id","part_requirement_id");--> statement-breakpoint
CREATE UNIQUE INDEX "purchase_orders_org_number_uq" ON "purchase_orders" USING btree ("organization_id","po_number");--> statement-breakpoint
CREATE INDEX "purchase_orders_supplier_idx" ON "purchase_orders" USING btree ("organization_id","supplier_id","status");--> statement-breakpoint
CREATE INDEX "supplier_agreements_supplier_idx" ON "supplier_agreements" USING btree ("organization_id","supplier_id");--> statement-breakpoint
CREATE INDEX "suppliers_org_idx" ON "suppliers" USING btree ("organization_id","status");