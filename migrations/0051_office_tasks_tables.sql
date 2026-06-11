CREATE TYPE "public"."office_task_kind" AS ENUM('order_parts', 'customer_call', 'insurer_followup', 'rental_booking', 'invoice_prep', 'customer_followup', 'documentation', 'other');--> statement-breakpoint
CREATE TYPE "public"."office_task_priority" AS ENUM('low', 'normal', 'high', 'urgent');--> statement-breakpoint
CREATE TYPE "public"."office_task_status" AS ENUM('open', 'in_progress', 'completed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."task_template_due_reference" AS ENUM('event_time', 'case_expected_arrival_at', 'case_promised_delivery_at');--> statement-breakpoint
CREATE TABLE "office_tasks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"workshop_id" uuid,
	"case_id" uuid,
	"title" text NOT NULL,
	"description" text,
	"kind" "office_task_kind" DEFAULT 'other' NOT NULL,
	"priority" "office_task_priority" DEFAULT 'normal' NOT NULL,
	"status" "office_task_status" DEFAULT 'open' NOT NULL,
	"due_at" timestamp with time zone,
	"assignee_resource_id" uuid,
	"assignee_user_id" uuid,
	"generated_by_event_type" text,
	"generated_from_event_id" uuid,
	"generated_from_template_id" uuid,
	"completed_at" timestamp with time zone,
	"completed_by_user_id" uuid,
	"cancelled_at" timestamp with time zone,
	"cancelled_by_user_id" uuid,
	"cancelled_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" uuid,
	"updated_by" uuid,
	CONSTRAINT "office_tasks_single_assignee_chk" CHECK (("office_tasks"."assignee_resource_id" IS NULL) OR ("office_tasks"."assignee_user_id" IS NULL))
);
--> statement-breakpoint
ALTER TABLE "office_tasks" ADD CONSTRAINT "office_tasks_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "office_tasks" ADD CONSTRAINT "office_tasks_workshop_id_workshops_id_fk" FOREIGN KEY ("workshop_id") REFERENCES "public"."workshops"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "office_tasks" ADD CONSTRAINT "office_tasks_case_id_cases_id_fk" FOREIGN KEY ("case_id") REFERENCES "public"."cases"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "office_tasks" ADD CONSTRAINT "office_tasks_assignee_resource_id_resources_id_fk" FOREIGN KEY ("assignee_resource_id") REFERENCES "public"."resources"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "office_tasks" ADD CONSTRAINT "office_tasks_assignee_user_id_users_id_fk" FOREIGN KEY ("assignee_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "office_tasks" ADD CONSTRAINT "office_tasks_completed_by_user_id_users_id_fk" FOREIGN KEY ("completed_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "office_tasks" ADD CONSTRAINT "office_tasks_cancelled_by_user_id_users_id_fk" FOREIGN KEY ("cancelled_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "office_tasks_org_status_idx" ON "office_tasks" USING btree ("organization_id","status","due_at");--> statement-breakpoint
CREATE INDEX "office_tasks_case_idx" ON "office_tasks" USING btree ("organization_id","case_id");--> statement-breakpoint
CREATE INDEX "office_tasks_assignee_user_idx" ON "office_tasks" USING btree ("organization_id","assignee_user_id","status");--> statement-breakpoint
CREATE INDEX "office_tasks_assignee_resource_idx" ON "office_tasks" USING btree ("organization_id","assignee_resource_id","status");--> statement-breakpoint
CREATE INDEX "office_tasks_workshop_due_idx" ON "office_tasks" USING btree ("organization_id","workshop_id","due_at");