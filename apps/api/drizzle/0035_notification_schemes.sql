CREATE TYPE "public"."notification_event" AS ENUM('created', 'assigned', 'status', 'updated', 'commented');--> statement-breakpoint
CREATE TYPE "public"."notification_recipient" AS ENUM('watchers', 'assignee', 'reporter', 'role', 'group', 'user');--> statement-breakpoint
CREATE TABLE "notification_scheme_rules" (
	"id" uuid PRIMARY KEY NOT NULL,
	"scheme_id" uuid NOT NULL,
	"event" "notification_event" NOT NULL,
	"recipient" "notification_recipient" NOT NULL,
	"role" "project_role",
	"group_id" uuid,
	"user_id" uuid,
	CONSTRAINT "notification_scheme_rules_one_target" CHECK ((recipient = 'role') = (role is not null)
        and (recipient = 'group') = (group_id is not null)
        and (recipient = 'user') = (user_id is not null))
);
--> statement-breakpoint
CREATE TABLE "notification_schemes" (
	"id" uuid PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "notification_scheme_id" uuid;--> statement-breakpoint
ALTER TABLE "notification_scheme_rules" ADD CONSTRAINT "notification_scheme_rules_scheme_id_notification_schemes_id_fk" FOREIGN KEY ("scheme_id") REFERENCES "public"."notification_schemes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_scheme_rules" ADD CONSTRAINT "notification_scheme_rules_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_scheme_rules" ADD CONSTRAINT "notification_scheme_rules_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "notification_scheme_rules_scheme_idx" ON "notification_scheme_rules" USING btree ("scheme_id","event");--> statement-breakpoint
CREATE UNIQUE INDEX "notification_schemes_name_unique" ON "notification_schemes" USING btree ("name");--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_notification_scheme_id_notification_schemes_id_fk" FOREIGN KEY ("notification_scheme_id") REFERENCES "public"."notification_schemes"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
-- The default scheme: every event to the watchers, exactly as before (E-83).
INSERT INTO "notification_schemes" ("id", "name", "description") VALUES ('01a00000-0000-7000-8000-00000000b311', 'Standard', 'Alle Ereignisse an die Beobachtenden wie bisher');
--> statement-breakpoint
INSERT INTO "notification_scheme_rules" ("id", "scheme_id", "event", "recipient") VALUES
  (gen_random_uuid(), '01a00000-0000-7000-8000-00000000b311', 'created', 'watchers'),
  (gen_random_uuid(), '01a00000-0000-7000-8000-00000000b311', 'assigned', 'watchers'),
  (gen_random_uuid(), '01a00000-0000-7000-8000-00000000b311', 'status', 'watchers'),
  (gen_random_uuid(), '01a00000-0000-7000-8000-00000000b311', 'updated', 'watchers'),
  (gen_random_uuid(), '01a00000-0000-7000-8000-00000000b311', 'commented', 'watchers');
