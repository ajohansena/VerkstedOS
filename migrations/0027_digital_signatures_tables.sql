CREATE TYPE "public"."signature_kind" AS ENUM('repair_acceptance', 'delivery_handover', 'rental_agreement', 'quality_signoff', 'other');--> statement-breakpoint
CREATE TYPE "public"."signature_signer_kind" AS ENUM('customer', 'staff', 'system');--> statement-breakpoint
CREATE TABLE "digital_signatures" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"case_id" uuid NOT NULL,
	"kind" "signature_kind" NOT NULL,
	"signer_kind" "signature_signer_kind" DEFAULT 'customer' NOT NULL,
	"signer_name" text,
	"signer_reference" text,
	"subject_type" varchar(32),
	"subject_id" uuid,
	"payload_hash" varchar(64) NOT NULL,
	"chain_hash" varchar(64) NOT NULL,
	"previous_chain_hash" varchar(64),
	"sequence_no" integer DEFAULT 0 NOT NULL,
	"evidence" jsonb,
	"signed_by_user_id" uuid,
	"signed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "digital_signatures" ADD CONSTRAINT "digital_signatures_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "digital_signatures" ADD CONSTRAINT "digital_signatures_case_id_cases_id_fk" FOREIGN KEY ("case_id") REFERENCES "public"."cases"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "digital_signatures_case_idx" ON "digital_signatures" USING btree ("organization_id","case_id","sequence_no");