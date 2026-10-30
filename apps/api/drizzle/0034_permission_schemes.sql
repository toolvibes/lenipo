CREATE TYPE "public"."permission_grantee" AS ENUM('role', 'group', 'user');--> statement-breakpoint
CREATE TABLE "permission_scheme_grants" (
	"id" uuid PRIMARY KEY NOT NULL,
	"scheme_id" uuid NOT NULL,
	"permission" text NOT NULL,
	"grantee" "permission_grantee" NOT NULL,
	"role" "project_role",
	"group_id" uuid,
	"user_id" uuid,
	CONSTRAINT "permission_scheme_grants_one_grantee" CHECK ((grantee = 'role' and role is not null and group_id is null and user_id is null)
        or (grantee = 'group' and group_id is not null and role is null and user_id is null)
        or (grantee = 'user' and user_id is not null and role is null and group_id is null))
);
--> statement-breakpoint
CREATE TABLE "permission_schemes" (
	"id" uuid PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "permission_scheme_id" uuid;--> statement-breakpoint
ALTER TABLE "permission_scheme_grants" ADD CONSTRAINT "permission_scheme_grants_scheme_id_permission_schemes_id_fk" FOREIGN KEY ("scheme_id") REFERENCES "public"."permission_schemes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "permission_scheme_grants" ADD CONSTRAINT "permission_scheme_grants_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "permission_scheme_grants" ADD CONSTRAINT "permission_scheme_grants_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "permission_scheme_grants_scheme_idx" ON "permission_scheme_grants" USING btree ("scheme_id","permission");--> statement-breakpoint
CREATE UNIQUE INDEX "permission_schemes_name_unique" ON "permission_schemes" USING btree ("name");--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_permission_scheme_id_permission_schemes_id_fk" FOREIGN KEY ("permission_scheme_id") REFERENCES "public"."permission_schemes"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
-- The default scheme: exactly the rights that were fixed in code before (E-82).
INSERT INTO "permission_schemes" ("id", "name", "description") VALUES ('01a00000-0000-7000-8000-00000000c0de', 'Standard', 'Rechte der Projektrollen wie bisher');
--> statement-breakpoint
INSERT INTO "permission_scheme_grants" ("id", "scheme_id", "permission", "grantee", "role") VALUES
  (gen_random_uuid(), '01a00000-0000-7000-8000-00000000c0de', 'browse', 'role', 'administrators'),
  (gen_random_uuid(), '01a00000-0000-7000-8000-00000000c0de', 'create-issues', 'role', 'administrators'),
  (gen_random_uuid(), '01a00000-0000-7000-8000-00000000c0de', 'edit-issues', 'role', 'administrators'),
  (gen_random_uuid(), '01a00000-0000-7000-8000-00000000c0de', 'transition-issues', 'role', 'administrators'),
  (gen_random_uuid(), '01a00000-0000-7000-8000-00000000c0de', 'assign-issues', 'role', 'administrators'),
  (gen_random_uuid(), '01a00000-0000-7000-8000-00000000c0de', 'comment', 'role', 'administrators'),
  (gen_random_uuid(), '01a00000-0000-7000-8000-00000000c0de', 'delete-issues', 'role', 'administrators'),
  (gen_random_uuid(), '01a00000-0000-7000-8000-00000000c0de', 'administer', 'role', 'administrators'),
  (gen_random_uuid(), '01a00000-0000-7000-8000-00000000c0de', 'browse', 'role', 'developers'),
  (gen_random_uuid(), '01a00000-0000-7000-8000-00000000c0de', 'create-issues', 'role', 'developers'),
  (gen_random_uuid(), '01a00000-0000-7000-8000-00000000c0de', 'edit-issues', 'role', 'developers'),
  (gen_random_uuid(), '01a00000-0000-7000-8000-00000000c0de', 'transition-issues', 'role', 'developers'),
  (gen_random_uuid(), '01a00000-0000-7000-8000-00000000c0de', 'assign-issues', 'role', 'developers'),
  (gen_random_uuid(), '01a00000-0000-7000-8000-00000000c0de', 'comment', 'role', 'developers'),
  (gen_random_uuid(), '01a00000-0000-7000-8000-00000000c0de', 'browse', 'role', 'users'),
  (gen_random_uuid(), '01a00000-0000-7000-8000-00000000c0de', 'create-issues', 'role', 'users'),
  (gen_random_uuid(), '01a00000-0000-7000-8000-00000000c0de', 'comment', 'role', 'users');
