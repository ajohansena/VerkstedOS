CREATE TYPE "public"."resource_assignment_role" AS ENUM('primary', 'assist', 'observer');--> statement-breakpoint
CREATE TYPE "public"."resource_assignment_status" AS ENUM('planned', 'confirmed', 'in_progress', 'completed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."segment_dependency_kind" AS ENUM('must_complete_before', 'must_start_before', 'soft_preferred');--> statement-breakpoint
CREATE TYPE "public"."task_status" AS ENUM('not_started', 'in_progress', 'completed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."work_segment_status" AS ENUM('not_started', 'queued', 'in_progress', 'paused', 'blocked', 'completed', 'cancelled');--> statement-breakpoint
CREATE TABLE "capacity_forecast_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"workshop_id" uuid,
	"resource_id" uuid NOT NULL,
	"forecast_date" date NOT NULL,
	"total_minutes" integer DEFAULT 0 NOT NULL,
	"committed_minutes" integer DEFAULT 0 NOT NULL,
	"available_minutes" integer DEFAULT 0 NOT NULL,
	"computed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "resource_assignments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"work_segment_id" uuid NOT NULL,
	"resource_id" uuid NOT NULL,
	"role" "resource_assignment_role" DEFAULT 'primary' NOT NULL,
	"planned_start_at" timestamp with time zone,
	"planned_end_at" timestamp with time zone,
	"actual_start_at" timestamp with time zone,
	"actual_end_at" timestamp with time zone,
	"status" "resource_assignment_status" DEFAULT 'planned' NOT NULL,
	"conflict_resolved_at" timestamp with time zone,
	"conflict_override_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" uuid,
	"updated_by" uuid
);
--> statement-breakpoint
CREATE TABLE "tasks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"work_segment_id" uuid NOT NULL,
	"label" text NOT NULL,
	"sequence_no" integer DEFAULT 0 NOT NULL,
	"planned_minutes" integer DEFAULT 0 NOT NULL,
	"status" "task_status" DEFAULT 'not_started' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" uuid,
	"updated_by" uuid
);
--> statement-breakpoint
CREATE TABLE "work_segment_dependencies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"segment_id" uuid NOT NULL,
	"prerequisite_segment_id" uuid NOT NULL,
	"dependency_kind" "segment_dependency_kind" DEFAULT 'must_complete_before' NOT NULL,
	CONSTRAINT "work_segment_deps_uq" UNIQUE("segment_id","prerequisite_segment_id")
);
--> statement-breakpoint
CREATE TABLE "work_segments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"case_id" uuid NOT NULL,
	"production_order_id" uuid NOT NULL,
	"segment_code" varchar(64) NOT NULL,
	"label" text NOT NULL,
	"sequence_no" integer DEFAULT 0 NOT NULL,
	"planned_workshop_id" uuid,
	"planned_department_id" uuid,
	"required_skills" jsonb,
	"required_equipment_kinds" jsonb,
	"planned_minutes" integer DEFAULT 0 NOT NULL,
	"actual_minutes" integer DEFAULT 0 NOT NULL,
	"remaining_minutes_estimate" integer,
	"status" "work_segment_status" DEFAULT 'not_started' NOT NULL,
	"blocked_reason" text,
	"scheduled_start_at" timestamp with time zone,
	"scheduled_end_at" timestamp with time zone,
	"actual_start_at" timestamp with time zone,
	"actual_end_at" timestamp with time zone,
	"default_funding_source_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" uuid,
	"updated_by" uuid
);
--> statement-breakpoint
ALTER TABLE "clock_sessions" ADD COLUMN "work_segment_id" uuid;--> statement-breakpoint
ALTER TABLE "time_entries" ADD COLUMN "work_segment_id" uuid;--> statement-breakpoint
ALTER TABLE "capacity_forecast_snapshots" ADD CONSTRAINT "capacity_forecast_snapshots_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "capacity_forecast_snapshots" ADD CONSTRAINT "capacity_forecast_snapshots_workshop_id_workshops_id_fk" FOREIGN KEY ("workshop_id") REFERENCES "public"."workshops"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "capacity_forecast_snapshots" ADD CONSTRAINT "capacity_forecast_snapshots_resource_id_resources_id_fk" FOREIGN KEY ("resource_id") REFERENCES "public"."resources"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resource_assignments" ADD CONSTRAINT "resource_assignments_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resource_assignments" ADD CONSTRAINT "resource_assignments_work_segment_id_work_segments_id_fk" FOREIGN KEY ("work_segment_id") REFERENCES "public"."work_segments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resource_assignments" ADD CONSTRAINT "resource_assignments_resource_id_resources_id_fk" FOREIGN KEY ("resource_id") REFERENCES "public"."resources"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_work_segment_id_work_segments_id_fk" FOREIGN KEY ("work_segment_id") REFERENCES "public"."work_segments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_segment_dependencies" ADD CONSTRAINT "work_segment_dependencies_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_segment_dependencies" ADD CONSTRAINT "work_segment_dependencies_segment_id_work_segments_id_fk" FOREIGN KEY ("segment_id") REFERENCES "public"."work_segments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_segment_dependencies" ADD CONSTRAINT "work_segment_dependencies_prerequisite_segment_id_work_segments_id_fk" FOREIGN KEY ("prerequisite_segment_id") REFERENCES "public"."work_segments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_segments" ADD CONSTRAINT "work_segments_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_segments" ADD CONSTRAINT "work_segments_case_id_cases_id_fk" FOREIGN KEY ("case_id") REFERENCES "public"."cases"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_segments" ADD CONSTRAINT "work_segments_production_order_id_production_orders_id_fk" FOREIGN KEY ("production_order_id") REFERENCES "public"."production_orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_segments" ADD CONSTRAINT "work_segments_planned_workshop_id_workshops_id_fk" FOREIGN KEY ("planned_workshop_id") REFERENCES "public"."workshops"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_segments" ADD CONSTRAINT "work_segments_planned_department_id_workshop_departments_id_fk" FOREIGN KEY ("planned_department_id") REFERENCES "public"."workshop_departments"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_segments" ADD CONSTRAINT "work_segments_default_funding_source_id_case_funding_sources_id_fk" FOREIGN KEY ("default_funding_source_id") REFERENCES "public"."case_funding_sources"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "capacity_snapshots_resource_date_idx" ON "capacity_forecast_snapshots" USING btree ("organization_id","resource_id","forecast_date");--> statement-breakpoint
CREATE INDEX "resource_assignments_segment_idx" ON "resource_assignments" USING btree ("organization_id","work_segment_id");--> statement-breakpoint
CREATE INDEX "resource_assignments_resource_idx" ON "resource_assignments" USING btree ("resource_id","planned_start_at");--> statement-breakpoint
CREATE INDEX "tasks_segment_idx" ON "tasks" USING btree ("organization_id","work_segment_id");--> statement-breakpoint
CREATE INDEX "work_segment_deps_org_idx" ON "work_segment_dependencies" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "work_segments_case_idx" ON "work_segments" USING btree ("organization_id","case_id");--> statement-breakpoint
CREATE INDEX "work_segments_order_idx" ON "work_segments" USING btree ("production_order_id");--> statement-breakpoint
CREATE INDEX "work_segments_status_idx" ON "work_segments" USING btree ("organization_id","status");--> statement-breakpoint
ALTER TABLE "clock_sessions" ADD CONSTRAINT "clock_sessions_work_segment_id_work_segments_id_fk" FOREIGN KEY ("work_segment_id") REFERENCES "public"."work_segments"("id") ON DELETE set null ON UPDATE no action;