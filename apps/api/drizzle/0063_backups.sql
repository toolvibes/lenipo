CREATE TABLE "backups" (
	"id" uuid PRIMARY KEY NOT NULL,
	"trigger" text NOT NULL,
	"state" text DEFAULT 'running' NOT NULL,
	"created_by_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone,
	"size_bytes" bigint,
	"rows" integer,
	"files" integer,
	"error" text
);
--> statement-breakpoint
ALTER TABLE "backups" ADD CONSTRAINT "backups_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;