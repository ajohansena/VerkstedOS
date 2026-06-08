CREATE TYPE "public"."production_hold_kind" AS ENUM('parts', 'approval_insurance', 'approval_customer', 'transport', 'subcontractor', 'documentation', 'equipment_offline', 'paint_cure', 'other');--> statement-breakpoint
CREATE TYPE "public"."workflow_state_category" AS ENUM('active', 'waiting', 'terminal');--> statement-breakpoint
CREATE TYPE "public"."workflow_transition_trigger" AS ENUM('manual', 'automatic', 'event_driven');--> statement-breakpoint
CREATE TABLE "production_holds" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"case_id" uuid NOT NULL,
	"hold_kind" "production_hold_kind" NOT NULL,
	"reason" text,
	"expected_resolution_at" timestamp with time zone,
	"resolved_at" timestamp with time zone,
	"resolved_by_user_id" uuid,
	"resolution_note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" uuid,
	"updated_by" uuid
);
--> statement-breakpoint
CREATE TABLE "production_orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"case_id" uuid NOT NULL,
	"workflow_definition_id" uuid NOT NULL,
	"current_state_id" uuid,
	"opened_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" uuid,
	"updated_by" uuid,
	CONSTRAINT "production_orders_case_uq" UNIQUE("case_id")
);
--> statement-breakpoint
CREATE TABLE "production_state_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"case_id" uuid NOT NULL,
	"production_order_id" uuid NOT NULL,
	"from_state_id" uuid,
	"to_state_id" uuid NOT NULL,
	"trigger" "workflow_transition_trigger" DEFAULT 'manual' NOT NULL,
	"trigger_event_type" text,
	"reason" text,
	"actor_user_id" uuid,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	"correlation_id" varchar(64)
);
--> statement-breakpoint
CREATE TABLE "workflow_definitions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"name" text NOT NULL,
	"version_number" integer DEFAULT 1 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" uuid,
	"updated_by" uuid
);
--> statement-breakpoint
CREATE TABLE "workflow_states" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"workflow_definition_id" uuid NOT NULL,
	"code" varchar(64) NOT NULL,
	"label" text NOT NULL,
	"category" "workflow_state_category" NOT NULL,
	"sequence_no" integer DEFAULT 0 NOT NULL,
	"color_hint" varchar(16),
	"is_initial" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" uuid,
	"updated_by" uuid,
	CONSTRAINT "workflow_states_def_code_uq" UNIQUE("workflow_definition_id","code")
);
--> statement-breakpoint
CREATE TABLE "workflow_transitions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"workflow_definition_id" uuid NOT NULL,
	"from_state_id" uuid NOT NULL,
	"to_state_id" uuid NOT NULL,
	"trigger" "workflow_transition_trigger" DEFAULT 'manual' NOT NULL,
	"event_type" text,
	"required_permissions" jsonb,
	"required_conditions" jsonb,
	"side_effects" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" uuid,
	"updated_by" uuid
);
--> statement-breakpoint
ALTER TABLE "production_holds" ADD CONSTRAINT "production_holds_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "production_holds" ADD CONSTRAINT "production_holds_case_id_cases_id_fk" FOREIGN KEY ("case_id") REFERENCES "public"."cases"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "production_orders" ADD CONSTRAINT "production_orders_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "production_orders" ADD CONSTRAINT "production_orders_case_id_cases_id_fk" FOREIGN KEY ("case_id") REFERENCES "public"."cases"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "production_orders" ADD CONSTRAINT "production_orders_workflow_definition_id_workflow_definitions_id_fk" FOREIGN KEY ("workflow_definition_id") REFERENCES "public"."workflow_definitions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "production_orders" ADD CONSTRAINT "production_orders_current_state_id_workflow_states_id_fk" FOREIGN KEY ("current_state_id") REFERENCES "public"."workflow_states"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "production_state_history" ADD CONSTRAINT "production_state_history_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "production_state_history" ADD CONSTRAINT "production_state_history_case_id_cases_id_fk" FOREIGN KEY ("case_id") REFERENCES "public"."cases"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "production_state_history" ADD CONSTRAINT "production_state_history_production_order_id_production_orders_id_fk" FOREIGN KEY ("production_order_id") REFERENCES "public"."production_orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow_definitions" ADD CONSTRAINT "workflow_definitions_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow_states" ADD CONSTRAINT "workflow_states_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow_states" ADD CONSTRAINT "workflow_states_workflow_definition_id_workflow_definitions_id_fk" FOREIGN KEY ("workflow_definition_id") REFERENCES "public"."workflow_definitions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow_transitions" ADD CONSTRAINT "workflow_transitions_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow_transitions" ADD CONSTRAINT "workflow_transitions_workflow_definition_id_workflow_definitions_id_fk" FOREIGN KEY ("workflow_definition_id") REFERENCES "public"."workflow_definitions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow_transitions" ADD CONSTRAINT "workflow_transitions_from_state_id_workflow_states_id_fk" FOREIGN KEY ("from_state_id") REFERENCES "public"."workflow_states"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow_transitions" ADD CONSTRAINT "workflow_transitions_to_state_id_workflow_states_id_fk" FOREIGN KEY ("to_state_id") REFERENCES "public"."workflow_states"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "production_holds_case_idx" ON "production_holds" USING btree ("organization_id","case_id");--> statement-breakpoint
CREATE INDEX "production_orders_org_state_idx" ON "production_orders" USING btree ("organization_id","current_state_id");--> statement-breakpoint
CREATE INDEX "production_state_history_case_idx" ON "production_state_history" USING btree ("organization_id","case_id");--> statement-breakpoint
CREATE INDEX "production_state_history_order_idx" ON "production_state_history" USING btree ("production_order_id");--> statement-breakpoint
CREATE INDEX "workflow_definitions_org_idx" ON "workflow_definitions" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "workflow_states_def_idx" ON "workflow_states" USING btree ("workflow_definition_id");--> statement-breakpoint
CREATE INDEX "workflow_transitions_def_idx" ON "workflow_transitions" USING btree ("workflow_definition_id");--> statement-breakpoint
CREATE INDEX "workflow_transitions_from_idx" ON "workflow_transitions" USING btree ("from_state_id");