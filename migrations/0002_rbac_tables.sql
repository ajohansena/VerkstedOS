CREATE TYPE "public"."grant_kind" AS ENUM('grant', 'deny');--> statement-breakpoint
CREATE TABLE "effective_permissions_cache" (
	"organization_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"permission_code" varchar(64) NOT NULL,
	CONSTRAINT "effective_permissions_cache_pk" PRIMARY KEY("organization_id","user_id","permission_code")
);
--> statement-breakpoint
CREATE TABLE "role_assignments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"membership_id" uuid NOT NULL,
	"role_id" uuid NOT NULL,
	"workshop_id" uuid,
	"department_id" uuid,
	"valid_from" timestamp with time zone,
	"valid_until" timestamp with time zone,
	"assigned_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" uuid,
	"updated_by" uuid
);
--> statement-breakpoint
CREATE TABLE "role_permissions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"role_id" uuid NOT NULL,
	"permission_code" varchar(64) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" uuid,
	"updated_by" uuid,
	CONSTRAINT "role_permissions_role_code_uq" UNIQUE("role_id","permission_code")
);
--> statement-breakpoint
CREATE TABLE "roles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"key" varchar(32),
	"is_system" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" uuid,
	"updated_by" uuid
);
--> statement-breakpoint
CREATE TABLE "user_permission_grants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"membership_id" uuid NOT NULL,
	"permission_code" varchar(64) NOT NULL,
	"workshop_id" uuid,
	"department_id" uuid,
	"kind" "grant_kind" NOT NULL,
	"reason" text NOT NULL,
	"granted_by_user_id" uuid,
	"valid_from" timestamp with time zone,
	"valid_until" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" uuid,
	"updated_by" uuid
);
--> statement-breakpoint
ALTER TABLE "effective_permissions_cache" ADD CONSTRAINT "effective_permissions_cache_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "effective_permissions_cache" ADD CONSTRAINT "effective_permissions_cache_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_assignments" ADD CONSTRAINT "role_assignments_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_assignments" ADD CONSTRAINT "role_assignments_membership_id_memberships_id_fk" FOREIGN KEY ("membership_id") REFERENCES "public"."memberships"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_assignments" ADD CONSTRAINT "role_assignments_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_assignments" ADD CONSTRAINT "role_assignments_workshop_id_workshops_id_fk" FOREIGN KEY ("workshop_id") REFERENCES "public"."workshops"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_assignments" ADD CONSTRAINT "role_assignments_department_id_workshop_departments_id_fk" FOREIGN KEY ("department_id") REFERENCES "public"."workshop_departments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "roles" ADD CONSTRAINT "roles_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_permission_grants" ADD CONSTRAINT "user_permission_grants_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_permission_grants" ADD CONSTRAINT "user_permission_grants_membership_id_memberships_id_fk" FOREIGN KEY ("membership_id") REFERENCES "public"."memberships"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_permission_grants" ADD CONSTRAINT "user_permission_grants_workshop_id_workshops_id_fk" FOREIGN KEY ("workshop_id") REFERENCES "public"."workshops"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_permission_grants" ADD CONSTRAINT "user_permission_grants_department_id_workshop_departments_id_fk" FOREIGN KEY ("department_id") REFERENCES "public"."workshop_departments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "effective_permissions_cache_user_idx" ON "effective_permissions_cache" USING btree ("organization_id","user_id");--> statement-breakpoint
CREATE INDEX "role_assignments_org_membership_idx" ON "role_assignments" USING btree ("organization_id","membership_id");--> statement-breakpoint
CREATE INDEX "role_assignments_role_idx" ON "role_assignments" USING btree ("role_id");--> statement-breakpoint
CREATE INDEX "role_permissions_org_idx" ON "role_permissions" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "roles_org_idx" ON "roles" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "user_permission_grants_org_membership_idx" ON "user_permission_grants" USING btree ("organization_id","membership_id");