CREATE TYPE "public"."dangerous_operation_kind" AS ENUM('org_lock', 'org_unlock', 'jobs_pause', 'jobs_resume', 'maintenance_mode_on', 'maintenance_mode_off', 'data_delete', 'data_restore');--> statement-breakpoint
CREATE TYPE "public"."dangerous_operation_status" AS ENUM('pending_approval', 'approved', 'rejected', 'executed', 'cancelled');--> statement-breakpoint
CREATE TABLE "dangerous_operations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid,
	"kind" "dangerous_operation_kind" NOT NULL,
	"status" "dangerous_operation_status" DEFAULT 'pending_approval' NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"reason" text NOT NULL,
	"requested_by_user_id" uuid NOT NULL,
	"requested_at" timestamp with time zone DEFAULT now() NOT NULL,
	"approved_by_user_id" uuid,
	"approved_at" timestamp with time zone,
	"executed_at" timestamp with time zone,
	"outcome" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" uuid,
	"updated_by" uuid
);
--> statement-breakpoint
ALTER TABLE "dangerous_operations" ADD CONSTRAINT "dangerous_operations_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dangerous_operations" ADD CONSTRAINT "dangerous_operations_requested_by_user_id_users_id_fk" FOREIGN KEY ("requested_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dangerous_operations" ADD CONSTRAINT "dangerous_operations_approved_by_user_id_users_id_fk" FOREIGN KEY ("approved_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "dangerous_operations_status_idx" ON "dangerous_operations" USING btree ("status");--> statement-breakpoint
CREATE INDEX "dangerous_operations_org_idx" ON "dangerous_operations" USING btree ("organization_id");