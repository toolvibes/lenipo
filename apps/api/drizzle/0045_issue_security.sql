CREATE TABLE "security_level_grants" (
	"id" uuid PRIMARY KEY NOT NULL,
	"level_id" uuid NOT NULL,
	"grantee" "permission_grantee" NOT NULL,
	"role" "project_role",
	"group_id" uuid,
	"user_id" uuid,
	CONSTRAINT "security_level_grants_one_grantee" CHECK ((grantee = 'role') = (role is not null)
        and (grantee = 'group') = (group_id is not null)
        and (grantee = 'user') = (user_id is not null))
);
--> statement-breakpoint
CREATE TABLE "security_levels" (
	"id" uuid PRIMARY KEY NOT NULL,
	"scheme_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"position" integer NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "security_schemes" (
	"id" uuid PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "issues" ADD COLUMN "security_level_id" uuid;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "security_scheme_id" uuid;--> statement-breakpoint
ALTER TABLE "security_level_grants" ADD CONSTRAINT "security_level_grants_level_id_security_levels_id_fk" FOREIGN KEY ("level_id") REFERENCES "public"."security_levels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "security_level_grants" ADD CONSTRAINT "security_level_grants_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "security_level_grants" ADD CONSTRAINT "security_level_grants_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "security_levels" ADD CONSTRAINT "security_levels_scheme_id_security_schemes_id_fk" FOREIGN KEY ("scheme_id") REFERENCES "public"."security_schemes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "security_level_grants_level_idx" ON "security_level_grants" USING btree ("level_id");--> statement-breakpoint
CREATE INDEX "security_levels_scheme_idx" ON "security_levels" USING btree ("scheme_id");--> statement-breakpoint
CREATE UNIQUE INDEX "security_schemes_name_unique" ON "security_schemes" USING btree ("name");--> statement-breakpoint
ALTER TABLE "issues" ADD CONSTRAINT "issues_security_level_id_security_levels_id_fk" FOREIGN KEY ("security_level_id") REFERENCES "public"."security_levels"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_security_scheme_id_security_schemes_id_fk" FOREIGN KEY ("security_scheme_id") REFERENCES "public"."security_schemes"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
-- TL-13, E-94: whoever administers a project may set issue security, as before nobody could.
INSERT INTO "permission_scheme_grants" ("id", "scheme_id", "permission", "grantee", "role")
SELECT gen_random_uuid(), "scheme_id", 'set-issue-security', 'role', 'administrators'
FROM "permission_scheme_grants"
WHERE "permission" = 'administer' AND "grantee" = 'role' AND "role" = 'administrators';
