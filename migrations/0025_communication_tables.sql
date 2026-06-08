CREATE TYPE "public"."case_acceptance_method" AS ENUM('job_card_link', 'sms_reply', 'email_reply', 'manual');--> statement-breakpoint
CREATE TYPE "public"."case_acceptance_status" AS ENUM('pending', 'accepted', 'declined', 'expired', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."communication_channel" AS ENUM('sms', 'email');--> statement-breakpoint
CREATE TYPE "public"."communication_direction" AS ENUM('outbound', 'inbound');--> statement-breakpoint
CREATE TYPE "public"."communication_message_status" AS ENUM('queued', 'sent', 'delivered', 'failed', 'received');--> statement-breakpoint
CREATE TYPE "public"."communication_thread_status" AS ENUM('open', 'closed');--> statement-breakpoint
CREATE TABLE "case_acceptances" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"case_id" uuid NOT NULL,
	"customer_id" uuid,
	"thread_id" uuid,
	"channel" "communication_channel",
	"status" "case_acceptance_status" DEFAULT 'pending' NOT NULL,
	"token" varchar(64) NOT NULL,
	"summary" text,
	"requested_by_user_id" uuid,
	"requested_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone,
	"method" "case_acceptance_method",
	"responded_at" timestamp with time zone,
	"response_text" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" uuid,
	"updated_by" uuid
);
--> statement-breakpoint
CREATE TABLE "communication_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"thread_id" uuid NOT NULL,
	"direction" "communication_direction" NOT NULL,
	"channel" "communication_channel" NOT NULL,
	"body" text NOT NULL,
	"status" "communication_message_status" DEFAULT 'queued' NOT NULL,
	"provider_message_id" varchar(128),
	"sent_by_user_id" uuid,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" uuid,
	"updated_by" uuid
);
--> statement-breakpoint
CREATE TABLE "communication_threads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"case_id" uuid NOT NULL,
	"customer_id" uuid,
	"channel" "communication_channel" NOT NULL,
	"contact_value" varchar(256) NOT NULL,
	"subject" text,
	"status" "communication_thread_status" DEFAULT 'open' NOT NULL,
	"last_message_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" uuid,
	"updated_by" uuid
);
--> statement-breakpoint
ALTER TABLE "case_acceptances" ADD CONSTRAINT "case_acceptances_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "case_acceptances" ADD CONSTRAINT "case_acceptances_case_id_cases_id_fk" FOREIGN KEY ("case_id") REFERENCES "public"."cases"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "case_acceptances" ADD CONSTRAINT "case_acceptances_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "case_acceptances" ADD CONSTRAINT "case_acceptances_thread_id_communication_threads_id_fk" FOREIGN KEY ("thread_id") REFERENCES "public"."communication_threads"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "communication_messages" ADD CONSTRAINT "communication_messages_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "communication_messages" ADD CONSTRAINT "communication_messages_thread_id_communication_threads_id_fk" FOREIGN KEY ("thread_id") REFERENCES "public"."communication_threads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "communication_threads" ADD CONSTRAINT "communication_threads_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "communication_threads" ADD CONSTRAINT "communication_threads_case_id_cases_id_fk" FOREIGN KEY ("case_id") REFERENCES "public"."cases"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "communication_threads" ADD CONSTRAINT "communication_threads_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "case_acceptances_token_uq" ON "case_acceptances" USING btree ("token");--> statement-breakpoint
CREATE INDEX "case_acceptances_case_idx" ON "case_acceptances" USING btree ("organization_id","case_id","status");--> statement-breakpoint
CREATE INDEX "communication_messages_thread_idx" ON "communication_messages" USING btree ("organization_id","thread_id","occurred_at");--> statement-breakpoint
CREATE INDEX "communication_threads_case_idx" ON "communication_threads" USING btree ("organization_id","case_id");--> statement-breakpoint
CREATE INDEX "communication_threads_contact_idx" ON "communication_threads" USING btree ("organization_id","channel","contact_value");