CREATE TYPE "public"."case_assignment_role" AS ENUM('body', 'paint', 'mechanical', 'calibration', 'assembly', 'qc', 'storage', 'other');--> statement-breakpoint
CREATE TYPE "public"."case_assignment_status" AS ENUM('active', 'completed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."case_transfer_mode" AS ENUM('drive', 'tow', 'trailer', 'other');--> statement-breakpoint
CREATE TYPE "public"."case_transfer_status" AS ENUM('initiated', 'in_transit', 'arrived', 'cancelled');--> statement-breakpoint
CREATE TABLE "case_assignments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"case_id" uuid NOT NULL,
	"workshop_id" uuid NOT NULL,
	"department_id" uuid,
	"role" "case_assignment_role" DEFAULT 'other' NOT NULL,
	"sequence_no" integer DEFAULT 0 NOT NULL,
	"status" "case_assignment_status" DEFAULT 'active' NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ended_at" timestamp with time zone,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" uuid,
	"updated_by" uuid
);
--> statement-breakpoint
CREATE TABLE "case_transfers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"case_id" uuid NOT NULL,
	"from_workshop_id" uuid,
	"to_workshop_id" uuid NOT NULL,
	"status" "case_transfer_status" DEFAULT 'initiated' NOT NULL,
	"transport_mode" "case_transfer_mode" DEFAULT 'drive' NOT NULL,
	"reason" text,
	"initiated_by_user_id" uuid,
	"accepted_by_user_id" uuid,
	"arrived_confirmed_by_user_id" uuid,
	"initiated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expected_arrival_at" timestamp with time zone,
	"dispatched_at" timestamp with time zone,
	"arrived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" uuid,
	"updated_by" uuid
);
--> statement-breakpoint
ALTER TABLE "case_assignments" ADD CONSTRAINT "case_assignments_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "case_assignments" ADD CONSTRAINT "case_assignments_case_id_cases_id_fk" FOREIGN KEY ("case_id") REFERENCES "public"."cases"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "case_assignments" ADD CONSTRAINT "case_assignments_workshop_id_workshops_id_fk" FOREIGN KEY ("workshop_id") REFERENCES "public"."workshops"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "case_assignments" ADD CONSTRAINT "case_assignments_department_id_workshop_departments_id_fk" FOREIGN KEY ("department_id") REFERENCES "public"."workshop_departments"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "case_transfers" ADD CONSTRAINT "case_transfers_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "case_transfers" ADD CONSTRAINT "case_transfers_case_id_cases_id_fk" FOREIGN KEY ("case_id") REFERENCES "public"."cases"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "case_transfers" ADD CONSTRAINT "case_transfers_from_workshop_id_workshops_id_fk" FOREIGN KEY ("from_workshop_id") REFERENCES "public"."workshops"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "case_transfers" ADD CONSTRAINT "case_transfers_to_workshop_id_workshops_id_fk" FOREIGN KEY ("to_workshop_id") REFERENCES "public"."workshops"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "case_assignments_case_idx" ON "case_assignments" USING btree ("organization_id","case_id","sequence_no");--> statement-breakpoint
CREATE INDEX "case_assignments_workshop_idx" ON "case_assignments" USING btree ("organization_id","workshop_id","status");--> statement-breakpoint
CREATE INDEX "case_transfers_case_idx" ON "case_transfers" USING btree ("organization_id","case_id");--> statement-breakpoint
CREATE INDEX "case_transfers_inbound_idx" ON "case_transfers" USING btree ("organization_id","to_workshop_id","status");